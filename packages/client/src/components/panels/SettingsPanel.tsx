// ──────────────────────────────────────────────
// Panel: Settings (polished)
// ──────────────────────────────────────────────
import {
  APP_LANGUAGE_OPTIONS,
  TRACKER_DATA_PANEL_SECTIONS,
  TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
  DEFAULT_ROLEPLAY_BACKGROUND_URL,
  useUIStore,
  getDefaultAppAccentColor,
  getDefaultAppBackgroundColor,
  getDefaultChatChromeTextColor,
  getDefaultChatTextColor,
  getTrackerPanelWidthForProfile,
  type ConversationMessageStyle,
  type GameDialogueDisplayMode,
  type RoleplayAvatarStyle,
  type TrackerDataPanelSection,
  type TrackerPanelSizeProfile,
  type TrackerTemperatureUnit,
  type TrackerThoughtBubbleDisplay,
  type VisualTheme,
} from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { useExtensions, useCreateExtension, useDeleteExtension, useUpdateExtension } from "../../hooks/use-extensions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_SECRET_STORAGE_KEY,
  ApiError,
  api,
  getAdminSecretHeader,
  getPrivilegedActionErrorMessage,
} from "../../lib/api-client";
import { chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { normalizeThemeCss, sanitizeAppCss } from "../../lib/theme-css";
import { forceRefreshSpa } from "@/lib/browser-runtime";
import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
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
  isJsonRecord,
  type ConversationCallCharacterVideoClipKind,
  type ImagePromptKind,
  type ImagePromptMode,
  type ImageStyleProfile,
  type ImageStyleProfileSettings,
  type InstalledExtension,
  type QuoteFormat,
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
  Star,
  Palette,
  Puzzle,
  CloudRain,
  FileCode2,
  FileText,
  Power,
  PowerOff,
  Paintbrush,
  AlertTriangle,
  Tag,
  Pencil,
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
} from "lucide-react";
import { useClearAllData, useExpungeData, useUpdateChatMetadata, type ExpungeScope } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useGameAssetStore } from "../../stores/game-asset.store";
import { useOpenGameAssetsFolder } from "../../hooks/use-game-assets";
import { chatKeys } from "../../hooks/use-chats";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ColorPicker } from "../ui/ColorPicker";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { TrackerSizeTierIcon } from "../ui/TrackerSizeTierIcon";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import {
  ConversationSoundSetting,
  SettingsIntro,
  SettingsSection,
  SettingsSwitch,
  ToggleSetting,
} from "./settings/SettingControls";
import { TrackerCardColorSettings } from "./settings/TrackerCardColorSettings";
import { PromptOverridesEditor } from "./settings/PromptOverridesEditor";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { inspectCharacterFilesForEmbeddedLorebooks } from "../../lib/character-import";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import {
  createExtensionFolderPackageFilename,
  createExtensionFolderPackageFiles,
} from "../../lib/extension-transfer";
import {
  collectFolderPackageEntries,
  getPackagePathBasename,
  readTextFilesFromFileList,
  resolvePackageTextPaths,
  type FolderPackageImportEntry,
  type PackageTextFile,
} from "../../lib/folder-package-transfer";
import { HOST_DEVICE_FILE_MANAGER_MESSAGE } from "../../lib/host-device";
import { isZipFile as isZipArchiveFile, readTextFilesFromZip } from "../../lib/read-zip-text";

type CustomFontFace = {
  filename: string;
  family: string;
  url: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
};

const TABS = [
  { id: "general", label: "General", icon: Settings2, description: "App behavior, responses, input, and playback." },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Theme, chat display, art, motion, and backgrounds." },
  { id: "generations", label: "Generations", icon: WandSparkles, description: "Image/video defaults and prompt templates." },
  { id: "addons", label: "Addons", icon: Puzzle, description: "Themes, extensions, and custom behavior." },
  { id: "import", label: "Imports", icon: Download, description: "Imports, asset folders, and data transfer." },
  { id: "advanced", label: "Advanced", icon: Terminal, description: "Admin access, updates, tools, backups, and danger zone." },
] as const;

type SettingsTabId = (typeof TABS)[number]["id"];
type SettingsSectionId =
  | "application"
  | "notifications"
  | "responses"
  | "input-editing"
  | "text-rules"
  | "game-playback"
  | "image-generation"
  | "video-generation"
  | "game-assets"
  | "app-style"
  | "text-scale"
  | "chat-display"
  | "roleplay-tracker"
  | "roleplay-messages"
  | "game-presentation"
  | "motion-backgrounds"
  | "conversation-theme"
  | "chat-backgrounds"
  | "prompt-overrides"
  | "theme-library"
  | "extension-library"
  | "profile-marinara"
  | "sillytavern-import"
  | "admin-access"
  | "updates"
  | "message-tools"
  | "backup-export"
  | "danger-zone";

type SettingsSectionMeta = {
  id: SettingsSectionId;
  tab: SettingsTabId;
  label: string;
  description: string;
  aliases: string[];
};

type SettingsControlKind = "Toggle" | "Slider" | "Select" | "Input" | "Picker" | "Button group";

type SettingsSearchableControlMeta = {
  id: string;
  sectionId: SettingsSectionId;
  label: string;
  description: string;
  aliases: string[];
  kind: SettingsControlKind;
};

type SettingsSearchResult =
  | { type: "section"; section: SettingsSectionMeta }
  | { type: "control"; control: SettingsSearchableControlMeta; section: SettingsSectionMeta };

const SETTINGS_SECTIONS: readonly SettingsSectionMeta[] = [
  {
    id: "application",
    tab: "general",
    label: "App Behavior",
    description: "Language, safety confirmations, achievements, music, and playful extras.",
    aliases: ["language", "delete", "confirm", "music", "achievements", "mini mari", "app"],
  },
  {
    id: "notifications",
    tab: "general",
    label: "Notifications",
    description: "Notification sounds and browser notifications by mode.",
    aliases: ["notifications", "sound", "ping", "browser", "background replies", "conversation", "roleplay", "game"],
  },
  {
    id: "responses",
    tab: "general",
    label: "Responses",
    description: "How replies arrive, save, and paginate.",
    aliases: ["streaming", "speed", "messages", "pagination", "trim", "model endings"],
  },
  {
    id: "input-editing",
    tab: "general",
    label: "Input & Editing",
    description: "Message input behavior and fast edit controls.",
    aliases: ["enter", "send", "microphone", "speech", "swipe", "reroll", "double click", "arrow up"],
  },
  {
    id: "text-rules",
    tab: "general",
    label: "Text Rules",
    description: "Formatting applied to chat text.",
    aliases: ["quotes", "bold", "dialogue", "latex", "symbols", "typographic"],
  },
  {
    id: "game-playback",
    tab: "general",
    label: "Game Playback",
    description: "Game mode reading and navigation.",
    aliases: ["game", "text speed", "auto play", "middle mouse", "navigation", "vn"],
  },
  {
    id: "image-generation",
    tab: "generations",
    label: "Image Generation",
    description: "Prompt review, image canvas defaults, and style profiles.",
    aliases: ["image", "background", "portrait", "selfie", "style profiles", "prompt review"],
  },
  {
    id: "video-generation",
    tab: "generations",
    label: "Video Generation",
    description: "Video duration, clip behavior, and reusable video settings.",
    aliases: ["video", "clip", "duration", "conversation call", "animated", "scene"],
  },
  {
    id: "game-assets",
    tab: "generations",
    label: "Game Assets",
    description: "Asset folders for music, ambience, sprites, and backgrounds.",
    aliases: ["assets", "music", "ambient", "sfx", "sprites", "backgrounds", "folder"],
  },
  {
    id: "app-style",
    tab: "appearance",
    label: "App Style",
    description: "Theme family, color scheme, accent, and app chrome controls.",
    aliases: ["theme", "accent", "rgb", "cursor", "background", "style", "color scheme"],
  },
  {
    id: "text-scale",
    tab: "appearance",
    label: "Text & Scale",
    description: "Fonts, display size, chat text colors, and legibility controls.",
    aliases: ["font", "google fonts", "display size", "chat font", "text", "stroke", "outline", "chrome text", "legibility"],
  },
  {
    id: "chat-display",
    tab: "appearance",
    label: "Conversation Display",
    description: "Conversation layout and shared message text presentation.",
    aliases: ["chat", "conversation", "messages", "timestamps", "token", "model", "grouping"],
  },
  {
    id: "roleplay-tracker",
    tab: "appearance",
    label: "Tracker Panel",
    description: "Roleplay HUD tracker panel, card layout, and tracker portrait behavior.",
    aliases: ["roleplay", "tracker", "hud", "cards", "thoughts", "temperature", "portrait"],
  },
  {
    id: "roleplay-messages",
    tab: "appearance",
    label: "Roleplay Messages",
    description: "Roleplay bubbles, avatars, sprite scale, and message opacity.",
    aliases: ["roleplay", "avatar", "sprite", "message", "bubble", "opacity", "portrait"],
  },
  {
    id: "game-presentation",
    tab: "appearance",
    label: "Game Presentation",
    description: "Game VN art scale and dialogue display.",
    aliases: ["game", "vn", "dialogue", "portrait", "sprite", "full body", "presentation"],
  },
  {
    id: "motion-backgrounds",
    tab: "appearance",
    label: "Atmosphere",
    description: "Roleplay weather and atmospheric effects.",
    aliases: ["motion", "weather", "effects", "atmosphere", "rain", "snow", "fog", "roleplay"],
  },
  {
    id: "conversation-theme",
    tab: "appearance",
    label: "Conversation Theme",
    description: "Conversation-mode background gradient by color scheme.",
    aliases: ["conversation", "gradient", "theme", "dark", "light"],
  },
  {
    id: "chat-backgrounds",
    tab: "appearance",
    label: "Backgrounds",
    description: "Chat background images, blur, and default roleplay background.",
    aliases: ["background", "blur", "scene", "image", "roleplay background", "chat background"],
  },
  {
    id: "prompt-overrides",
    tab: "generations",
    label: "Prompt Overrides",
    description: "Reusable image and video prompt templates.",
    aliases: ["prompt", "template", "override", "video prompt", "image prompt"],
  },
  {
    id: "extension-library",
    tab: "addons",
    label: "Extension Library",
    description: "Trusted browser and server extensions.",
    aliases: ["extensions", "addons", "tools", "browser", "server"],
  },
  {
    id: "theme-library",
    tab: "addons",
    label: "Theme Library",
    description: "Synced themes and custom theme CSS.",
    aliases: ["themes", "custom css", "css", "library", "export theme"],
  },
  {
    id: "profile-marinara",
    tab: "import",
    label: "Profile & Marinara",
    description: "Restore full profiles or import individual Marinara files.",
    aliases: ["profile", "import", "restore", "marinara", "json", "zip"],
  },
  {
    id: "sillytavern-import",
    tab: "import",
    label: "SillyTavern Import",
    description: "Bring over characters, chats, presets, and lorebooks.",
    aliases: ["sillytavern", "st", "character", "chat", "preset", "lorebook", "import"],
  },
  {
    id: "admin-access",
    tab: "advanced",
    label: "Admin Access",
    description: "Admin authorization for privileged actions.",
    aliases: ["admin", "secret", "access", "authorization"],
  },
  {
    id: "updates",
    tab: "advanced",
    label: "Updates",
    description: "Version and update controls.",
    aliases: ["update", "version", "refresh", "release"],
  },
  {
    id: "message-tools",
    tab: "advanced",
    label: "Message Tools",
    description: "Message maintenance and repair utilities.",
    aliases: ["messages", "tools", "repair", "cleanup"],
  },
  {
    id: "backup-export",
    tab: "advanced",
    label: "Backup & Export",
    description: "Backups and manual export tools.",
    aliases: ["backup", "export", "download", "archive"],
  },
  {
    id: "danger-zone",
    tab: "advanced",
    label: "Danger Zone",
    description: "Destructive reset and expunge actions.",
    aliases: ["danger", "reset", "delete", "clear", "expunge", "destructive"],
  },
] as const;

const SETTINGS_SECTION_BY_ID = new Map(SETTINGS_SECTIONS.map((section) => [section.id, section]));

const SETTINGS_SEARCHABLE_CONTROLS: readonly SettingsSearchableControlMeta[] = [
  {
    id: "language",
    sectionId: "application",
    label: "Language",
    description: "Choose the app language.",
    aliases: ["locale", "translation"],
    kind: "Select",
  },
  {
    id: "confirm-before-delete",
    sectionId: "application",
    label: "Confirm before deleting",
    description: "Ask before permanently deleting chats, characters, or other items.",
    aliases: ["delete", "confirmation", "safety"],
    kind: "Toggle",
  },
  {
    id: "achievements",
    sectionId: "application",
    label: "Achievements",
    description: "Show the Home achievements button and unlock notifications.",
    aliases: ["home", "badges", "unlock"],
    kind: "Toggle",
  },
  {
    id: "music-player",
    sectionId: "application",
    label: "Music Player",
    description: "Show the compact Music Player.",
    aliases: ["spotify", "youtube", "music dj"],
    kind: "Toggle",
  },
  {
    id: "mini-mari",
    sectionId: "application",
    label: "Mini Mari surprise visits",
    description: "Allow rare Chibi Professor Mari messages while scrolling.",
    aliases: ["chibi", "professor", "surprise"],
    kind: "Toggle",
  },
  {
    id: "notification-conversation-sound",
    sectionId: "notifications",
    label: "Conversation mode notification sound",
    description: "Play a ping for Conversation replies.",
    aliases: ["sound", "ping", "convo"],
    kind: "Toggle",
  },
  {
    id: "notification-roleplay-sound",
    sectionId: "notifications",
    label: "Roleplay mode notification sound",
    description: "Play a ping for Roleplay replies.",
    aliases: ["sound", "ping", "rp"],
    kind: "Toggle",
  },
  {
    id: "notification-game-sound",
    sectionId: "notifications",
    label: "Game mode notification sound",
    description: "Play a ping for Game replies.",
    aliases: ["sound", "ping"],
    kind: "Toggle",
  },
  {
    id: "notification-unfocused-only",
    sectionId: "notifications",
    label: "Only when Marinara is unfocused",
    description: "Play notification sounds only while Marinara is not focused.",
    aliases: ["sound", "background", "unfocused"],
    kind: "Toggle",
  },
  {
    id: "browser-background-notifications",
    sectionId: "notifications",
    label: "Background replies browser notifications",
    description: "Show browser notifications for background Conversation replies.",
    aliases: ["browser", "notifications", "conversation"],
    kind: "Toggle",
  },
  {
    id: "enable-streaming",
    sectionId: "responses",
    label: "Enable streaming",
    description: "Show AI responses as they generate.",
    aliases: ["stream", "typewriter", "response"],
    kind: "Toggle",
  },
  {
    id: "streaming-speed",
    sectionId: "responses",
    label: "Streaming speed",
    description: "Tune how fast streamed tokens appear.",
    aliases: ["speed", "typewriter", "tokens"],
    kind: "Slider",
  },
  {
    id: "trim-incomplete-output",
    sectionId: "responses",
    label: "Trim incomplete model endings",
    description: "Trim trailing unfinished sentences from AI responses.",
    aliases: ["trim", "unfinished", "sentence"],
    kind: "Toggle",
  },
  {
    id: "messages-per-page",
    sectionId: "responses",
    label: "Messages per page",
    description: "Control how many messages load at once.",
    aliases: ["pagination", "load more", "history"],
    kind: "Input",
  },
  {
    id: "speech-to-text",
    sectionId: "input-editing",
    label: "Speech-to-text microphone",
    description: "Show a microphone button in chat inputs.",
    aliases: ["microphone", "dictation", "speech"],
    kind: "Toggle",
  },
  {
    id: "intuitive-swipe-navigation",
    sectionId: "input-editing",
    label: "Intuitive swipe navigation",
    description: "Use keyboard arrows or touch swipes to move between generations.",
    aliases: ["swipes", "arrows", "alternate generations"],
    kind: "Toggle",
  },
  {
    id: "reroll-past-newest-swipe",
    sectionId: "input-editing",
    label: "Reroll past the newest swipe",
    description: "Create a reroll when swiping past the newest assistant message.",
    aliases: ["swipe", "reroll", "regenerate"],
    kind: "Toggle",
  },
  {
    id: "up-arrow-edits-last-message",
    sectionId: "input-editing",
    label: "Up Arrow edits last message",
    description: "Open the most recent message for editing with Up Arrow.",
    aliases: ["keyboard", "edit", "shortcut"],
    kind: "Toggle",
  },
  {
    id: "double-click-edits-messages",
    sectionId: "input-editing",
    label: "Double-click edits messages",
    description: "Edit Roleplay messages with double-click or double-tap.",
    aliases: ["double tap", "edit", "roleplay"],
    kind: "Toggle",
  },
  {
    id: "bold-dialogue",
    sectionId: "text-rules",
    label: "Bold dialogue in quotes",
    description: "Bold quoted dialogue text in chat display.",
    aliases: ["quotes", "dialogue", "formatting"],
    kind: "Toggle",
  },
  {
    id: "convert-latex-symbols",
    sectionId: "text-rules",
    label: "Convert LaTeX symbols",
    description: "Display common LaTeX commands as regular symbols.",
    aliases: ["math", "symbols", "formatting"],
    kind: "Toggle",
  },
  {
    id: "quote-style",
    sectionId: "text-rules",
    label: "Quote style",
    description: "Choose how quotation marks are unified.",
    aliases: ["quotes", "dialogue", "punctuation"],
    kind: "Button group",
  },
  {
    id: "game-instant-text-reveal",
    sectionId: "game-playback",
    label: "Instantly reveal game text",
    description: "Skip the Game mode narration typewriter effect.",
    aliases: ["game", "typewriter", "instant"],
    kind: "Toggle",
  },
  {
    id: "game-middle-mouse-navigation",
    sectionId: "game-playback",
    label: "Mouse-wheel + click navigation",
    description: "Navigate Game mode with mouse wheel and background clicks.",
    aliases: ["middle mouse", "scroll", "game navigation"],
    kind: "Toggle",
  },
  {
    id: "game-narration-speed",
    sectionId: "game-playback",
    label: "Game narration speed",
    description: "Tune the Game mode narration typewriter speed.",
    aliases: ["game", "typewriter", "speed"],
    kind: "Slider",
  },
  {
    id: "game-auto-play-delay",
    sectionId: "game-playback",
    label: "Game auto-play segment delay",
    description: "Pause between Game mode auto-play narration segments.",
    aliases: ["autoplay", "game", "delay"],
    kind: "Slider",
  },
  {
    id: "queue-image-generation",
    sectionId: "image-generation",
    label: "Queue image generation requests",
    description: "Send image generation jobs one at a time.",
    aliases: ["image", "queue", "generation"],
    kind: "Toggle",
  },
  {
    id: "image-prompt-review",
    sectionId: "image-generation",
    label: "Expose image prompts before sending",
    description: "Review generated image prompts before sending.",
    aliases: ["image", "prompt", "review"],
    kind: "Toggle",
  },
  {
    id: "image-background-size",
    sectionId: "image-generation",
    label: "Background image size",
    description: "Set default generated background dimensions.",
    aliases: ["image", "resolution", "canvas"],
    kind: "Input",
  },
  {
    id: "image-illustration-size",
    sectionId: "image-generation",
    label: "Illustration image size",
    description: "Set default generated illustration dimensions.",
    aliases: ["image", "resolution", "canvas", "illustrator"],
    kind: "Input",
  },
  {
    id: "image-portrait-size",
    sectionId: "image-generation",
    label: "Portrait image size",
    description: "Set default generated portrait dimensions.",
    aliases: ["image", "resolution", "canvas", "character"],
    kind: "Input",
  },
  {
    id: "image-selfie-size",
    sectionId: "image-generation",
    label: "Selfie image size",
    description: "Set default generated selfie dimensions.",
    aliases: ["image", "resolution", "canvas", "conversation"],
    kind: "Input",
  },
  {
    id: "image-style-profiles",
    sectionId: "image-generation",
    label: "Style Profiles",
    description: "Tune reusable image prompt style profiles.",
    aliases: ["image", "style", "danbooru", "anime", "realistic"],
    kind: "Select",
  },
  {
    id: "video-scene-duration",
    sectionId: "video-generation",
    label: "Scene video fallback length",
    description: "Set fallback duration for generated scene videos.",
    aliases: ["video", "duration", "length"],
    kind: "Input",
  },
  {
    id: "video-animated-expression-duration",
    sectionId: "video-generation",
    label: "Animated expression length",
    description: "Set animated expression clip duration.",
    aliases: ["video", "expression", "sprite", "duration"],
    kind: "Input",
  },
  {
    id: "visual-theme",
    sectionId: "app-style",
    label: "Visual Style",
    description: "Switch between Marinara and SillyTavern visual themes.",
    aliases: ["theme", "style", "sillytavern", "marinara"],
    kind: "Button group",
  },
  {
    id: "theme-mode",
    sectionId: "app-style",
    label: "Color Scheme",
    description: "Switch between dark and light mode.",
    aliases: ["theme", "dark", "light", "mode"],
    kind: "Select",
  },
  {
    id: "custom-cursor",
    sectionId: "app-style",
    label: "Custom Mouse Pointer",
    description: "Use Marinara's accent-colored cursor.",
    aliases: ["cursor", "mouse", "pointer"],
    kind: "Toggle",
  },
  {
    id: "app-background-color",
    sectionId: "app-style",
    label: "Background Color",
    description: "Set the main app shell background color.",
    aliases: ["background", "theme", "gradient"],
    kind: "Picker",
  },
  {
    id: "app-accent-color",
    sectionId: "app-style",
    label: "Accent Color",
    description: "Set the shared app accent color.",
    aliases: ["primary", "theme", "highlight"],
    kind: "Picker",
  },
  {
    id: "accent-pulse",
    sectionId: "app-style",
    label: "Accent Pulse",
    description: "Animate the selected accent color.",
    aliases: ["accent", "animation", "motion"],
    kind: "Toggle",
  },
  {
    id: "rgb-mode",
    sectionId: "app-style",
    label: "RGB Mode",
    description: "Cycle the app accent through Marinara's rainbow palette.",
    aliases: ["rainbow", "accent", "color"],
    kind: "Toggle",
  },
  {
    id: "font-family",
    sectionId: "text-scale",
    label: "Font",
    description: "Choose the font used across the app.",
    aliases: ["typography", "typeface"],
    kind: "Select",
  },
  {
    id: "display-size",
    sectionId: "text-scale",
    label: "Display Size",
    description: "Adjust the base font size across the app.",
    aliases: ["font size", "scale", "readability"],
    kind: "Select",
  },
  {
    id: "chat-font-size",
    sectionId: "text-scale",
    label: "Chat Font Size",
    description: "Adjust the font size of chat messages.",
    aliases: ["text size", "message size", "readability"],
    kind: "Slider",
  },
  {
    id: "chat-text-color",
    sectionId: "text-scale",
    label: "Chat Text Color",
    description: "Control the main chat message text color.",
    aliases: ["font color", "message color"],
    kind: "Picker",
  },
  {
    id: "chat-chrome-text-color",
    sectionId: "text-scale",
    label: "Chat Chrome Text Color",
    description: "Control ordinary chrome copy color in chat-adjacent UI.",
    aliases: ["chrome", "text color", "tracker"],
    kind: "Picker",
  },
  {
    id: "text-outline-width",
    sectionId: "text-scale",
    label: "Text Outline / Stroke",
    description: "Tune chat text outline width and color.",
    aliases: ["stroke", "outline", "readability"],
    kind: "Slider",
  },
  {
    id: "conversation-layout",
    sectionId: "chat-display",
    label: "Chat Layout",
    description: "Switch Conversation messages between linear rows and bubbles.",
    aliases: ["conversation", "bubbles", "linear"],
    kind: "Button group",
  },
  {
    id: "tracker-panel",
    sectionId: "roleplay-tracker",
    label: "Tracker Panel",
    description: "Show or hide the Roleplay HUD tracker panel.",
    aliases: ["tracker", "hud", "roleplay"],
    kind: "Toggle",
  },
  {
    id: "tracker-replace-hud-icons",
    sectionId: "roleplay-tracker",
    label: "Replace tracker HUD icons",
    description: "Hide the old world/player tracker icon strip.",
    aliases: ["tracker", "hud", "icons"],
    kind: "Toggle",
  },
  {
    id: "tracker-expression-sprites",
    sectionId: "roleplay-tracker",
    label: "Use expression sprites for tracker portraits",
    description: "Allow tracker portraits to use Expression Engine sprites.",
    aliases: ["tracker", "sprites", "portraits"],
    kind: "Toggle",
  },
  {
    id: "tracker-panel-background",
    sectionId: "roleplay-tracker",
    label: "Panel background",
    description: "Pick the Tracker panel background.",
    aliases: ["tracker", "background", "color"],
    kind: "Picker",
  },
  {
    id: "tracker-desktop-size",
    sectionId: "roleplay-tracker",
    label: "Desktop size",
    description: "Choose the Tracker panel desktop width.",
    aliases: ["tracker", "width", "compact", "expanded"],
    kind: "Button group",
  },
  {
    id: "tracker-thought-display-mode",
    sectionId: "roleplay-tracker",
    label: "Thought display mode",
    description: "Choose how featured character thoughts open.",
    aliases: ["tracker", "thoughts", "dock", "floating"],
    kind: "Button group",
  },
  {
    id: "tracker-docked-thoughts",
    sectionId: "roleplay-tracker",
    label: "Always show Docked thoughts",
    description: "Keep docked tracker thoughts visible inside character cards.",
    aliases: ["tracker", "thoughts", "dock"],
    kind: "Toggle",
  },
  {
    id: "tracker-temperature-unit",
    sectionId: "roleplay-tracker",
    label: "Temperature unit",
    description: "Switch tracker temperature displays between Celsius and Fahrenheit.",
    aliases: ["tracker", "weather", "celsius", "fahrenheit"],
    kind: "Toggle",
  },
  {
    id: "roleplay-message-opacity",
    sectionId: "roleplay-messages",
    label: "Roleplay Messages Background Opacity",
    description: "Adjust roleplay bubble background opacity.",
    aliases: ["roleplay", "opacity", "messages"],
    kind: "Slider",
  },
  {
    id: "scrollable-avatars",
    sectionId: "roleplay-messages",
    label: "Scrollable Avatars",
    description: "Keep roleplay avatars visible while scrolling long messages.",
    aliases: ["roleplay", "avatars", "sticky"],
    kind: "Toggle",
  },
  {
    id: "roleplay-avatar-style",
    sectionId: "roleplay-messages",
    label: "Roleplay Avatars",
    description: "Choose how avatars sit next to roleplay messages.",
    aliases: ["avatar", "portrait", "circles", "rectangles"],
    kind: "Button group",
  },
  {
    id: "roleplay-avatar-scale",
    sectionId: "roleplay-messages",
    label: "Message avatar scale",
    description: "Adjust the default roleplay message avatar scale.",
    aliases: ["avatar", "portrait", "scale"],
    kind: "Slider",
  },
  {
    id: "roleplay-sprite-scale",
    sectionId: "roleplay-messages",
    label: "Default sprite scale",
    description: "Adjust the default roleplay sprite scale.",
    aliases: ["sprite", "scale", "roleplay"],
    kind: "Slider",
  },
  {
    id: "game-dialogue-portrait-scale",
    sectionId: "game-presentation",
    label: "Dialogue portrait scale",
    description: "Adjust Game mode dialogue portrait scale.",
    aliases: ["game", "avatar", "portrait", "scale"],
    kind: "Slider",
  },
  {
    id: "game-full-body-sprite-scale",
    sectionId: "game-presentation",
    label: "Full-body sprite scale",
    description: "Adjust Game mode full-body sprite scale.",
    aliases: ["game", "sprite", "scale"],
    kind: "Slider",
  },
  {
    id: "game-dialogue-display",
    sectionId: "game-presentation",
    label: "Game Dialogue Display",
    description: "Choose classic VN box or segment history display.",
    aliases: ["game", "vn", "history"],
    kind: "Button group",
  },
  {
    id: "weather-effects",
    sectionId: "motion-backgrounds",
    label: "Dynamic weather effects",
    description: "Show animated weather particles from story context.",
    aliases: ["weather", "rain", "snow", "fog"],
    kind: "Toggle",
  },
  {
    id: "release-channel",
    sectionId: "updates",
    label: "Release Channel",
    description: "Choose which release channel update checks follow.",
    aliases: ["updates", "branch", "version"],
    kind: "Select",
  },
  {
    id: "quick-replies",
    sectionId: "message-tools",
    label: "Quick replies",
    description: "Show alternate draft actions beside Send.",
    aliases: ["post only", "guide reply", "impersonate"],
    kind: "Toggle",
  },
  {
    id: "show-message-timestamps",
    sectionId: "message-tools",
    label: "Show message timestamps",
    description: "Display date and time on chat messages.",
    aliases: ["time", "date", "metadata"],
    kind: "Toggle",
  },
  {
    id: "show-model-name",
    sectionId: "message-tools",
    label: "Show model name on messages",
    description: "Display which AI model generated each response.",
    aliases: ["model", "metadata"],
    kind: "Toggle",
  },
  {
    id: "show-token-usage",
    sectionId: "message-tools",
    label: "Show token usage on messages",
    description: "Display prompt and completion token counts.",
    aliases: ["tokens", "context", "cost"],
    kind: "Toggle",
  },
  {
    id: "show-message-numbers",
    sectionId: "message-tools",
    label: "Show message numbers",
    description: "Display message numbers in chats.",
    aliases: ["metadata", "index"],
    kind: "Toggle",
  },
  {
    id: "guide-generations",
    sectionId: "message-tools",
    label: "Guide swipes/regens with chat input",
    description: "Use the current draft as regeneration direction.",
    aliases: ["guided", "regenerate", "swipes"],
    kind: "Toggle",
  },
  {
    id: "include-reasoning-in-exports",
    sectionId: "message-tools",
    label: "Include reasoning in exports",
    description: "Include hidden thinking metadata in chat exports.",
    aliases: ["reasoning", "thinking", "exports"],
    kind: "Toggle",
  },
  {
    id: "debug-mode",
    sectionId: "message-tools",
    label: "Debug mode",
    description: "Log model payloads in the server console.",
    aliases: ["debug", "logs", "prompt", "console"],
    kind: "Toggle",
  },
] as const;

const SETTINGS_BUTTON_CLASS = "mari-chrome-control mari-chrome-control--small text-[0.6875rem]";
const SETTINGS_PRIMARY_BUTTON_CLASS = "mari-chrome-control mari-chrome-control--primary text-xs";
const SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS =
  "mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected text-[0.625rem]";
const SETTINGS_INLINE_ACCENT_BUTTON_CLASS =
  "shrink-0 rounded-md border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--marinara-chat-chrome-button-text-active)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45";

type MarinaraAndroidBridge = {
  openConsole?: () => void;
};

function getMarinaraAndroidBridge(): MarinaraAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const nativeWindow = window as Window & { MarinaraAndroid?: MarinaraAndroidBridge };
  return nativeWindow.MarinaraAndroid ?? null;
}

function isMarinaraAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /\bMarinaraEngine\/Android\b/u.test(navigator.userAgent);
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

function searchSettings(query: string): SettingsSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const parts = normalized.split(/\s+/u).filter(Boolean);

  const controlResults = SETTINGS_SEARCHABLE_CONTROLS.flatMap((control) => {
    const section = SETTINGS_SECTION_BY_ID.get(control.sectionId);
    if (!section) return [];
    const haystack = [control.label, control.description, control.kind, section.label, section.description, ...control.aliases]
      .join(" ")
      .toLowerCase();
    return parts.every((part) => haystack.includes(part)) ? [{ type: "control" as const, control, section }] : [];
  });

  const sectionResults = SETTINGS_SECTIONS.filter((section) => {
    const haystack = [section.label, section.description, ...section.aliases].join(" ").toLowerCase();
    return parts.every((part) => haystack.includes(part));
  }).map((section) => ({ type: "section" as const, section }));

  return [...controlResults, ...sectionResults];
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

async function readSettingsResponseError(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as { error?: unknown; message?: unknown };
      const message = typeof payload.message === "string" ? payload.message : payload.error;
      return typeof message === "string" && message.trim() ? message : fallback;
    }

    const text = (await res.text()).trim();
    return text ? text.slice(0, 500) : fallback;
  } catch {
    return fallback;
  }
}

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

const GAME_DIALOGUE_DISPLAY_OPTIONS: Array<{ id: GameDialogueDisplayMode; label: string; desc: string }> = [
  {
    id: "classic",
    label: "Classic VN",
    desc: "One active segment in the VN box, with logs available from the Logs button.",
  },
  {
    id: "stacked",
    label: "History Above VN",
    desc: "Shows prior segments above the VN box and keeps the full session scrollable there.",
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
  { id: "straight", label: "Straight", sample: '"Hello", it\'s me.' },
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

// Module-level set survives component remounts (e.g. mobile AnimatePresence unmount/remount)
const mountedSettingsTabs = new Set<string>();
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
        <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">Pixels, clamped from 64 to 4096.</div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:w-40">
        <DraftNumberInput
          value={width}
          min={64}
          max={4096}
          commitOnValidChange
          onCommit={(nextWidth) => onCommit(nextWidth, height)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
        />
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">x</span>
        <DraftNumberInput
          value={height}
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
              Default style
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
            <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Editing</span>
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
          <button
            type="button"
            onClick={cloneSelected}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
          >
            <Plus size="0.75rem" />
            Clone
          </button>
          <button
            type="button"
            onClick={resetSelected}
            disabled={!selected.builtIn}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size="0.75rem" />
            Reset
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selected.builtIn || settings.profiles.length <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 size="0.75rem" />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="min-w-0">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Name</span>
          <input
            value={selected.name}
            onChange={(event) => updateSelected({ name: event.target.value })}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Prompt grammar</span>
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
        <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Style text</span>
        <textarea
          value={selected.styleText}
          onChange={(event) => updateSelected({ styleText: event.target.value })}
          className="min-h-20 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
        />
      </label>

      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Positive tags</span>
          <textarea
            value={selected.positiveTags}
            onChange={(event) => updateSelected({ positiveTags: event.target.value })}
            className="min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Negative tags</span>
          <textarea
            value={selected.negativeTags}
            onChange={(event) => updateSelected({ negativeTags: event.target.value })}
            className="min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
          />
        </label>
      </div>

      <details className="mt-3 rounded-md bg-[var(--secondary)]/55 p-2.5 ring-1 ring-[var(--border)]">
        <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">Per-image tags</summary>
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
        <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">Test bench</summary>
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">Image kind</span>
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
                Sample input
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
                ? `${cleanupCount} duplicate or misplaced fragment${cleanupCount === 1 ? "" : "s"} cleaned.`
                : "No cleanup needed for this sample."}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                Final positive prompt
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
                Final negative prompt
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
          <span className="truncate">Card order</span>
          <span className="shrink-0 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] font-normal text-[var(--muted-foreground)]">
            {isDefaultOrder ? "Default" : "Custom"}
          </span>
        </button>
        <HelpTooltip text="Controls the top-to-bottom order of tracker cards when their matching tracker agents are enabled for a chat." />
        <button
          type="button"
          onClick={() => setTrackerPanelSectionOrder([...TRACKER_DATA_PANEL_SECTIONS])}
          disabled={isDefaultOrder}
          title="Reset tracker card order"
          aria-label="Reset tracker card order"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--secondary)] hover:text-[var(--foreground)] active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
        >
          <RotateCcw size="0.6875rem" />
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
                title={option.desc}
              >
                <div className="min-w-0">
                  <div className="truncate text-[0.6875rem] font-medium leading-4 text-[var(--foreground)]">
                    {option.label}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveCard(section, -1)}
                    disabled={index === 0}
                    title={`Move ${option.label} up`}
                    aria-label={`Move ${option.label} up`}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--background)] hover:text-[var(--primary)] active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
                  >
                    <ArrowUp size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCard(section, 1)}
                    disabled={index === orderedSections.length - 1}
                    title={`Move ${option.label} down`}
                    aria-label={`Move ${option.label} down`}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--background)] hover:text-[var(--primary)] active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
                  >
                    <ArrowDown size="0.6875rem" />
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

function TrackerPanelAppearanceDrawer({
  trackerPanelEnabled,
  setTrackerPanelEnabled,
  trackerPanelHideHudWidgets,
  setTrackerPanelHideHudWidgets,
  trackerPanelUseExpressionSprites,
  setTrackerPanelUseExpressionSprites,
  trackerPanelThoughtBubbleDisplay,
  setTrackerPanelThoughtBubbleDisplay,
  trackerPanelDockedThoughtsAlwaysVisible,
  setTrackerPanelDockedThoughtsAlwaysVisible,
  trackerPanelSizeProfile,
  setTrackerPanelSizeProfile,
  trackerPanelBackgroundColor,
  setTrackerPanelBackgroundColor,
  trackerTemperatureUnit,
  setTrackerTemperatureUnit,
}: {
  trackerPanelEnabled: boolean;
  setTrackerPanelEnabled: (enabled: boolean) => void;
  trackerPanelHideHudWidgets: boolean;
  setTrackerPanelHideHudWidgets: (hidden: boolean) => void;
  trackerPanelUseExpressionSprites: boolean;
  setTrackerPanelUseExpressionSprites: (enabled: boolean) => void;
  trackerPanelThoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  setTrackerPanelThoughtBubbleDisplay: (display: TrackerThoughtBubbleDisplay) => void;
  trackerPanelDockedThoughtsAlwaysVisible: boolean;
  setTrackerPanelDockedThoughtsAlwaysVisible: (visible: boolean) => void;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  setTrackerPanelSizeProfile: (profile: TrackerPanelSizeProfile) => void;
  trackerPanelBackgroundColor: string;
  setTrackerPanelBackgroundColor: (color: string) => void;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  setTrackerTemperatureUnit: (unit: TrackerTemperatureUnit) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const drawerId = React.useId();

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/34 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]/70 text-[var(--primary)] ring-1 ring-[var(--border)]">
            <TrackerPanelIcon size="0.9rem" strokeWidth={1.95} />
          </span>
          <span className="min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]">
              Tracker Panel
              <HelpTooltip text="Controls the Roleplay HUD side panel for the fixed tracker board." />
            </span>
            <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {trackerPanelEnabled ? "Shown in the Roleplay HUD" : "Hidden from the Roleplay HUD"}
            </span>
          </span>
        </div>

        <SettingsSwitch
          anchorId={getSettingsControlAnchorId("tracker-panel")}
          checked={trackerPanelEnabled}
          onChange={(enabled) => {
            setTrackerPanelEnabled(enabled);
            if (enabled) setDrawerOpen(true);
          }}
          ariaLabel={trackerPanelEnabled ? "Disable Tracker Panel" : "Enable Tracker Panel"}
          className="p-0 hover:bg-transparent"
        />

        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          aria-label={drawerOpen ? "Collapse Tracker Panel settings" : "Expand Tracker Panel settings"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-all hover:bg-[var(--secondary)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] active:scale-95"
        >
          <ChevronDown
            size="0.875rem"
            className={cn("transition-transform duration-200", drawerOpen ? "rotate-180" : "rotate-0")}
          />
        </button>
      </div>

      {drawerOpen && (
        <fieldset
          id={drawerId}
          disabled={!trackerPanelEnabled}
          className={cn(
            "border-t border-[var(--border)] px-3 pb-3 pt-2 transition-opacity",
            trackerPanelEnabled ? "" : "opacity-45",
          )}
        >
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("tracker-replace-hud-icons")}
            label="Replace tracker HUD icons"
            checked={trackerPanelHideHudWidgets}
            onChange={setTrackerPanelHideHudWidgets}
            help="Hides the old world/player tracker icon strip so the Tracker panel can dock to the edge. The Agents button stays visible."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("tracker-expression-sprites")}
            label="Use expression sprites for tracker portraits"
            checked={trackerPanelUseExpressionSprites}
            onChange={setTrackerPanelUseExpressionSprites}
            help="When on, tracker portraits can switch to Expression Engine sprites if that agent is enabled for the chat and the character has matching sprite images."
          />
          <div id={getSettingsControlAnchorId("tracker-panel-background")} className="mt-2 scroll-mt-3">
            <ColorPicker
              value={trackerPanelBackgroundColor}
              onChange={setTrackerPanelBackgroundColor}
              gradient
              compact
              label="Panel background"
              helpText="Pick the Tracker panel and tracker section background. CSS colors and gradients are accepted."
              emptyText={`Default ${TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR}`}
              clearLabel="Reset"
            />
          </div>
          <div id={getSettingsControlAnchorId("tracker-desktop-size")} className="mt-2 grid scroll-mt-3 gap-1.5">
            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
              Desktop size
              <HelpTooltip text="Choose the designed desktop width for the Tracker panel. Compact favors quick scanning, Standard balances density, and Expanded gives character cards more room." />
            </span>
            <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-0.5">
              {TRACKER_PANEL_SIZE_PROFILE_OPTIONS.map((opt) => {
                const selected = trackerPanelSizeProfile === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTrackerPanelSizeProfile(opt.id)}
                    aria-pressed={selected}
                    title={`${opt.label}: ${getTrackerPanelWidthForProfile(opt.id)}px. ${opt.desc}`}
                    className={cn(
                      "flex min-h-8 min-w-0 items-center justify-center rounded-md px-1.5 text-[0.6875rem] transition-all disabled:cursor-not-allowed",
                      selected
                        ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/45"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <span className={cn("inline-flex", selected && "text-[var(--primary)]")}>
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
              Thought display mode
              <HelpTooltip text="Choose whether featured character thoughts open inside the tracker card or float beside the portrait. This no longer changes automatically when the panel width changes." />
            </span>
            <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-0.5">
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
                    className={cn(
                      "flex min-h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[0.6875rem] transition-all disabled:cursor-not-allowed",
                      selected
                        ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/45"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Icon size="0.75rem" className={selected ? "text-[var(--primary)]" : ""} />
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("tracker-docked-thoughts")}
            label="Always show Docked thoughts"
            checked={trackerPanelDockedThoughtsAlwaysVisible}
            onChange={setTrackerPanelDockedThoughtsAlwaysVisible}
            help="When Thought display mode is Docked, every featured character's thought stays visible inside the tracker card instead of waiting for the per-card thought button."
          />
          <div
            id={getSettingsControlAnchorId("tracker-temperature-unit")}
            className="mt-2 flex scroll-mt-3 min-h-8 items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
              Temperature unit
              <HelpTooltip text="Changes Tracker Panel and roleplay HUD temperature displays without rewriting the saved world-state temperature." />
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={trackerTemperatureUnit === "fahrenheit"}
              aria-label={`Tracker temperature unit: ${trackerTemperatureUnit === "celsius" ? "Celsius" : "Fahrenheit"}`}
              title={
                trackerTemperatureUnit === "celsius"
                  ? "Showing tracker temperatures as °C. Click for °F."
                  : "Showing tracker temperatures as °F. Click for °C."
              }
              onClick={() => setTrackerTemperatureUnit(trackerTemperatureUnit === "celsius" ? "fahrenheit" : "celsius")}
              className="relative grid h-7 w-[4.75rem] shrink-0 grid-cols-2 items-center rounded-full border border-[var(--border)] bg-[var(--secondary)]/55 p-0.5 text-[0.625rem] font-semibold transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            >
              <span
                className={cn(
                  "absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-[var(--primary)]/16 ring-1 ring-[var(--primary)]/45 transition-transform",
                  trackerTemperatureUnit === "fahrenheit" && "translate-x-full",
                )}
              />
              <span
                className={cn(
                  "relative z-10 text-center transition-colors",
                  trackerTemperatureUnit === "celsius" ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                )}
              >
                °C
              </span>
              <span
                className={cn(
                  "relative z-10 text-center transition-colors",
                  trackerTemperatureUnit === "fahrenheit"
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]",
                )}
              >
                °F
              </span>
            </button>
          </div>
          <TrackerPanelCardOrderSetting />
          <TrackerCardColorSettings />
        </fieldset>
      )}
    </section>
  );
}

export function SettingsPanel() {
  const rawSettingsTab = useUIStore((s) => s.settingsTab);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const settingsTab = normalizeSettingsTab(rawSettingsTab);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (rawSettingsTab !== settingsTab) {
      setSettingsTab(settingsTab);
    }
  }, [rawSettingsTab, setSettingsTab, settingsTab]);

  mountedSettingsTabs.add(settingsTab);

  const activeSections = SETTINGS_SECTIONS.filter((section) => section.tab === settingsTab);
  const searchResults = searchSettings(settingsSearch);

  const jumpToSection = useCallback(
    (section: SettingsSectionMeta) => {
      setSettingsTab(section.tab);
      mountedSettingsTabs.add(section.tab);
      window.requestAnimationFrame(() => {
        const panel = activePanelRef.current;
        const target = document.getElementById(getSettingsSectionAnchorId(section.id));
        if (!panel || !target) return;
        panel.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
      });
    },
    [setSettingsTab],
  );

  const jumpToSearchResult = useCallback(
    (result: SettingsSearchResult) => {
      const section = result.section;
      const targetId =
        result.type === "control" ? getSettingsControlAnchorId(result.control.id) : getSettingsSectionAnchorId(section.id);
      setSettingsTab(section.tab);
      mountedSettingsTabs.add(section.tab);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const panel = activePanelRef.current;
          const target = document.getElementById(targetId) ?? document.getElementById(getSettingsSectionAnchorId(section.id));
          if (!panel || !target) return;
          panel.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
          const focusTarget = target.querySelector<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          focusTarget?.focus({ preventScroll: true });
        });
      });
    },
    [setSettingsTab],
  );

  return (
    <div className="mari-settings-panel-chrome flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)]/70 p-2.5">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search
              size="0.875rem"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              placeholder="Search settings"
              className="mari-chrome-field h-9 w-full rounded-lg pl-8 pr-8 text-xs"
            />
            {settingsSearch && (
              <button
                type="button"
                onClick={() => setSettingsSearch("")}
                aria-label="Clear settings search"
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
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
                  const label = result.type === "control" ? result.control.label : section.label;
                  const description = result.type === "control" ? result.control.description : section.description;
                  return (
                    <button
                      key={`${result.type}-${result.type === "control" ? result.control.id : section.id}`}
                      type="button"
                      onClick={() => jumpToSearchResult(result)}
                      className="grid min-w-0 gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--secondary)]/70"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-[var(--foreground)]">{label}</span>
                        <span className="shrink-0 rounded-full border border-[var(--border)]/70 px-1.5 py-px text-[0.5625rem] font-medium text-[var(--muted-foreground)]">
                          {result.type === "control" ? result.control.kind : "Section"}
                        </span>
                      </span>
                      <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {tab?.label ?? "Settings"} / {section.label} / {description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-2 text-[0.625rem] text-[var(--muted-foreground)]">No matching settings.</div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--border)]/70 px-2.5 py-1.5">
        <div
          role="tablist"
          aria-label="Settings categories"
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
                  "group relative isolate flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-1 py-0.5 text-center text-[0.625rem] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40",
                  active
                    ? "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_11%,transparent)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)]/80 hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]",
                )}
                title={tab.description}
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
                <span className="w-full min-w-0 break-words px-0.5">{tab.label}</span>
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
                className={cn(
                  "flex min-h-6 max-w-full items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[0.625rem] font-semibold transition-colors",
                  quickAccessOpen
                    ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]",
                )}
                title={quickAccessOpen ? "Collapse Quick Access" : "Expand Quick Access"}
              >
                <Tag size="0.6875rem" className="shrink-0" />
                <span className="max-w-full truncate">Quick Access ({activeSections.length})</span>
                <ChevronDown
                  size="0.625rem"
                  className={cn("shrink-0 transition-transform", quickAccessOpen ? "rotate-180" : "")}
                />
              </button>
              {quickAccessOpen &&
                activeSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section)}
                    className="flex min-h-6 max-w-full min-w-0 items-center rounded-lg border border-[var(--border)]/65 bg-[var(--secondary)]/38 px-1.5 py-0.5 text-[0.625rem] font-semibold leading-tight text-[var(--muted-foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_7%,transparent)] transition-all hover:border-[var(--primary)]/35 hover:bg-[var(--primary)]/11 hover:text-[var(--foreground)]"
                    title={`${section.label}: ${section.description}`}
                  >
                    <span className="block max-w-full break-words">{section.label}</span>
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
            <div
              key={tab.id}
              id={`settings-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`settings-tab-${tab.id}`}
              hidden={!active}
              ref={active ? activePanelRef : undefined}
              className="absolute inset-0 overflow-y-auto p-3"
              style={active ? undefined : { clipPath: "inset(100%)", pointerEvents: "none" }}
            >
              <Comp />
            </div>
          );
        })}
      </div>
    </div>
  );
}
function GeneralSettings() {
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const enableStreaming = useUIStore((s) => s.enableStreaming);
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
  const confirmBeforeDelete = useUIStore((s) => s.confirmBeforeDelete);
  const setConfirmBeforeDelete = useUIStore((s) => s.setConfirmBeforeDelete);
  const achievementsEnabled = useUIStore((s) => s.achievementsEnabled);
  const setAchievementsEnabled = useUIStore((s) => s.setAchievementsEnabled);
  const messagesPerPage = useUIStore((s) => s.messagesPerPage);
  const setMessagesPerPage = useUIStore((s) => s.setMessagesPerPage);
  const boldDialogue = useUIStore((s) => s.boldDialogue);
  const setBoldDialogue = useUIStore((s) => s.setBoldDialogue);
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const setQuoteFormat = useUIStore((s) => s.setQuoteFormat);
  const convertLatexSymbols = useUIStore((s) => s.convertLatexSymbols);
  const setConvertLatexSymbols = useUIStore((s) => s.setConvertLatexSymbols);
  const trimIncompleteModelOutput = useUIStore((s) => s.trimIncompleteModelOutput);
  const setTrimIncompleteModelOutput = useUIStore((s) => s.setTrimIncompleteModelOutput);
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const setSpeechToTextEnabled = useUIStore((s) => s.setSpeechToTextEnabled);
  const chibiProfessorMariEnabled = useUIStore((s) => s.chibiProfessorMariEnabled);
  const setChibiProfessorMariEnabled = useUIStore((s) => s.setChibiProfessorMariEnabled);
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
      <SettingsIntro>Core app behavior, ordered from daily controls to mode-specific tuning.</SettingsIntro>

      <SettingsSection
        title="App Behavior"
        description="Language, safety confirmations, achievements, music, and playful extras."
        icon={<Power size="0.875rem" />}
        {...getSettingsSectionAnchorProps("application")}
      >
        <div className="flex flex-col gap-2.5">
          <label id={getSettingsControlAnchorId("language")} className="flex scroll-mt-3 flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              Language
              <HelpTooltip text="Choose the app language. Only English is available right now, but this setting is persisted so future translation PRs can extend it cleanly." />
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as (typeof APP_LANGUAGE_OPTIONS)[number]["id"])}
              className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
            >
              {APP_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              English is the only bundled language for now. Future translations can add more options here without
              changing the settings shape.
            </p>
          </label>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("confirm-before-delete")}
            label="Confirm before deleting"
            checked={confirmBeforeDelete}
            onChange={setConfirmBeforeDelete}
            help="Shows a confirmation dialog before permanently deleting chats, characters, or other items. Recommended to keep on."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("achievements")}
            label="Achievements"
            checked={achievementsEnabled}
            onChange={setAchievementsEnabled}
            help="Shows the Home achievements button and unlock notifications. Tracking stays silent in the current profile when this is off."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("music-player")}
            label="Music Player"
            checked={musicPlayerEnabled}
            onChange={setMusicPlayerEnabled}
            help="Shows the compact Music Player. Switch between Spotify and YouTube from the player itself or the Music DJ agent settings."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("mini-mari")}
            label="Mini Mari surprise visits"
            checked={chibiProfessorMariEnabled}
            onChange={setChibiProfessorMariEnabled}
            help="Allows the rare Chibi Professor Mari message to appear while scrolling. Turn this off if it gets in the way of settings or other workflows."
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Notification sounds and browser notifications by mode."
        icon={<Bell size="0.875rem" />}
        {...getSettingsSectionAnchorProps("notifications")}
      >
        <ConversationSoundSetting />
      </SettingsSection>

      <SettingsSection
        title="Responses"
        description="How replies arrive, save, and paginate."
        icon={<MessageCircle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("responses")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("enable-streaming")}
            label="Enable streaming"
            checked={enableStreaming}
            onChange={setEnableStreaming}
            help="When on, AI responses appear word-by-word as they're generated. When off, the full response appears at once after completion."
          />

          <label
            id={getSettingsControlAnchorId("streaming-speed")}
            className={cn(
              "flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors",
              enableStreaming ? "hover:bg-[var(--secondary)]/50" : "opacity-40 pointer-events-none",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">Streaming speed</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{streamingSpeed}</span>
              <HelpTooltip text="How fast streaming tokens appear on screen. Lower values give a slower typewriter effect so you can read along. Higher values show text almost instantly." />
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
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </label>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("trim-incomplete-output")}
            label="Trim incomplete model endings"
            checked={trimIncompleteModelOutput}
            onChange={setTrimIncompleteModelOutput}
            help="When on, Marinara trims a trailing unfinished sentence from AI responses before saving the message. It leaves complete responses and command-only endings alone."
          />

          <label
            id={getSettingsControlAnchorId("messages-per-page")}
            className="flex scroll-mt-3 flex-wrap items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50"
          >
            <span className="text-xs">Messages per page</span>
            <HelpTooltip text="How many messages to load at a time. Click 'Load More' in the chat to see older messages. Set to 0 to load all messages at once." />
            <DraftNumberInput
              value={messagesPerPage}
              min={0}
              max={500}
              commitOnValidChange
              onCommit={(nextValue) => setMessagesPerPage(Math.max(0, Math.min(500, nextValue)))}
              className="w-16 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Input & Editing"
        description="Message input behavior and fast edit controls."
        icon={<UserCheck size="0.875rem" />}
        {...getSettingsSectionAnchorProps("input-editing")}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50">
            <div className="flex items-center gap-2">
              <span className="text-xs">Send on Enter</span>
              <HelpTooltip text="Choose which chat modes send on Enter. When off, Enter creates a new line and you have to press the send button manually." />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setEnterToSendRP(!enterToSendRP)}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                  enterToSendRP
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                Roleplay
              </button>
              <button
                onClick={() => setEnterToSendConvo(!enterToSendConvo)}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                  enterToSendConvo
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                Conversations
              </button>
              <button
                onClick={() => setEnterToSendGame(!enterToSendGame)}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                  enterToSendGame
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                Game
              </button>
            </div>
          </div>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("speech-to-text")}
            label="Speech-to-text microphone"
            checked={speechToTextEnabled}
            onChange={setSpeechToTextEnabled}
            help="When on, chat input bars show a microphone button for browser dictation. Handy still works independently by pasting into the focused input field."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("intuitive-swipe-navigation")}
            label="Intuitive swipe navigation"
            checked={intuitiveSwipeNavigation}
            onChange={setIntuitiveSwipeNavigation}
            help="In Conversation and Roleplay modes, use Left/Right Arrow on desktop or horizontal touch swipes on mobile to move between alternate generations on the latest assistant message."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("reroll-past-newest-swipe")}
            label="Reroll past the newest swipe"
            checked={intuitiveSwipeRerollLatest}
            onChange={setIntuitiveSwipeRerollLatest}
            disabled={!intuitiveSwipeNavigation}
            help="When intuitive swipes are enabled, pressing Right Arrow or swiping left on the newest swipe of the latest assistant message creates a new reroll."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("up-arrow-edits-last-message")}
            label="Up Arrow edits last message"
            checked={editLastMessageOnArrowUp}
            onChange={setEditLastMessageOnArrowUp}
            help="In Conversation and Roleplay modes, press Up Arrow while the chat input is empty to open the most recent message in the chat for editing — whether it's yours or the AI's."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("double-click-edits-messages")}
            label="Double-click edits messages"
            checked={editMessageOnDoubleClick}
            onChange={setEditMessageOnDoubleClick}
            help="When on, double-click or double-tap a Roleplay message to open it for editing. Turn it off to avoid accidental edits; edit buttons and keyboard shortcuts still work."
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Text Rules"
        description="Formatting applied to chat text."
        icon={<FileText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("text-rules")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("bold-dialogue")}
            label="Bold dialogue in quotes"
            checked={boldDialogue ?? true}
            onChange={setBoldDialogue}
            help={
              'When on, text inside dialogue quotation marks ("like this", 「like this」, or 『like this』) is bolded in addition to its dialogue highlight color. Turn it off to keep the color without bold.'
            }
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("convert-latex-symbols")}
            label="Convert LaTeX symbols"
            checked={convertLatexSymbols}
            onChange={setConvertLatexSymbols}
            help="Turns common model-written LaTeX commands like \\rightarrow, \\neq, \\times, and \\alpha into regular symbols while leaving code snippets alone. This is display-only; saved messages keep their original text."
          />

          <div
            id={getSettingsControlAnchorId("quote-style")}
            className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">Quote style</span>
              <HelpTooltip text="Choose how straight and smart quotation marks are unified in chat inputs and displayed AI output." />
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
                    className={cn(
                      "flex min-w-0 flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all ring-1",
                      active
                        ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/35"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="max-w-full truncate text-[0.625rem] opacity-80">{option.sample}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Game Playback"
        description="Game mode reading and navigation."
        icon={<ScrollText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("game-playback")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("game-instant-text-reveal")}
            label="Instantly reveal game text"
            checked={gameInstantTextReveal}
            onChange={setGameInstantTextReveal}
            help="When enabled, Game mode narration segments appear fully as soon as you enter them. This skips the typewriter effect and hides the narration speed control."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("game-middle-mouse-navigation")}
            label="Mouse-wheel + click navigation"
            checked={gameMiddleMouseNav}
            onChange={setGameMiddleMouseNav}
            help="In Game mode, scroll the mouse wheel up to step back through past assistant turns and down to step forward. Clicking the scene background acts like the Next button. While reviewing the past, Next becomes Return — clicking the background or pressing Return jumps you back to where you were reading."
          />

          {!gameInstantTextReveal && (
            <label
              id={getSettingsControlAnchorId("game-narration-speed")}
              className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">Game narration speed</span>
                <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{gameTextSpeed}</span>
                <HelpTooltip text="How fast the typewriter effect displays narration text in Game mode. Lower values give a slower cinematic reveal. Higher values show text almost instantly." />
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
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </label>
          )}

          <label
            id={getSettingsControlAnchorId("game-auto-play-delay")}
            className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">Game auto-play segment delay</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                {(gameAutoPlayDelay / 1000).toFixed(1)}s
              </span>
              <HelpTooltip text="Pause between each narration segment when auto-play is enabled in Game mode. Enable auto-play via the ▶ button next to Next." />
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
              <span>Short</span>
              <span>Long</span>
            </div>
          </label>
        </div>
      </SettingsSection>
    </div>
  );
}

function ImageGenerationSettings() {
  const queueImageGenerationRequests = useUIStore((s) => s.queueImageGenerationRequests);
  const setQueueImageGenerationRequests = useUIStore((s) => s.setQueueImageGenerationRequests);
  const reviewImagePromptsBeforeSend = useUIStore((s) => s.reviewImagePromptsBeforeSend);
  const setReviewImagePromptsBeforeSend = useUIStore((s) => s.setReviewImagePromptsBeforeSend);
  const imageBackgroundWidth = useUIStore((s) => s.imageBackgroundWidth);
  const imageBackgroundHeight = useUIStore((s) => s.imageBackgroundHeight);
  const setImageBackgroundDimensions = useUIStore((s) => s.setImageBackgroundDimensions);
  const imageIllustrationWidth = useUIStore((s) => s.imageIllustrationWidth);
  const imageIllustrationHeight = useUIStore((s) => s.imageIllustrationHeight);
  const setImageIllustrationDimensions = useUIStore((s) => s.setImageIllustrationDimensions);
  const imagePortraitWidth = useUIStore((s) => s.imagePortraitWidth);
  const imagePortraitHeight = useUIStore((s) => s.imagePortraitHeight);
  const setImagePortraitDimensions = useUIStore((s) => s.setImagePortraitDimensions);
  const imageSelfieWidth = useUIStore((s) => s.imageSelfieWidth);
  const imageSelfieHeight = useUIStore((s) => s.imageSelfieHeight);
  const setImageSelfieDimensions = useUIStore((s) => s.setImageSelfieDimensions);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const setImageStyleProfiles = useUIStore((s) => s.setImageStyleProfiles);

  return (
    <SettingsSection
      title="Image Generation"
      description="Review generated prompts, set image canvas defaults, and tune prompt style profiles."
      icon={<Image size="0.875rem" />}
      {...getSettingsSectionAnchorProps("image-generation")}
    >
      <div className="flex flex-col gap-2.5">
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("queue-image-generation")}
          label="Queue image generation requests"
          checked={queueImageGenerationRequests}
          onChange={setQueueImageGenerationRequests}
          help="Sends image generation jobs one at a time. Keep this on for providers that reject simultaneous background, illustration, or portrait requests."
        />
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("image-prompt-review")}
          label="Expose image prompts before sending"
          checked={reviewImagePromptsBeforeSend}
          onChange={setReviewImagePromptsBeforeSend}
          help="Shows generated image prompts for review before sending Game assets, character or persona avatars, and sprite generations to the image provider."
        />

        <ImageDimensionRow
          controlId="image-background-size"
          label="Backgrounds"
          help="Used for Roleplay and Game generated scene backgrounds."
          width={imageBackgroundWidth}
          height={imageBackgroundHeight}
          onCommit={setImageBackgroundDimensions}
        />
        <ImageDimensionRow
          controlId="image-illustration-size"
          label="Illustrations"
          help="Used for Illustrator agent images saved to chat galleries, including comic pages and scene illustrations."
          width={imageIllustrationWidth}
          height={imageIllustrationHeight}
          onCommit={setImageIllustrationDimensions}
        />
        <ImageDimensionRow
          controlId="image-portrait-size"
          label="Portraits"
          help="Used for generated character and NPC portraits."
          width={imagePortraitWidth}
          height={imagePortraitHeight}
          onCommit={setImagePortraitDimensions}
        />
        <ImageDimensionRow
          controlId="image-selfie-size"
          label="Selfies"
          help="Default selfie canvas for Roleplay and Conversation image commands when a chat does not override selfie resolution."
          width={imageSelfieWidth}
          height={imageSelfieHeight}
          onCommit={setImageSelfieDimensions}
        />

        <div id={getSettingsControlAnchorId("image-style-profiles")} className="mt-1 scroll-mt-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
            Style Profiles
            <HelpTooltip text="Defines what Anime, Danbooru, Realistic, and custom styles mean when Marinara compiles image prompts. Profiles merge with per-chat and connection settings, then clean duplicate tags before sending." />
          </div>
          <ImageStyleProfilesEditor value={imageStyleProfiles} onChange={setImageStyleProfiles} />
        </div>
      </div>
    </SettingsSection>
  );
}

type AppSettingsValueResponse = { value: string | null };

const VIDEO_GENERATION_SETTINGS_QUERY_KEY = ["app-settings", VIDEO_GENERATION_SETTINGS_KEY] as const;

function serializeVideoGenerationSettings(settings: VideoGenerationUserSettings): string {
  return JSON.stringify(normalizeVideoGenerationUserSettings(settings));
}

function VideoGenerationSettings() {
  const qc = useQueryClient();
  const videoSettingsQuery = useQuery<AppSettingsValueResponse>({
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

  const saveVideoSettings = useMutation<AppSettingsValueResponse, Error, VideoGenerationUserSettings>({
    mutationFn: (next) =>
      api.put<AppSettingsValueResponse>(`/app-settings/${VIDEO_GENERATION_SETTINGS_KEY}`, {
        value: serializeVideoGenerationSettings(next),
      }),
    onSuccess: (data) => {
      qc.setQueryData(VIDEO_GENERATION_SETTINGS_QUERY_KEY, data);
    },
    onError: (err) => {
      setDraft(savedSettings);
      toast.error(err.message || "Failed to save video generation settings.");
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
      title="Video Generation"
      description="Set default clip lengths and edit reusable video prompts for Game, Gallery, and Conversation Calls."
      icon={<Film size="0.875rem" />}
      {...getSettingsSectionAnchorProps("video-generation")}
    >
      {videoSettingsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--background)]/55 px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          <Loader2 size="0.8125rem" className="animate-spin" />
          Loading video settings…
        </div>
      ) : videoSettingsQuery.isError ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-xs text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20">
          <AlertTriangle size="0.8125rem" className="shrink-0" />
          Could not load video settings.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            id={getSettingsControlAnchorId("video-scene-duration")}
            className="grid scroll-mt-3 gap-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                Scene video fallback length
                <HelpTooltip text="Used by Game and Gallery scene videos when the selected Default for Videos connection does not define its own duration defaults." />
              </div>
              <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Seconds, clamped from {VIDEO_SCENE_DURATION_MIN} to {VIDEO_SCENE_DURATION_MAX}.
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
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">s</span>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
              Conversation Call Clips
              <HelpTooltip text="Lengths for generated character video-call presence clips. Idle and talking loops are used continuously, while reaction clips play briefly before returning to idle." />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.map((kind) => (
                <label
                  key={kind}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-[var(--secondary)]/60 px-2.5 py-2 ring-1 ring-[var(--border)]/80"
                >
                  <span className="truncate text-xs text-[var(--foreground)]">
                    {CONVERSATION_CALL_VIDEO_CLIP_LABELS[kind]}
                  </span>
                  <span className="grid w-20 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                    <DraftNumberInput
                      value={draft.callClipDurations[kind]}
                      min={VIDEO_CALL_CLIP_DURATION_MIN}
                      max={VIDEO_CALL_CLIP_DURATION_MAX}
                      onCommit={(duration) => handleCallClipDurationChange(kind, duration)}
                      className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                      ariaLabel={`${CONVERSATION_CALL_VIDEO_CLIP_LABELS[kind]} length in seconds`}
                    />
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">s</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-2 flex min-w-0 items-center justify-between gap-3 rounded-md bg-[var(--secondary)]/60 px-2.5 py-2 ring-1 ring-[var(--border)]/80">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs text-[var(--foreground)]">Custom request</span>
                <span className="text-[0.55rem] leading-snug text-[var(--muted-foreground)]">
                  Used for one-off clips characters generate from explicit call requests.
                </span>
              </span>
              <span className="grid w-20 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                <DraftNumberInput
                  value={draft.callCustomClipDurationSeconds}
                  min={VIDEO_CALL_CLIP_DURATION_MIN}
                  max={VIDEO_CALL_CLIP_DURATION_MAX}
                  onCommit={handleCustomClipDurationChange}
                  className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  ariaLabel="Custom call clip length in seconds"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">s</span>
              </span>
            </label>
            <div className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
              Call clips are clamped from {VIDEO_CALL_CLIP_DURATION_MIN} to {VIDEO_CALL_CLIP_DURATION_MAX} seconds.
              {saveVideoSettings.isPending ? " Saving…" : ""}
            </div>
          </div>

          <div
            id={getSettingsControlAnchorId("video-animated-expression-duration")}
            className="grid scroll-mt-3 gap-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                Animated expression length
                <HelpTooltip text="Used by Expression Engine animated portrait generation before the clip is converted to a looping GIF sprite." />
              </div>
              <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Seconds, clamped from {VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN} to{" "}
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
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">s</span>
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

function GameAssetsSettings() {
  const rescanGameAssets = useGameAssetStore((s) => s.rescanAssets);
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
        if (error instanceof Error && error.message === HOST_DEVICE_FILE_MANAGER_MESSAGE) return;
        toast.error("Failed to open game assets folder.");
      },
    });
  };

  const handleGameAssetUpload = async () => {
    if (assetUploading) return;
    if (assetFiles.length === 0) {
      toast.error("Choose at least one asset file first.");
      return;
    }
    const folder = assetSubcategory.trim().replace(/^\/+|\/+$/g, "") || assetCategoryMeta.defaultFolder;
    if (folder.includes("..") || folder.includes("\\") || folder.startsWith("/")) {
      toast.error("Folder names cannot contain path traversal.");
      return;
    }

    const tooLarge = assetFiles.find((file) => file.size > 50 * 1024 * 1024);
    if (tooLarge) {
      toast.error(`${tooLarge.name} is too large. Game assets are limited to 50 MB each.`);
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
      await rescanGameAssets();
      if (succeeded > 0) {
        toast.success(`Uploaded ${succeeded} game asset${succeeded === 1 ? "" : "s"}.`);
      }
      if (failed > 0) {
        const reason = uploads.find((result) => result.status === "rejected");
        toast.error(
          reason?.status === "rejected" && reason.reason instanceof Error
            ? reason.reason.message
            : `${failed} asset upload${failed === 1 ? "" : "s"} failed.`,
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
      title="Game Assets"
      description="Open existing asset folders, import new files, and refresh the server manifest."
      icon={<FolderOpen size="0.875rem" />}
      {...getSettingsSectionAnchorProps("game-assets")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <button
            onClick={openGameAssetsBrowser}
            className="mari-chrome-control mari-chrome-control--primary w-full gap-2 text-xs"
            title="Open Asset Browser"
          >
            <Image size="0.75rem" />
            Asset Browser
          </button>
          <button
            onClick={() => {
              rescanGameAssets()
                .then(() => toast.success("Game assets rescanned."))
                .catch(() => toast.error("Failed to rescan game assets."));
            }}
            className={cn(SETTINGS_BUTTON_CLASS, "w-full justify-center")}
          >
            <RefreshCw size="0.75rem" />
            Rescan
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {GAME_ASSET_CATEGORIES.map((folder) => (
            <button
              key={folder.id}
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
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Type</span>
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
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Folder</span>
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
          <button
            onClick={() => assetFileRef.current?.click()}
            className={cn(SETTINGS_BUTTON_CLASS, "justify-center")}
          >
            <Upload size="0.875rem" />
            Choose Files
          </button>
          <button
            onClick={handleGameAssetUpload}
            disabled={assetUploading || assetFiles.length === 0}
            className={cn(
              SETTINGS_BUTTON_CLASS,
              "justify-center",
              assetUploading || assetFiles.length === 0 ? "" : "mari-chrome-control--selected",
            )}
          >
            {assetUploading ? <Loader2 size="0.875rem" className="animate-spin" /> : <Upload size="0.875rem" />}
            Upload to Server
          </button>
          {assetFiles.length > 0 && (
            <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {assetFiles.length === 1 ? assetFiles[0]?.name : `${assetFiles.length} files selected`}
            </span>
          )}
        </div>

        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          Audio supports MP3, OGG, WAV, FLAC, M4A, AAC, and WebM. Images support PNG, JPG, GIF, WebP, AVIF, and SVG for
          sprites. Music folders use state/genre/intensity, such as exploration/fantasy/calm.
        </p>
      </div>
    </SettingsSection>
  );
}

function AppearanceSettings() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
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
  const defaultAppBackgroundColor = getDefaultAppBackgroundColor(theme);
  const displayedAppBackgroundColor =
    appBackgroundColor.trim().toLowerCase() === defaultAppBackgroundColor.toLowerCase() ? "" : appBackgroundColor;
  const defaultAppAccentColor = getDefaultAppAccentColor(theme);
  const displayedAppAccentColor =
    appAccentColor.trim().toLowerCase() === defaultAppAccentColor.toLowerCase() ? "" : appAccentColor;
  const visualTheme = useUIStore((s) => s.visualTheme);
  const setVisualTheme = useUIStore((s) => s.setVisualTheme);
  const chatBackground = useUIStore((s) => s.chatBackground);
  const setChatBackgroundRaw = useUIStore((s) => s.setChatBackground);
  const defaultRoleplayBackground = useUIStore((s) => s.defaultRoleplayBackground);
  const setDefaultRoleplayBackground = useUIStore((s) => s.setDefaultRoleplayBackground);
  const chatBackgroundBlur = useUIStore((s) => s.chatBackgroundBlur);
  const setChatBackgroundBlur = useUIStore((s) => s.setChatBackgroundBlur);
  const resetAppearanceSettings = useUIStore((s) => s.resetAppearanceSettings);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const updateMeta = useUpdateChatMetadata();
  const setActiveSyncedTheme = useSetActiveTheme();
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
        toast.success("Appearance reset to Marinara defaults.");
      })
      .catch((err) => {
        console.error("[AppearanceSettings] Failed to clear active synced theme:", err);
        toast.warning("Appearance reset locally, but the active synced theme could not be cleared.");
      });
  }, [activeChatId, resetAppearanceSettings, setActiveSyncedTheme, updateMeta]);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const chatFontSize = useUIStore((s) => s.chatFontSize);
  const setChatFontSize = useUIStore((s) => s.setChatFontSize);
  const conversationMessageStyle = useUIStore((s) => s.conversationMessageStyle);
  const setConversationMessageStyle = useUIStore((s) => s.setConversationMessageStyle);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const setWeatherEffects = useUIStore((s) => s.setWeatherEffects);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const setTrackerPanelEnabled = useUIStore((s) => s.setTrackerPanelEnabled);
  const trackerPanelHideHudWidgets = useUIStore((s) => s.trackerPanelHideHudWidgets);
  const setTrackerPanelHideHudWidgets = useUIStore((s) => s.setTrackerPanelHideHudWidgets);
  const trackerPanelUseExpressionSprites = useUIStore((s) => s.trackerPanelUseExpressionSprites);
  const setTrackerPanelUseExpressionSprites = useUIStore((s) => s.setTrackerPanelUseExpressionSprites);
  const trackerPanelThoughtBubbleDisplay = useUIStore((s) => s.trackerPanelThoughtBubbleDisplay);
  const setTrackerPanelThoughtBubbleDisplay = useUIStore((s) => s.setTrackerPanelThoughtBubbleDisplay);
  const trackerPanelDockedThoughtsAlwaysVisible = useUIStore((s) => s.trackerPanelDockedThoughtsAlwaysVisible);
  const setTrackerPanelDockedThoughtsAlwaysVisible = useUIStore((s) => s.setTrackerPanelDockedThoughtsAlwaysVisible);
  const trackerPanelSizeProfile = useUIStore((s) => s.trackerPanelSizeProfile);
  const setTrackerPanelSizeProfile = useUIStore((s) => s.setTrackerPanelSizeProfile);
  const trackerPanelBackgroundColor = useUIStore((s) => s.trackerPanelBackgroundColor);
  const setTrackerPanelBackgroundColor = useUIStore((s) => s.setTrackerPanelBackgroundColor);
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);
  const setTrackerTemperatureUnit = useUIStore((s) => s.setTrackerTemperatureUnit);

  // Text appearance
  const chatFontColor = useUIStore((s) => s.chatFontColor);
  const setChatFontColor = useUIStore((s) => s.setChatFontColor);
  const chatChromeTextColor = useUIStore((s) => s.chatChromeTextColor);
  const setChatChromeTextColor = useUIStore((s) => s.setChatChromeTextColor);
  const chatFontOpacity = useUIStore((s) => s.chatFontOpacity);
  const setChatFontOpacity = useUIStore((s) => s.setChatFontOpacity);
  const roleplayAvatarStyle = useUIStore((s) => s.roleplayAvatarStyle);
  const setRoleplayAvatarStyle = useUIStore((s) => s.setRoleplayAvatarStyle);
  const roleplayAvatarScale = useUIStore((s) => s.roleplayAvatarScale);
  const setRoleplayAvatarScale = useUIStore((s) => s.setRoleplayAvatarScale);
  const roleplayAvatarsScrollable = useUIStore((s) => s.roleplayAvatarsScrollable);
  const setRoleplayAvatarsScrollable = useUIStore((s) => s.setRoleplayAvatarsScrollable);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const setRoleplaySpriteScale = useUIStore((s) => s.setRoleplaySpriteScale);
  const gameDialogueDisplayMode = useUIStore((s) => s.gameDialogueDisplayMode);
  const setGameDialogueDisplayMode = useUIStore((s) => s.setGameDialogueDisplayMode);
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

  // Google Fonts download
  const [googleFontName, setGoogleFontName] = useState("");
  const queryClient = useQueryClient();
  const googleFontMutation = useMutation({
    mutationFn: (family: string) =>
      api.post<{ filename: string; family: string; url: string; files?: CustomFontFace[] }>("/fonts/google/download", {
        family,
      }),
    onSuccess: (data) => {
      toast.success(`Installed "${data.family}"`);
      setGoogleFontName("");
      queryClient.invalidateQueries({ queryKey: ["custom-fonts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to download font");
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
      <SettingsIntro>Visual preferences, grouped by global chrome, text, Conversation, Roleplay, and Game presentation.</SettingsIntro>

      <SettingsSection
        title="App Style"
        description="Theme family, color scheme, fonts, and reading scale."
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
              title="Reset all Appearance settings to Marinara defaults"
            >
              {setActiveSyncedTheme.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <RotateCcw size="0.75rem" />
              )}
              Reset Appearance
            </button>
          </div>
          {/* ── Visual Style ── */}
          <div id={getSettingsControlAnchorId("visual-theme")} className="flex scroll-mt-3 flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Paintbrush size="0.75rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
              <span className="text-xs font-medium">Visual Style</span>
              <HelpTooltip text="Choose how the entire app looks. 'Marinara' uses a retro Y2K aesthetic with glow effects. 'SillyTavern' uses a clean, minimal look inspired by the original SillyTavern." />
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
                  onClick={() => setVisualTheme(opt.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-xs transition-all",
                    visualTheme === opt.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]/40",
                  )}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-[0.625rem] text-[var(--muted-foreground)] leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label id={getSettingsControlAnchorId("theme-mode")} className="flex scroll-mt-3 flex-col gap-1">
            <span className="text-xs font-medium inline-flex items-center gap-1">
              Color Scheme{" "}
              <HelpTooltip text="Switch between dark and light mode. Dark mode is easier on the eyes in low-light environments." />
            </span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as "dark" | "light")}
              className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("custom-cursor")}
            label="Custom Mouse Pointer"
            checked={customCursorEnabled}
            onChange={setCustomCursorEnabled}
            help="Uses Marinara's accent-colored cursor across the app. Turn this off to use the system cursor or let a custom CSS theme control cursor styles."
          />

          <SearchableSettingTarget controlId="app-background-color">
            <ColorPicker
              value={displayedAppBackgroundColor}
              onChange={handleAppBackgroundColorChange}
              gradient
              compact
              label="Background Color"
              helpText="Colors the main app shell background. Leave it on the scheme default to follow Dark and Light mode automatically. Gradients are supported for the shell paint."
              emptyText={`Default ${defaultAppBackgroundColor}`}
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
              label="Accent Color"
              helpText="Colors the shared app accent layer: buttons, active icons, focus rings, highlights, panel outlines, and chat chrome. Accent Pulse animates this selected color."
              emptyText={`Default ${defaultAppAccentColor}`}
              emptyPreviewValue={defaultAppAccentColor}
              clearLabel="Reset to default"
            />
          </SearchableSettingTarget>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("accent-pulse")}
            label="Accent Pulse"
            checked={appAccentPulseMode}
            onChange={handleAppAccentPulseModeChange}
            help="Animates the selected Accent Color. Solid colors gently brighten and darken; gradients cycle through their selected colors. Custom CSS themes can also request it with --marinara-theme-accent-pulse: enabled. Reduced-motion preferences are respected."
          />

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("rgb-mode")}
            label={
              <span className={cn(appAccentRgbMode && "mari-logo-gradient-text mari-logo-gradient-text--active")}>
                RGB Mode
              </span>
            }
            checked={appAccentRgbMode}
            onChange={handleAppAccentRgbModeChange}
            switchClassName={appAccentRgbMode ? "mari-rgb-toggle-track" : undefined}
            help="Cycles the app accent through Marinara's rainbow palette while enabled. Your saved Accent Color stays unchanged. Reduced-motion preferences are respected."
          />

        </div>
      </SettingsSection>

      <SettingsSection
        title="Text & Scale"
        description="Fonts, display size, chat text colors, and legibility controls."
        icon={<FileText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("text-scale")}
      >
        <div className="flex flex-col gap-3">
          <label id={getSettingsControlAnchorId("font-family")} className="flex scroll-mt-3 flex-col gap-1">
            <span className="text-xs font-medium inline-flex items-center gap-1">
              Font{" "}
              <HelpTooltip text="Choose the font used across the app. 'Default (Inter)' is optimized for screen readability. Drop .ttf, .otf, .woff, or .woff2 font files into the data/fonts/ folder to add custom fonts." />
            </span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
            >
              <option value="">Default (Inter)</option>
              {customFontOptions.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.family}
                </option>
              ))}
            </select>
            {(!customFonts || customFonts.length === 0) && (
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Drop font files (.ttf, .otf, .woff, .woff2) into the <span className="font-medium">data/fonts/</span>{" "}
                folder to add custom fonts.
              </p>
            )}
            <button
              onClick={() => api.post("/fonts/open-folder").catch(() => {})}
              className={cn(SETTINGS_BUTTON_CLASS, "mt-1 self-start")}
            >
              <FolderOpen size="0.75rem" />
              Open Fonts Folder
            </button>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium inline-flex items-center gap-1">
              Google Fonts{" "}
              <HelpTooltip text="Download a font directly from Google Fonts by name. Browse available fonts at fonts.google.com and type the exact name here." />
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
                placeholder="e.g. Fira Code, Lora, Poppins…"
                className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
              />
              <button
                onClick={() => googleFontMutation.mutate(googleFontName.trim())}
                disabled={!googleFontName.trim() || googleFontMutation.isPending}
                className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--selected")}
              >
                {googleFontMutation.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <Download size="0.75rem" />
                )}
                {googleFontMutation.isPending ? "Downloading…" : "Add"}
              </button>
            </div>
            <a
              href="https://fonts.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.625rem] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1"
            >
              Browse fonts at fonts.google.com →
            </a>
          </div>

          <label id={getSettingsControlAnchorId("display-size")} className="flex scroll-mt-3 flex-col gap-1">
            <span className="text-xs font-medium inline-flex items-center gap-1">
              Display Size{" "}
              <HelpTooltip text="Adjusts the base font size across the whole app on this device. Larger sizes improve readability. Default is 17px." />
            </span>
            <select
              value={String(fontSize)}
              onChange={(e) => setFontSize(Number(e.target.value) as 12 | 14 | 16 | 17 | 19 | 22)}
              className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
            >
              <option value="12">Tiny</option>
              <option value="14">Small</option>
              <option value="16">Medium</option>
              <option value="17">Default</option>
              <option value="19">Large</option>
              <option value="22">Huge</option>
            </select>
          </label>

          <label id={getSettingsControlAnchorId("chat-font-size")} className="flex scroll-mt-3 flex-col gap-1">
            <span className="text-xs font-medium inline-flex items-center gap-1">
              Chat Font Size{" "}
              <HelpTooltip text="Adjusts the font size of chat messages on this device. Drag the slider to find your preferred reading size. Default is 16px." />
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={12}
                max={48}
                step={1}
                value={chatFontSize}
                onChange={(e) => setChatFontSize(Number(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
              />
              <span className="text-xs tabular-nums text-[var(--muted-foreground)] w-8 text-right">
                {chatFontSize}px
              </span>
            </div>
          </label>

          <SearchableSettingTarget controlId="chat-text-color">
            <ColorPicker
              value={chatFontColor}
              onChange={setChatFontColor}
              gradient
              compact
              label="Chat Text Color"
              helpText="Controls the main chat message text color. Leave it on the scheme default to keep dark and light mode readable. Gradients are accepted for layouts that support them."
              emptyText={`Scheme default ${getDefaultChatTextColor(theme)}`}
              emptyPreviewValue={getDefaultChatTextColor(theme)}
              clearLabel="Reset to default"
            />
          </SearchableSettingTarget>

          <SearchableSettingTarget controlId="chat-chrome-text-color">
            <ColorPicker
              value={chatChromeTextColor}
              onChange={setChatChromeTextColor}
              gradient
              compact
              label="Chat Chrome Text Color"
              helpText="Controls ordinary chrome copy in tracker widgets, folder labels, settings descriptors, and windows opened from chat buttons. Accent-colored button text and active icons follow Accent Color instead. Gradients use a compatible fallback where plain CSS color is required."
              emptyText={`Scheme default ${getDefaultChatChromeTextColor(theme)}`}
              emptyPreviewValue={getDefaultChatChromeTextColor(theme)}
              clearLabel="Reset to default"
            />
          </SearchableSettingTarget>

          <div id={getSettingsControlAnchorId("text-outline-width")} className="flex scroll-mt-3 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-medium inline-flex items-center gap-1">
              Text Outline / Stroke
              <HelpTooltip text="Adds an outline around chat text for better readability over backgrounds. Set width to 0 to disable." />
            </span>
            <ColorPicker
              value={textStrokeColor || "#000000"}
              onChange={(value) => setTextStrokeColor(value || "#000000")}
              compact
              label="Text Outline Color"
              helpText="Controls the outline color used when text stroke width is above 0."
              clearLabel="Reset to default"
              clearValue="#000000"
            />
            <label className="flex flex-col gap-1">
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">Width</span>
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
                  {textStrokeWidth}px
                </span>
              </div>
            </label>
            <button
              onClick={() => {
                setTextStrokeWidth(0.5);
                setTextStrokeColor("#000000");
              }}
              className="text-[0.625rem] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors self-start"
            >
              Reset to default
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Conversation Display"
        description="Conversation layout and shared message text styling."
        icon={<MessageCircle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("chat-display")}
      >
        <div className="flex flex-col gap-3">
          <div
            id={getSettingsControlAnchorId("conversation-layout")}
            className="flex scroll-mt-3 flex-col gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--secondary)]/25 p-3"
          >
            <div className="flex items-center gap-1.5">
              <MessageCircle size="0.75rem" className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium">Chat Layout</span>
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
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-xs transition-all",
                    conversationMessageStyle === opt.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--background)]/35 hover:border-[var(--primary)]/40",
                  )}
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
                      Hey, how's it going?
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5 justify-start">
                    <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <div className="mari-message-bubble texting-bubble texting-bubble-other max-w-[78%] rounded-2xl px-3 py-1.5 text-xs shadow-sm">
                      Pretty good, thanks!
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 text-xs">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="font-semibold">Character</span>
                      <span className="text-[0.625rem] text-[var(--muted-foreground)]">12:45</span>
                    </div>
                    <div className="space-y-0.5 text-[var(--foreground)]/90">
                      <div>Messages appear as rows,</div>
                      <div>grouped by sender.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </SettingsSection>

      <div id={getSettingsSectionAnchorId("roleplay-tracker")} className="flex scroll-mt-3 flex-col gap-3">
        <TrackerPanelAppearanceDrawer
          trackerPanelEnabled={trackerPanelEnabled}
          setTrackerPanelEnabled={setTrackerPanelEnabled}
          trackerPanelHideHudWidgets={trackerPanelHideHudWidgets}
          setTrackerPanelHideHudWidgets={setTrackerPanelHideHudWidgets}
          trackerPanelUseExpressionSprites={trackerPanelUseExpressionSprites}
          setTrackerPanelUseExpressionSprites={setTrackerPanelUseExpressionSprites}
          trackerPanelThoughtBubbleDisplay={trackerPanelThoughtBubbleDisplay}
          setTrackerPanelThoughtBubbleDisplay={setTrackerPanelThoughtBubbleDisplay}
          trackerPanelDockedThoughtsAlwaysVisible={trackerPanelDockedThoughtsAlwaysVisible}
          setTrackerPanelDockedThoughtsAlwaysVisible={setTrackerPanelDockedThoughtsAlwaysVisible}
          trackerPanelSizeProfile={trackerPanelSizeProfile}
          setTrackerPanelSizeProfile={setTrackerPanelSizeProfile}
          trackerPanelBackgroundColor={trackerPanelBackgroundColor}
          setTrackerPanelBackgroundColor={setTrackerPanelBackgroundColor}
          trackerTemperatureUnit={trackerTemperatureUnit}
          setTrackerTemperatureUnit={setTrackerTemperatureUnit}
        />
      </div>

      <SettingsSection
          title="Roleplay Messages"
          description="Roleplay bubbles, avatars, sprite scale, and message opacity."
          icon={<Image size="0.875rem" />}
          {...getSettingsSectionAnchorProps("roleplay-messages")}
        >
          <div className="flex flex-col gap-3">
            <label
              id={getSettingsControlAnchorId("roleplay-message-opacity")}
              className="flex scroll-mt-3 flex-col gap-1"
            >
              <span className="text-[0.6875rem] font-medium">Roleplay Messages Background Opacity</span>
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
                className="self-start text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-45"
              >
                Reset opacity to default
              </button>
            </label>

            <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium">Roleplay Avatars</span>
              <HelpTooltip text="Choose how avatars sit next to roleplay messages. None hides message avatars. Small Circles keeps the current compact layout. Small Rectangles gives portraits a taller frame. Glued Side Panel embeds a larger portrait strip into the message bubble itself." />
            </div>
            <ToggleSetting
              anchorId={getSettingsControlAnchorId("scrollable-avatars")}
              label="Scrollable Avatars"
              checked={roleplayAvatarsScrollable}
              onChange={setRoleplayAvatarsScrollable}
              help="When enabled, roleplay avatars stay visible while you scroll through long messages and stop at the bottom of their own message."
            />
            <div id={getSettingsControlAnchorId("roleplay-avatar-style")} className="grid scroll-mt-3 grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLEPLAY_AVATAR_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRoleplayAvatarStyle(opt.id)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-xs transition-all",
                    roleplayAvatarStyle === opt.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]/40",
                  )}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-20 w-full shrink-0 items-end justify-center gap-3 overflow-hidden rounded-md bg-black/30 p-2 ring-1 ring-[var(--border)]/70 sm:w-28">
                  {roleplayAvatarStyle === "none" ? (
                    <div
                      className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 px-2 text-[0.625rem] font-medium text-white/35"
                      style={{
                        width: toPreviewRem(roleplayAvatarPreview.width),
                        height: toPreviewRem(roleplayAvatarPreview.height),
                      }}
                    >
                      No avatars
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
                <div className="grid min-w-0 flex-1 gap-3">
                  <label
                    id={getSettingsControlAnchorId("roleplay-avatar-scale")}
                    className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                  >
                    <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Message avatar scale</span>
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
                    <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Default sprite scale</span>
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
              Rectangles keep the compact side slot but give portraits a bit more vertical room. The larger panel crops
              portraits from the top on short messages and fades them back into the bubble background on taller ones.
              Per-chat sprite sizing still overrides the default sprite scale here.
            </p>
          </div>
          </div>
        </SettingsSection>

      <SettingsSection
        title="Game Presentation"
        description="Game VN art scale and dialogue display."
        icon={<ScrollText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("game-presentation")}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium">Game VN Art</span>
              <HelpTooltip text="Scales Game mode dialogue portraits separately from the center full-body sprites. Oversized art is still clamped per viewport." />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <div className="grid min-w-0 flex-1 gap-3">
                  <label
                    id={getSettingsControlAnchorId("game-dialogue-portrait-scale")}
                    className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                  >
                    <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                      Dialogue portrait scale
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
                      Full-body sprite scale
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
              <span className="text-xs font-medium">Game Dialogue Display</span>
              <HelpTooltip text="Choose whether Game mode uses the classic VN box or shows a scrollable segment history directly above it." />
            </div>
            <div id={getSettingsControlAnchorId("game-dialogue-display")} className="grid scroll-mt-3 grid-cols-1 gap-2 sm:grid-cols-2">
              {GAME_DIALOGUE_DISPLAY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGameDialogueDisplayMode(opt.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-xs transition-all",
                    gameDialogueDisplayMode === opt.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]/40",
                  )}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-[0.625rem] leading-tight text-[var(--muted-foreground)]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Atmosphere"
        description="Roleplay weather and atmospheric effects."
        icon={<CloudRain size="0.875rem" />}
        {...getSettingsSectionAnchorProps("motion-backgrounds")}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <CloudRain size="0.75rem" className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium">Effects</span>
              <HelpTooltip text="Visual effects that enhance the roleplay atmosphere. Weather particles like rain, snow, and fog appear based on the story context." />
            </div>
            <ToggleSetting
              anchorId={getSettingsControlAnchorId("weather-effects")}
              label="Dynamic weather effects (rain, snow, fog, etc.)"
              checked={weatherEffects}
              onChange={setWeatherEffects}
            />
            <p className="text-[0.625rem] text-[var(--muted-foreground)] pl-6">
              Shows animated weather particles based on in-story weather and time of day. Requires the{" "}
              <span className="font-medium">World State</span> agent to be enabled so weather data is extracted from the
              narrative.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Conversation Theme"
        description="Conversation-mode background gradient by color scheme."
        icon={<Palette size="0.875rem" />}
        {...getSettingsSectionAnchorProps("conversation-theme")}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palette size="0.75rem" className="text-[var(--muted-foreground)]" />
                <span className="text-xs font-medium">Conversation Theme</span>
                <HelpTooltip text="Set a background gradient for all Conversation-mode chats, separately for dark and light color schemes." />
              </div>
              {/* Scheme tabs */}
              <div className="flex rounded-lg bg-[var(--secondary)] p-0.5 text-[0.625rem]">
                <button
                  type="button"
                  onClick={() => setActiveGradientScheme("dark")}
                  className={cn(
                    "rounded-md px-2 py-1 transition-colors",
                    activeGradientScheme === "dark"
                      ? "mari-accent-animated bg-[var(--accent)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/25"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGradientScheme("light")}
                  className={cn(
                    "rounded-md px-2 py-1 transition-colors",
                    activeGradientScheme === "light"
                      ? "mari-accent-animated bg-[var(--accent)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/25"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  Light
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
              className="text-[0.625rem] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors self-start"
            >
              Reset {activeGradientScheme === "dark" ? "Dark" : "Light"} to default
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Backgrounds"
        description="Chat background images, blur, and default Roleplay background."
        icon={<Image size="0.875rem" />}
        {...getSettingsSectionAnchorProps("chat-backgrounds")}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium inline-flex items-center gap-1">
                Chat Background{" "}
                <HelpTooltip text="Import one or more custom images, or choose from your game asset backgrounds. Supports JPG, PNG, GIF, WebP, and AVIF. Remove to use the default background." />
              </span>
              {chatBackground && (
                <button
                  onClick={() => setChatBackground(null)}
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                >
                  <X size="0.625rem" /> Remove
                </button>
              )}
            </div>
            <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)]/45 p-3 ring-1 ring-[var(--border)]/70">
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
                Background Blur
                <HelpTooltip text="Softens selected Roleplay and Game mode background images behind the chat UI. Set to 0px to keep backgrounds sharp." />
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
                  {chatBackgroundBlur === 0 ? "Off" : `${chatBackgroundBlur}px`}
                </span>
              </div>
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
    </div>
  );
}

type BackgroundLibraryItem = {
  id?: string;
  filename: string;
  url: string;
  originalName: string | null;
  tags: string[];
  source?: "user" | "game_asset";
  tag?: string;
  editable?: boolean;
  deletable?: boolean;
  renameable?: boolean;
};

type BackgroundUploadResponse = {
  success: boolean;
  filename: string;
  url: string;
  originalName: string;
  tags: string[];
};

function BackgroundPicker({
  selected,
  onSelect,
  defaultRoleplayBackground,
  onDefaultChange,
}: {
  selected: string | null;
  onSelect: (url: string | null) => void;
  defaultRoleplayBackground: string;
  onDefaultChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const refreshGameAssetManifest = useGameAssetStore((s) => s.fetchManifest);
  const qc = useQueryClient();

  const { data: backgrounds } = useQuery({
    queryKey: ["backgrounds"],
    queryFn: () => api.get<BackgroundLibraryItem[]>("/backgrounds"),
  });

  const { data: allTags } = useQuery({
    queryKey: ["background-tags"],
    queryFn: () => api.get<string[]>("/backgrounds/tags"),
  });

  const deleteBg = useMutation({
    mutationFn: (filename: string) => api.delete(`/backgrounds/${filename}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backgrounds"] });
      qc.invalidateQueries({ queryKey: ["background-tags"] });
    },
  });

  const updateTags = useMutation({
    mutationFn: ({ filename, tags }: { filename: string; tags: string[] }) =>
      api.patch(`/backgrounds/${filename}/tags`, { tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backgrounds"] });
      qc.invalidateQueries({ queryKey: ["background-tags"] });
    },
  });

  const renameBg = useMutation({
    mutationFn: ({ filename, name }: { filename: string; name: string }) =>
      api.patch<{ success: boolean; oldFilename: string; filename: string; url: string }>(
        `/backgrounds/${filename}/rename`,
        { name },
      ),
    onSuccess: (data) => {
      const oldUrl = `/api/backgrounds/file/${encodeURIComponent(data.oldFilename)}`;
      if (selected === oldUrl) {
        onSelect(data.url);
      }
      if (defaultRoleplayBackground === oldUrl) {
        onDefaultChange(data.url);
      }
      setRenamingFile(null);
      qc.invalidateQueries({ queryKey: ["backgrounds"] });
    },
  });

  const filteredBackgrounds = useMemo(() => {
    const items = backgrounds ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((bg) => {
      const haystack = [
        bg.filename,
        bg.originalName ?? "",
        bg.tag ?? "",
        bg.source === "game_asset" ? "game asset" : "library",
        ...bg.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [backgrounds, searchQuery]);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploads = await Promise.allSettled(
        files.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          return api.upload<BackgroundUploadResponse>("/backgrounds/upload", formData);
        }),
      );
      const successfulUploads = uploads
        .filter((result): result is PromiseFulfilledResult<BackgroundUploadResponse> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((result) => result.success);
      const failed = uploads.length - successfulUploads.length;

      if (successfulUploads.length > 0) {
        qc.invalidateQueries({ queryKey: ["backgrounds"] });
        qc.invalidateQueries({ queryKey: ["background-tags"] });
        void refreshGameAssetManifest().catch(() => undefined);
        onSelect(successfulUploads[successfulUploads.length - 1]!.url);
        toast.success(`Imported ${successfulUploads.length} background${successfulUploads.length === 1 ? "" : "s"}.`);
      }

      if (failed > 0) {
        const rejected = uploads.find((result) => result.status === "rejected");
        toast.error(
          rejected?.status === "rejected" && rejected.reason instanceof Error
            ? rejected.reason.message
            : `${failed} background import${failed === 1 ? "" : "s"} failed.`,
        );
      }
    } catch {
      toast.error("Background import failed.");
    } finally {
      setUploading(false);
    }
  };

  const addTag = (filename: string, currentTags: string[]) => {
    const tag = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 _-]/g, "");
    if (!tag || currentTags.includes(tag)) return;
    updateTags.mutate({ filename, tags: [...currentTags, tag] });
    setTagInput("");
  };

  const removeTag = (filename: string, currentTags: string[], tagToRemove: string) => {
    updateTags.mutate({ filename, tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  return (
    <div className="flex flex-col gap-2">
      <ImageUploadDropzone
        label="Import Backgrounds"
        pending={uploading}
        pendingLabel="Importing..."
        dragLabel="Drop backgrounds to import"
        onFilesSelected={(files) => void handleUpload(files)}
        icon={uploading ? <Loader2 size="0.875rem" className="animate-spin" /> : <Upload size="0.875rem" />}
        className="rounded-lg py-3 hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/50"
      />

      <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/40 p-2.5 ring-1 ring-[var(--border)]/70">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size="0.75rem"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search backgrounds..."
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-0 pl-7 pr-2 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/60 focus:border-[var(--primary)]/50 md:h-9"
            />
          </div>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              title="Clear search"
            >
              <X size="0.75rem" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
          <span>
            {filteredBackgrounds.length} of {backgrounds?.length ?? 0} backgrounds
          </span>
          {defaultRoleplayBackground !== DEFAULT_ROLEPLAY_BACKGROUND_URL && (
            <button
              type="button"
              onClick={() => onDefaultChange(DEFAULT_ROLEPLAY_BACKGROUND_URL)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <Star size="0.625rem" />
              Reset Roleplay default
            </button>
          )}
        </div>
      </div>

      {/* Background grid */}
      {backgrounds && backgrounds.length > 0 && filteredBackgrounds.length > 0 && (
        <div className="flex flex-col gap-2">
          {filteredBackgrounds.map((bg) => {
            const itemKey = bg.id ?? bg.url;
            const isSelected = selected === bg.url;
            const isDefaultRoleplay = defaultRoleplayBackground === bg.url;
            const isUserBackground = bg.source !== "game_asset";
            const isEditable = bg.editable !== false && isUserBackground;
            const canRename = bg.renameable !== false && isUserBackground;
            const canDelete = bg.deletable !== false && isUserBackground;
            const isEditing = editingTags === itemKey;
            const isRenaming = renamingFile === itemKey;
            const title = bg.originalName ?? bg.tag ?? bg.filename;
            const sourceLabel = bg.source === "game_asset" ? "Game asset" : "Library";
            return (
              <div key={itemKey} className="flex flex-col gap-1">
                {/* Thumbnail row */}
                <div className="group relative flex gap-2">
                  <button
                    onClick={() => onSelect(isSelected ? null : bg.url)}
                    className={cn(
                      "relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                      isSelected
                        ? "border-[var(--primary)] shadow-md shadow-[var(--primary)]/20"
                        : "border-transparent hover:border-[var(--muted-foreground)]/30",
                    )}
                  >
                    <img src={bg.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Check size="0.875rem" className="text-white" />
                      </div>
                    )}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
                    <div className="flex items-center gap-1">
                      {isRenaming ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (renameInput.trim())
                              renameBg.mutate({ filename: bg.filename, name: renameInput.trim() });
                          }}
                        >
                          <input
                            type="text"
                            value={renameInput}
                            onChange={(e) => setRenameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setRenamingFile(null);
                            }}
                            className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[0.625rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!renameInput.trim() || renameBg.isPending}
                            className={SETTINGS_INLINE_ACCENT_BUTTON_CLASS}
                          >
                            {renameBg.isPending ? "…" : "Save"}
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]" title={title}>
                            {bg.filename}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0 text-[0.5625rem]",
                              bg.source === "game_asset"
                                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                            )}
                          >
                            {sourceLabel}
                          </span>
                          {isDefaultRoleplay && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--primary)]/12 px-1.5 py-0 text-[0.5625rem] text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
                              <Star size="0.5rem" fill="currentColor" />
                              Default
                            </span>
                          )}
                          {canRename && (
                            <button
                              onClick={() => {
                                const nameWithoutExt = bg.filename.replace(/\.[^.]+$/, "");
                                setRenameInput(nameWithoutExt);
                                setRenamingFile(itemKey);
                              }}
                              className="shrink-0 rounded-md p-0.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--primary)] group-hover:opacity-100"
                              title="Rename"
                            >
                              <Pencil size="0.5625rem" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDefaultChange(isDefaultRoleplay ? DEFAULT_ROLEPLAY_BACKGROUND_URL : bg.url);
                        }}
                        className={cn(
                          "shrink-0 rounded-md p-0.5 transition-colors",
                          isDefaultRoleplay
                            ? "text-[var(--primary)]"
                            : "text-[var(--muted-foreground)]/70 hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                        )}
                        title={
                          isDefaultRoleplay
                            ? "Default for new Roleplay chats"
                            : "Set as default for new Roleplay chats"
                        }
                        aria-label={
                          isDefaultRoleplay
                            ? `${title} is the default Roleplay background`
                            : `Set ${title} as the default Roleplay background`
                        }
                        aria-pressed={isDefaultRoleplay}
                      >
                        <Star size="0.75rem" fill={isDefaultRoleplay ? "currentColor" : "none"} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selected === bg.url) onSelect(null);
                            if (defaultRoleplayBackground === bg.url) onDefaultChange(DEFAULT_ROLEPLAY_BACKGROUND_URL);
                            deleteBg.mutate(bg.filename);
                          }}
                          className="ml-auto shrink-0 rounded-md p-0.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--foreground)] group-hover:opacity-100"
                        >
                          <Trash2 size="0.625rem" />
                        </button>
                      )}
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1">
                      {bg.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-full bg-[var(--secondary)] px-1.5 py-0 text-[0.5625rem] text-[var(--muted-foreground)]"
                        >
                          {tag}
                          {isEditing && isEditable && (
                            <button
                              onClick={() => removeTag(bg.filename, bg.tags, tag)}
                              className="ml-0.5 hover:text-[var(--destructive)]"
                            >
                              <X size="0.5rem" />
                            </button>
                          )}
                        </span>
                      ))}
                      {isEditable && (
                        <button
                          onClick={() => {
                            setEditingTags(isEditing ? null : itemKey);
                            setTagInput("");
                          }}
                          className={cn(
                            "rounded-full p-0.5 transition-colors",
                            isEditing
                              ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                              : "text-[var(--muted-foreground)]/60 hover:text-[var(--primary)]",
                          )}
                          title="Edit tags"
                        >
                          <Tag size="0.5625rem" />
                        </button>
                      )}
                    </div>
                    {/* Tag input */}
                    {isEditing && isEditable && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTag(bg.filename, bg.tags);
                            }
                            if (e.key === "Escape") setEditingTags(null);
                          }}
                          placeholder="Add tag…"
                          className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[0.625rem] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                          autoFocus
                          list={`tag-suggestions-${itemKey}`}
                        />
                        <datalist id={`tag-suggestions-${itemKey}`}>
                          {(allTags ?? [])
                            .filter((t) => !bg.tags.includes(t))
                            .map((t) => (
                              <option key={t} value={t} />
                            ))}
                        </datalist>
                        <button
                          onClick={() => addTag(bg.filename, bg.tags)}
                          disabled={!tagInput.trim()}
                          className={SETTINGS_INLINE_ACCENT_BUTTON_CLASS}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(!backgrounds || backgrounds.length === 0) && (
        <div className="flex flex-col items-center gap-1.5 py-4 text-center">
          <Image size="1.25rem" className="text-[var(--muted-foreground)]/40" />
          <p className="mari-chrome-text-muted text-[0.625rem]">No backgrounds available yet</p>
        </div>
      )}
      {backgrounds && backgrounds.length > 0 && filteredBackgrounds.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 py-4 text-center">
          <Search size="1.25rem" className="text-[var(--muted-foreground)]/40" />
          <p className="mari-chrome-text-muted text-[0.625rem]">No backgrounds match that search</p>
        </div>
      )}
    </div>
  );
}

function GenerationsSettings() {
  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        Global defaults for generated images, generated videos, and reusable prompt templates.
      </SettingsIntro>

      <ImageGenerationSettings />
      <VideoGenerationSettings />
      <div id={getSettingsSectionAnchorId("prompt-overrides")} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/35 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--foreground)]">Prompt Overrides</div>
            <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              Reusable image and video prompt templates.
            </div>
          </div>
        </div>
        <PromptOverridesEditor
          title="Video Generation Prompt Overrides"
          description="Edit reusable templates for Game/Gallery scene videos, Conversation Call character clips, and animated Expression portraits."
          help="Game scene videos use this before sending a reference-image video request. Conversation Call clips use the selected character avatar as the identity reference and return to idle at the end of each clip. Animated Expression portraits become looping GIF sprites."
          keys={VIDEO_PROMPT_TEMPLATE_KEYS}
          preferredKey="game.video"
        />
        <PromptOverridesEditor
          title="Image Generation Prompt Overrides"
          description="Edit the templates used by image, sprite, Game, and prompt-builder systems."
          help="Global templates for registered prompt builders, including Conversation selfies, Game NPC portraits, scene media, storyboard prompts, and other registered builders."
          preferredKey="game.npcPortrait"
        />
      </div>
    </div>
  );
}

function AddonsSettings() {
  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        Extensions add trusted browser or server behavior; custom themes change Marinara's look.
      </SettingsIntro>
      <ExtensionsSettings showIntro={false} />
      <ThemesSettings showIntro={false} />
    </div>
  );
}

function ThemesSettings({ showIntro = true }: { showIntro?: boolean } = {}) {
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

  // Inject live preview CSS
  useEffect(() => {
    if (!editorOpen || !livePreview) {
      const el = document.getElementById("marinara-css-editor-preview");
      if (el) el.textContent = "";
      return;
    }
    let style = document.getElementById("marinara-css-editor-preview") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "marinara-css-editor-preview";
    }
    style.textContent = sanitizeAppCss(themeCss);
    // Always (re-)append so it's the last <style> in <head>,
    // overriding the active-theme injector's saved CSS.
    document.head.appendChild(style);
    return () => {
      style!.textContent = "";
    };
  }, [editorOpen, livePreview, themeCss]);

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
        toast.success(`Theme "${name}" updated`);
      } else {
        const theme = await createTheme.mutateAsync({
          name,
          css,
          installedAt: new Date().toISOString(),
        });
        await setActiveTheme.mutateAsync(theme.id);
        toast.success(`Theme "${name}" saved and activated`);
      }
      setEditorOpen(false);
    } catch (err) {
      console.error("[ThemesSettings] Failed to save theme:", err);
      toast.error("Failed to save theme. Check the browser console for details.");
    }
  }, [createTheme, editingId, setActiveTheme, themeCss, themeName, updateTheme]);

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
          const created = await createTheme.mutateAsync({
            name: importedThemeName,
            css: importedThemeCss,
            installedAt: new Date().toISOString(),
          });
          workingThemes = [created, ...workingThemes];
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
        toast.error("No valid themes found in file.");
      }
    } catch (err) {
      console.error("[ThemesSettings] Failed to import theme:", err);
      toast.error(
        err instanceof SyntaxError
          ? "Failed to import theme. The JSON could not be parsed."
          : getPrivilegedActionErrorMessage(err, "Failed to import theme. Ensure it's a valid CSS or JSON file."),
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
              onClick={() => setEditorOpen(false)}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <X size="0.875rem" />
            </button>
            <span className="text-xs font-semibold">{editingId ? "Edit Theme" : "New Theme"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLivePreview(!livePreview)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] transition-colors",
                livePreview
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
              )}
              title={livePreview ? "Disable live preview" : "Enable live preview"}
            >
              {livePreview ? <Eye size="0.6875rem" /> : <EyeOff size="0.6875rem" />}
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={isSavingTheme}
              className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
            >
              {isSavingTheme ? <Loader2 size="0.6875rem" className="animate-spin" /> : <Save size="0.6875rem" />}
              {isSavingTheme ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Theme name */}
        <input
          type="text"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          placeholder="Theme name..."
          className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
        />

        {/* CSS textarea */}
        <textarea
          value={themeCss}
          onChange={(e) => setThemeCss(e.target.value)}
          spellCheck={false}
          className="min-h-[22.5rem] resize-y rounded-lg border border-[var(--border)] bg-[#0d1117] p-3 font-mono text-[0.6875rem] leading-relaxed text-emerald-300 outline-none transition-colors focus:border-[var(--primary)]/50 placeholder:text-white/20"
          placeholder="/* Enter your CSS here... */"
        />

        {/* Quick reference */}
        <details className="group rounded-lg bg-[var(--secondary)]/50 ring-1 ring-[var(--border)]">
          <summary className="cursor-pointer px-3 py-2 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
            CSS Variable Reference
          </summary>
          <div className="border-t border-[var(--border)] px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>--background</span>
              <span className="text-white/40">Page background</span>
              <span>--foreground</span>
              <span className="text-white/40">Main text</span>
              <span>--primary</span>
              <span className="text-white/40">Accent / buttons</span>
              <span>--primary-foreground</span>
              <span className="text-white/40">Text on primary</span>
              <span>--secondary</span>
              <span className="text-white/40">Cards / inputs</span>
              <span>--card</span>
              <span className="text-white/40">Card background</span>
              <span>--border</span>
              <span className="text-white/40">Borders</span>
              <span>--muted-foreground</span>
              <span className="text-white/40">Dimmed text</span>
              <span>--sidebar</span>
              <span className="text-white/40">Sidebar bg</span>
              <span>--sidebar-border</span>
              <span className="text-white/40">Sidebar border</span>
              <span>--marinara-shell-edge-border</span>
              <span className="text-white/40">Left/right shell edge</span>
              <span>--destructive</span>
              <span className="text-white/40">Error / delete</span>
              <span>--popover</span>
              <span className="text-white/40">Dropdown bg</span>
              <span>--accent</span>
              <span className="text-white/40">Hover highlights</span>
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
          Create or import custom CSS themes. Themes sync across devices connected to this Marinara server.
        </SettingsIntro>
      )}

      <SettingsSection
        title="Theme Library"
        description="Create, import, activate, edit, export, or remove custom CSS themes."
        icon={<Palette size="0.875rem" />}
        {...getSettingsSectionAnchorProps("theme-library")}
      >
        <div className="flex flex-col gap-3">
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={openNewTheme}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 text-xs text-[var(--primary)] transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/10"
            >
              <Plus size="0.875rem" /> Create Theme
            </button>
            <button
              onClick={() => {
                triggerFilePicker({
                  accept: ".css,.json",
                  onSelect: (files) => {
                    const file = files[0];
                    if (file) void handleImportThemeFile(file);
                  },
                });
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/50"
            >
              <Download size="0.875rem" /> Import File
            </button>
          </div>

          {/* Active theme: None option */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Installed Themes</span>
            <button
              onClick={() =>
                setActiveTheme.mutate(null, {
                  onError: (err) => {
                    console.error("[ThemesSettings] Failed to reset active theme:", err);
                    toast.error("Failed to reset the active theme.");
                  },
                })
              }
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
                activeCustomTheme === null
                  ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
              )}
            >
              <Palette size="0.75rem" />
              Default Theme
              {activeCustomTheme === null && <Check size="0.75rem" className="ml-auto" />}
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
                        toast.error("Failed to activate theme.");
                      },
                    })
                  }
                  className="flex flex-1 items-center gap-2 min-w-0"
                >
                  <FileCode2 size="0.75rem" className="shrink-0" />
                  <span className="truncate">{t.name}</span>
                  {activeCustomTheme?.id === t.id && <Check size="0.75rem" className="shrink-0" />}
                </button>
                <button
                  onClick={() => openEditTheme(t)}
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                  title="Edit theme CSS"
                >
                  <Code size="0.6875rem" />
                </button>
                <button
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
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                  title="Export theme"
                >
                  <Upload size="0.6875rem" />
                </button>
                <button
                  onClick={() => {
                    void (async () => {
                      const confirmed = await showConfirmDialog({
                        title: "Delete Theme",
                        message: `Delete "${t.name}"? This permanently removes the saved theme CSS from this server.`,
                        confirmLabel: "Delete",
                        tone: "destructive",
                      });
                      if (!confirmed) return;
                      try {
                        await deleteTheme.mutateAsync(t.id);
                        toast.success(`Theme "${t.name}" removed`);
                      } catch (err) {
                        console.error("[ThemesSettings] Failed to remove theme:", err);
                        toast.error("Failed to remove theme.");
                      }
                    })();
                  }}
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Remove theme"
                >
                  <Trash2 size="0.6875rem" />
                </button>
              </div>
            ))}

            {isLoading && syncedThemes.length === 0 && (
              <p className="mari-chrome-text-muted py-2 text-center text-[0.625rem]">
                Loading synced themes...
              </p>
            )}

            {!isLoading && syncedThemes.length === 0 && (
              <p className="mari-chrome-text-muted py-2 text-center text-[0.625rem]">
                No synced custom themes yet. Create one or import a .css file above.
              </p>
            )}
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <strong>Tip:</strong> CSS themes can override any CSS variable (e.g.{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--background</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--primary</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--marinara-app-accent-solid</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--marinara-theme-accent-pulse</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--marinara-chat-chrome-accent</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--marinara-chat-chrome-accent-gradient</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">--marinara-chat-chrome-surface-bg</code>) or add custom
            styles. JSON themes should have{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{`{ "name": "...", "css": "..." }`}</code> format.
            Imported theme files sync to this Marinara server but do not auto-activate.
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
  /* --marinara-shell-edge-border: color-mix(in srgb, var(--foreground) 14%, var(--background) 86%); */

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
}

/* Uncomment and edit the variables above.
   You can also target shared chrome directly:
   .marinara-chat-toolbar-button { border-radius: 0.5rem; }
   .marinara-chat-popover { box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4); }

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

function createInlineFolderPackageImportEntry(raw: unknown, path: string): FolderPackageImportEntry {
  return {
    raw,
    path,
    basePath: "",
    resolveTextFile: () => null,
  };
}

function getExtensionImportKind(raw: unknown) {
  if (!isJsonRecord(raw)) return "";
  const manifest = isJsonRecord(raw.manifest) ? raw.manifest : raw;
  return typeof manifest.kind === "string" ? manifest.kind : "";
}

function getExtensionImportRuntime(raw: unknown, record: Record<string, unknown>): "client" | "server" {
  const runtime = typeof record.runtime === "string" ? record.runtime.toLowerCase() : "";
  const kind = getExtensionImportKind(raw).toLowerCase();
  return runtime === "server" || kind === "marinara.server-extension" ? "server" : "client";
}

function normalizeExtensionImportEntry(entry: FolderPackageImportEntry, fallbackName: string) {
  const source = getFolderManifestConfig(entry.raw);
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const folderName = getPackagePathBasename(entry.basePath) || fallbackName;
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : folderName;
  if (!name) return null;
  const runtime = getExtensionImportRuntime(entry.raw, record);

  if (runtime === "server") {
    const serverJsFromFiles = resolvePackageTextPaths(
      entry.resolveTextFile,
      record.serverJsPath ?? record.serverJsPaths ?? record.jsPath ?? record.jsPaths,
    );
    return {
      name,
      description: typeof record.description === "string" ? record.description : "",
      runtime,
      css: null,
      js: null,
      serverJs:
        serverJsFromFiles ??
        (typeof record.serverJs === "string" ? record.serverJs : typeof record.js === "string" ? record.js : null),
      enabled: false,
    };
  }

  return {
    name,
    description: typeof record.description === "string" ? record.description : "",
    runtime,
    css:
      resolvePackageTextPaths(entry.resolveTextFile, record.cssPath ?? record.cssPaths) ??
      (typeof record.css === "string" ? record.css : null),
    js:
      resolvePackageTextPaths(entry.resolveTextFile, record.jsPath ?? record.jsPaths) ??
      (typeof record.js === "string" ? record.js : null),
    serverJs: null,
    enabled: typeof record.enabled === "boolean" ? record.enabled : false,
  };
}

function createLooseExtensionFolderImportEntries(
  files: PackageTextFile[],
  fallbackName: string,
): FolderPackageImportEntry[] {
  const serverJs = files
    .filter((file) => /\.server\.(js|mjs|cjs)$/i.test(file.path))
    .map((file) => file.text)
    .join("\n\n");
  if (serverJs) {
    return [
      createInlineFolderPackageImportEntry(
        {
          name: fallbackName || "extension",
          description: "Server extension imported from folder",
          runtime: "server",
          serverJs,
          enabled: false,
        },
        fallbackName || "extension",
      ),
    ];
  }

  const css = files
    .filter((file) => file.path.toLowerCase().endsWith(".css"))
    .map((file) => file.text)
    .join("\n\n");
  const js = files
    .filter((file) => /\.(js|mjs|cjs)$/i.test(file.path) && !/\.server\.(js|mjs|cjs)$/i.test(file.path))
    .map((file) => file.text)
    .join("\n\n");
  if (!css && !js) return [];
  return [
    createInlineFolderPackageImportEntry(
      {
        name: fallbackName || "extension",
        description: "Extension imported from folder",
        runtime: "client",
        css: css || null,
        js: js || null,
        serverJs: null,
        enabled: false,
      },
      fallbackName || "extension",
    ),
  ];
}

function getLooseExtensionFolderName(files: PackageTextFile[], fallbackName: string) {
  const firstPath = files[0]?.path;
  if (!firstPath) return fallbackName;
  const firstSlash = firstPath.indexOf("/");
  return firstSlash > 0 ? firstPath.slice(0, firstSlash) : fallbackName;
}

function describeExtensionImportError(error: unknown, name?: string) {
  const rawMessage =
    error instanceof ApiError && error.message
      ? error.message
      : error instanceof Error && error.message
        ? error.message
        : "Failed to import extension.";
  const subject = name ? `Failed to install "${name}": ${rawMessage}` : rawMessage;
  if (error instanceof ApiError && error.status === 403) {
    return `${subject} Installing extensions requires loopback access or admin access. Open Marinara Engine through localhost, or set ADMIN_SECRET=<secret> in the server .env and paste the same value in Settings → Advanced → Admin Access. Marinara sends it as the X-Admin-Secret header.`;
  }
  return subject;
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

function ExtensionsSettings({ showIntro = true }: { showIntro?: boolean } = {}) {
  const { data: extensions, isLoading } = useExtensions();
  const extensionList = extensions ?? [];
  const createExtension = useCreateExtension();
  const updateExtension = useUpdateExtension();
  const deleteExtension = useDeleteExtension();

  const importExtensionEntries = async (
    entries: FolderPackageImportEntry[],
    installedAt: string,
    fallbackName: string,
  ) => {
    let imported = 0;
    let failed = 0;
    let skipped = 0;
    const failureMessages: string[] = [];
    for (const entry of entries) {
      const normalized = normalizeExtensionImportEntry(entry, fallbackName);
      if (!normalized) {
        skipped++;
        failureMessages.push("Skipped an extension entry because it did not contain importable extension data.");
        continue;
      }
      try {
        await createExtension.mutateAsync({
          ...normalized,
          installedAt,
        });
        imported++;
      } catch (err) {
        failed++;
        failureMessages.push(describeExtensionImportError(err, normalized.name));
        console.warn("[ExtensionsSettings] Failed to import extension entry:", normalized.name, err);
      }
    }
    if (imported === 0 && failed === 0 && skipped === 0) throw new Error("No valid extensions found in file");
    const skipNote = skipped > 0 ? ` (${skipped} skipped — no importable entry)` : "";
    if (failed > 0) {
      const more = failureMessages.length > 1 ? ` (+${failureMessages.length - 1} more)` : "";
      toast.error(
        imported > 0
          ? `Imported ${imported} extension${imported === 1 ? "" : "s"}${skipNote}; ${failed} failed — ${failureMessages[0]}${more}`
          : `Failed to import ${failed} extension${failed === 1 ? "" : "s"}${skipNote} — ${failureMessages[0]}${more}`,
        { duration: 12_000 },
      );
    } else if (skipped > 0) {
      toast.warning(
        imported > 0
          ? `Imported ${imported} extension${imported === 1 ? "" : "s"}${skipNote}. Review before enabling.`
          : `Skipped ${skipped} extension entr${skipped === 1 ? "y" : "ies"}.`,
        {
          description: failureMessages[0],
          duration: 12_000,
        },
      );
    } else {
      toast.success(`Imported ${imported} extension${imported === 1 ? "" : "s"}${skipNote}. Review before enabling.`);
    }
  };

  const handleImportExtensionFile = async (file: File) => {
    try {
      const installedAt = new Date().toISOString();
      const fallbackName = file.name
        .replace(/\.server\.(js|mjs|cjs)$/i, "")
        .replace(/\.(json|css|js|mjs|cjs|zip)$/i, "");
      const lowerName = file.name.toLowerCase();

      if (isZipArchiveFile(file)) {
        const files = await readTextFilesFromZip(file);
        const entries = collectFolderPackageEntries(files, {
          rootFilenames: ["marinara-extensions.json", "marinara-extension.json"],
          collectionKeys: ["extensions"],
        });
        await importExtensionEntries(
          entries.length > 0 ? entries : createLooseExtensionFolderImportEntries(files, fallbackName),
          installedAt,
          fallbackName,
        );
      } else if (lowerName.endsWith(".json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const entries = getFolderImportEntries(parsed, ["extensions"]).map((entry) =>
          createInlineFolderPackageImportEntry(entry, file.name),
        );
        await importExtensionEntries(entries, installedAt, fallbackName);
      } else if (/\.server\.(js|mjs|cjs)$/i.test(lowerName)) {
        const text = await file.text();
        const name = file.name.replace(/\.server\.(js|mjs|cjs)$/i, "");
        try {
          await createExtension.mutateAsync({
            name,
            description: "Server extension imported from file",
            runtime: "server",
            serverJs: text,
            enabled: false,
            installedAt,
          });
        } catch (err) {
          throw new Error(describeExtensionImportError(err, name));
        }
        toast.success(`Server extension "${name}" imported and left disabled for review`);
      } else if (/\.(js|mjs|cjs)$/i.test(lowerName)) {
        const text = await file.text();
        const name = file.name.replace(/\.(js|mjs|cjs)$/i, "");
        try {
          await createExtension.mutateAsync({
            name,
            description: "JS extension imported from file",
            runtime: "client",
            js: text,
            enabled: false,
            installedAt,
          });
        } catch (err) {
          throw new Error(describeExtensionImportError(err, name));
        }
        toast.success(`Extension "${name}" imported and left disabled for review`);
      } else if (lowerName.endsWith(".css")) {
        const text = await file.text();
        const name = file.name.replace(/\.css$/i, "");
        try {
          await createExtension.mutateAsync({
            name,
            description: "CSS extension imported from file",
            runtime: "client",
            css: text,
            enabled: false,
            installedAt,
          });
        } catch (err) {
          throw new Error(describeExtensionImportError(err, name));
        }
        toast.success(`Extension "${name}" imported and left disabled for review`);
      } else {
        toast.error(
          "Only .zip, .json, .css, .js, .mjs, .cjs, .server.js, .server.mjs, and .server.cjs files are supported.",
        );
      }
    } catch (err) {
      toast.error(getPrivilegedActionErrorMessage(err, "Failed to import extension."));
    }
  };

  const handleImportExtensionFolder = async (selectedFiles: FileList | null) => {
    try {
      const installedAt = new Date().toISOString();
      const files = await readTextFilesFromFileList(selectedFiles);
      const folderName = getLooseExtensionFolderName(files, "extension");
      const entries = collectFolderPackageEntries(files, {
        rootFilenames: ["marinara-extensions.json", "marinara-extension.json"],
        collectionKeys: ["extensions"],
      });
      await importExtensionEntries(
        entries.length > 0 ? entries : createLooseExtensionFolderImportEntries(files, folderName),
        installedAt,
        folderName,
      );
    } catch (err) {
      toast.error(getPrivilegedActionErrorMessage(err, "Failed to import extension folder."));
    }
  };

  const handleToggleExtension = async (ext: InstalledExtension) => {
    const nextEnabled = !ext.enabled;
    if (nextEnabled && ext.runtime === "server") {
      const confirmed = await showConfirmDialog({
        title: "Enable Server Extension",
        message: `Enable "${ext.name}"? This runs trusted JavaScript inside the Marinara Node.js server process and can affect this server until disabled. Only enable code you trust.`,
        confirmLabel: "Enable Server Extension",
        tone: "destructive",
      });
      if (!confirmed) return;
    } else if (nextEnabled && ext.js?.trim()) {
      const confirmed = await showConfirmDialog({
        title: "Enable Extension",
        message: `Enable "${ext.name}"? This runs the extension's JavaScript inside Marinara Engine.`,
        confirmLabel: "Enable",
        tone: "destructive",
      });
      if (!confirmed) return;
    }

    try {
      await updateExtension.mutateAsync({ id: ext.id, enabled: nextEnabled });
    } catch (err) {
      toast.error(getPrivilegedActionErrorMessage(err, "Failed to update extension."));
    }
  };

  const handleDeleteExtension = async (ext: InstalledExtension) => {
    const confirmed = await showConfirmDialog({
      title: "Delete Extension",
      message: `Delete "${ext.name}"? This permanently removes its saved extension code from this server.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;

    try {
      await deleteExtension.mutateAsync(ext.id);
      toast.success(`Extension "${ext.name}" removed`);
    } catch (err) {
      toast.error(getPrivilegedActionErrorMessage(err, "Failed to remove extension."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {showIntro && (
        <SettingsIntro>Install browser or trusted server extensions to add custom behavior or styling.</SettingsIntro>
      )}

      <SettingsSection
        title="Extension Library"
        description="Import, enable, disable, export, or remove installed extensions."
        icon={<Puzzle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("extension-library")}
      >
        <div className="flex flex-col gap-3">
          {/* Import button */}
          <button
            onClick={() => {
              triggerFilePicker({
                accept: ".zip,.json,.css,.js,.mjs,.cjs,.server.js,.server.mjs,.server.cjs,application/zip,application/json",
                onSelect: (files) => {
                  const file = files[0];
                  if (file) void handleImportExtensionFile(file);
                },
              });
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/50"
          >
            <Download size="0.875rem" /> Import Extension File (.zip, .json, .css, .js, .mjs, .cjs, or .server.js)
          </button>
          <button
            onClick={() => {
              triggerFilePicker({
                multiple: true,
                webkitdirectory: true,
                onSelect: (files) => void handleImportExtensionFolder(files),
              });
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]/50"
          >
            <FolderOpen size="0.875rem" /> Import Extension Folder
          </button>

          {/* Extension list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Installed Extensions</span>

            {extensionList.map((ext) => (
              <div
                key={ext.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
                  ext.enabled
                    ? "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                    : "bg-[var(--secondary)]/40 text-[var(--muted-foreground)]",
                )}
              >
                <button
                  onClick={() => void handleToggleExtension(ext)}
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    ext.enabled
                      ? "text-emerald-400 hover:text-emerald-300"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  title={ext.enabled ? "Disable extension" : "Enable extension"}
                >
                  {ext.enabled ? <Power size="0.75rem" /> : <PowerOff size="0.75rem" />}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{ext.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-px text-[0.5625rem] font-semibold",
                        ext.runtime === "server"
                          ? "bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/20"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]",
                      )}
                    >
                      {ext.runtime === "server" ? "Server" : "Browser"}
                    </span>
                    {ext.runtime === "server" && ext.enabled && (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1 py-px text-[0.5625rem] font-semibold ring-1",
                          ext.serverStatus === "running"
                            ? "bg-emerald-500/12 text-emerald-300 ring-emerald-500/20"
                            : ext.serverStatus === "error"
                              ? "bg-[var(--destructive)]/12 text-[var(--destructive)] ring-[var(--destructive)]/20"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)]",
                        )}
                      >
                        {ext.serverStatus === "running"
                          ? "Running"
                          : ext.serverStatus === "error"
                            ? "Error"
                            : "Stopped"}
                      </span>
                    )}
                  </div>
                  {ext.description && (
                    <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{ext.description}</span>
                  )}
                  {ext.runtime === "server" && ext.serverError && (
                    <span className="truncate text-[0.625rem] text-[var(--destructive)]">{ext.serverError}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    downloadZipFile(
                      createExtensionFolderPackageFiles([
                        {
                          name: ext.name,
                          description: ext.description ?? "",
                          runtime: ext.runtime,
                          css: ext.css ?? null,
                          js: ext.js ?? null,
                          serverJs: ext.serverJs ?? null,
                          enabled: ext.enabled,
                        },
                      ]),
                      createExtensionFolderPackageFilename(ext.name, "extension"),
                    );
                  }}
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                  title="Export extension"
                >
                  <Upload size="0.6875rem" />
                </button>
                <button
                  onClick={() => void handleDeleteExtension(ext)}
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Remove extension"
                >
                  <Trash2 size="0.6875rem" />
                </button>
              </div>
            ))}

            {!isLoading && extensionList.length === 0 && (
              <p className="mari-chrome-text-muted py-2 text-center text-[0.625rem]">
                No extensions installed. Import an extension file or folder above.
              </p>
            )}
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <strong>Folder format:</strong>{" "}
            <code className="rounded bg-[var(--secondary)] px-1">Extensions/My Extension/manifest.json</code>
            . Browser extensions can include CSS and/or JavaScript files to modify the UI.
          </div>
          <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <strong>Server extensions:</strong> use{" "}
            <code className="rounded bg-[var(--secondary)] px-1">runtime: "server"</code> with{" "}
            <code className="rounded bg-[var(--secondary)] px-1">serverJsPath</code>, or import a{" "}
            <code className="rounded bg-[var(--secondary)] px-1">.server.js</code> file. They run in the Node.js server
            process and should only come from trusted sources.
          </div>
          <div className="rounded-lg bg-[var(--secondary)]/35 p-2.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            Extensions can be downloaded from the official Marinara Engine Discord server.
          </div>
        </div>
      </SettingsSection>
    </div>
  );
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
  files?: number;
};

type ProfileImportWarning = {
  type?: string;
  path?: string;
  message?: string;
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
  fileFingerprint?: string;
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

function formatProfileImportStats(stats?: ProfileImportStats) {
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
    stats.files,
  ];
  return counts.reduce<number>((total, count) => total + (typeof count === "number" && count > 0 ? count : 0), 0);
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

function normalizeProfileImportWarnings(warnings: unknown): ProfileImportWarning[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const record = warning as { type?: unknown; path?: unknown; message?: unknown };
    const path = typeof record.path === "string" ? record.path : undefined;
    const message = typeof record.message === "string" ? record.message : undefined;
    const type = typeof record.type === "string" ? record.type : undefined;
    if (!path && !message) return [];
    return [{ type, path, message }];
  });
}

function formatProfileImportWarningSummary(warnings: ProfileImportWarning[]) {
  const missingAssets = warnings.filter((warning) => warning.type === "missing_asset" || warning.path);
  if (missingAssets.length > 0) {
    return `${missingAssets.length} asset file${missingAssets.length === 1 ? "" : "s"} missing from the ZIP. Imported the rest.`;
  }
  return `${warnings.length} import warning${warnings.length === 1 ? "" : "s"}.`;
}

function formatProfileImportWarningDetails(warnings: ProfileImportWarning[]) {
  const paths = warnings.map((warning) => warning.path).filter((path): path is string => !!path);
  if (paths.length === 0) return warnings[0]?.message ?? "";
  const visible = paths.slice(0, 3).join(", ");
  const extra = paths.length > 3 ? `, +${paths.length - 3} more` : "";
  return `Missing: ${visible}${extra}`;
}

function formatProfileImportConfirmationMessage(preview: ProfileImportPreviewResult) {
  const warnings = normalizeProfileImportWarnings(preview.warnings);
  const found = formatProfileImportStats(preview.imported) || "no counted records";
  const warningDetail =
    warnings.length > 0
      ? `${formatProfileImportWarningSummary(warnings)} ${formatProfileImportWarningDetails(warnings)}`
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

  const handleProfileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          toast.error("Not a valid profile export file.");
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
        title: "Import Profile",
        message: formatProfileImportConfirmationMessage(preview),
        confirmLabel: "Import",
        cancelLabel: "Cancel",
        tone: "destructive",
      });
      if (!confirmed) {
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
          toast.error("Not a valid profile export file.");
          e.target.value = "";
          return;
        }
      }
      setProfileImportProgress((current) =>
        current
          ? {
              ...current,
              status: "starting",
              label: isZip ? "Uploading profile archive" : "Starting profile import",
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }
          : current,
      );
      const res = await api.raw("/backup/import-profile", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          ...(preview.fileFingerprint ? { "X-Profile-Preview-Fingerprint": preview.fileFingerprint } : {}),
        },
        body: makeImportBody(isZip, profileText),
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
          const summary = formatProfileImportStats(imported);
          setProfileImportProgress((current) => {
            const totalItems = Math.max(1, current?.totalItems ?? 1);
            return {
              status: "success",
              label: warnings.length > 0 ? "Profile import complete with missing assets" : "Profile import complete",
              completedItems: totalItems,
              totalItems,
              startedAt,
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
              imported,
              warnings,
            };
          });
          if (warnings.length > 0) {
            const warningSummary = formatProfileImportWarningSummary(warnings);
            toast.warning(summary ? `Imported: ${summary}. ${warningSummary}` : warningSummary);
          } else {
            toast.success(summary ? `Imported: ${summary}` : "Profile imported.");
          }
        }
      }
      if (!importCompleted) {
        throw new Error("Profile import stream closed before completion.");
      }
    } catch (err) {
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
        Import data from Marinara exports, SillyTavern, or asset folders. Full profile imports also restore synced
        custom themes and profile archive assets.
      </SettingsIntro>

      <SettingsSection
        title="Profile & Marinara"
        description="Restore full profiles or import individual Marinara files."
        icon={<Download size="0.875rem" />}
        {...getSettingsSectionAnchorProps("profile-marinara")}
      >
        <div className="flex flex-col gap-2.5">
          <label
            className={cn(
              SETTINGS_PRIMARY_BUTTON_CLASS,
              "w-full cursor-pointer gap-2",
              profileImportBusy && "pointer-events-none opacity-75",
            )}
          >
            {profileImportBusy ? <Loader2 size="1rem" className="animate-spin" /> : <Download size="1rem" />}
            {profileImportBusy
              ? profileImportProgress?.status === "reading" || profileImportProgress?.status === "preview"
                ? "Scanning Profile..."
                : "Importing Profile..."
              : "Import Profile (JSON/ZIP)"}
            <input
              type="file"
              accept=".json,.zip,application/json,application/zip"
              onChange={handleProfileImport}
              disabled={profileImportBusy}
              className="hidden"
            />
          </label>

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
                      {profileImportProgress.completedItems}/{profileImportProgress.totalItems} items
                    </span>
                    {estimateProfileImportRemainingSeconds(profileImportProgress) !== null && (
                      <span>
                        ETA{" "}
                        {formatProfileImportDuration(estimateProfileImportRemainingSeconds(profileImportProgress) ?? 0)}
                      </span>
                    )}
                  </div>
                  {formatProfileImportStats(profileImportProgress.imported) && (
                    <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {profileImportProgress.status === "preview" ? "Found" : "Imported so far"}:{" "}
                      {formatProfileImportStats(profileImportProgress.imported)}
                    </div>
                  )}
                  {profileImportProgress.warnings?.length ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[0.6875rem] text-amber-700 dark:text-amber-200">
                      <div className="font-medium">
                        {formatProfileImportWarningSummary(profileImportProgress.warnings)}
                      </div>
                      {formatProfileImportWarningDetails(profileImportProgress.warnings) && (
                        <div className="mt-0.5 break-words text-amber-700/80 dark:text-amber-100/80">
                          {formatProfileImportWarningDetails(profileImportProgress.warnings)}
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
        title="SillyTavern Import"
        description="Bring over characters, chats, presets, and lorebooks from SillyTavern files."
        icon={<FolderOpen size="0.875rem" />}
        {...getSettingsSectionAnchorProps("sillytavern-import")}
      >
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => openModal("st-bulk-import")}
            className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, "w-full gap-2")}
          >
            <Download size="1rem" />
            Import from SillyTavern Folder
          </button>

          <div className="flex flex-col gap-2">
            <ImportButton
              label="Import Character (JSON/PNG)"
              accept=".json,.png"
              endpoint="/import/st-character"
              mode="auto"
            />
            <ImportButton
              label="Import Chat (JSONL)"
              accept=".jsonl"
              endpoint="/import/st-chat"
              mode="file"
              onImported={(data) => {
                qc.invalidateQueries({ queryKey: chatKeys.list() });
                if (data.chatId) setActiveChatId(data.chatId);
              }}
            />
            <ImportButton label="Import Preset (JSON)" accept=".json" endpoint="/import/st-preset" mode="json" />
            <ImportButton label="Import Lorebook (JSON)" accept=".json" endpoint="/import/st-lorebook" mode="json" />
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
            `${preview.name ?? file.name} includes an embedded lorebook with ${preview.embeddedLorebookEntries} entr${
              preview.embeddedLorebookEntries === 1 ? "y" : "ies"
            }.\n\nImport it as a standalone Marinara lorebook too?`,
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
          toast.success("Imported successfully!");
        }
      } else {
        toast.error(`Import failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      toast.error("Import failed.");
    }
    e.target.value = "";
  };

  return (
    <label className={cn(SETTINGS_BUTTON_CLASS, "cursor-pointer py-2.5")}>
      {label}
      <input type="file" accept={accept} onChange={handleImport} className="hidden" />
    </label>
  );
}

function AdvancedSettings() {
  const showTimestamps = useUIStore((s) => s.showTimestamps);
  const setShowTimestamps = useUIStore((s) => s.setShowTimestamps);
  const showModelName = useUIStore((s) => s.showModelName);
  const setShowModelName = useUIStore((s) => s.setShowModelName);
  const showTokenUsage = useUIStore((s) => s.showTokenUsage);
  const setShowTokenUsage = useUIStore((s) => s.setShowTokenUsage);
  const showMessageNumbers = useUIStore((s) => s.showMessageNumbers);
  const setShowMessageNumbers = useUIStore((s) => s.setShowMessageNumbers);
  const guideGenerations = useUIStore((s) => s.guideGenerations);
  const setGuideGenerations = useUIStore((s) => s.setGuideGenerations);
  const showQuickRepliesMenu = useUIStore((s) => s.showQuickRepliesMenu);
  const setShowQuickRepliesMenu = useUIStore((s) => s.setShowQuickRepliesMenu);
  const showQuickReplyPostOnly = useUIStore((s) => s.showQuickReplyPostOnly);
  const setShowQuickReplyPostOnly = useUIStore((s) => s.setShowQuickReplyPostOnly);
  const showQuickReplyGuide = useUIStore((s) => s.showQuickReplyGuide);
  const setShowQuickReplyGuide = useUIStore((s) => s.setShowQuickReplyGuide);
  const showQuickReplyImpersonate = useUIStore((s) => s.showQuickReplyImpersonate);
  const setShowQuickReplyImpersonate = useUIStore((s) => s.setShowQuickReplyImpersonate);
  const includeReasoningInExports = useUIStore((s) => s.includeReasoningInExports);
  const setIncludeReasoningInExports = useUIStore((s) => s.setIncludeReasoningInExports);
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
  const [quickRepliesDrawerOpen, setQuickRepliesDrawerOpen] = useState(true);
  const nativeConsoleBridge = getMarinaraAndroidBridge();
  const canOpenNativeConsole = typeof nativeConsoleBridge?.openConsole === "function";
  const nativeConsoleHelp = getNativeConsoleShortcutHelp();

  const handleQuickRepliesMenuChange = (enabled: boolean) => {
    setShowQuickRepliesMenu(enabled);
    if (enabled) setQuickRepliesDrawerOpen(true);
  };

  const handleOpenNativeConsole = useCallback(() => {
    const bridge = getMarinaraAndroidBridge();
    if (typeof bridge?.openConsole !== "function") {
      toast.info(getNativeConsoleShortcutHelp());
      return;
    }

    bridge.openConsole();
    toast.info("Opening Termux console…");
  }, []);

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
            title: "Export profile as ZIP?",
            message: failure.message,
            confirmLabel: "Export ZIP",
            cancelLabel: "Cancel",
          });
          if (confirmed) {
            await handleExportProfile("zip");
          }
          return;
        }
        throw new Error(failure.message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getDownloadFilename(res, profileExportFallbackNames[format]);
      a.click();
      URL.revokeObjectURL(url);
      toast.success(profileExportSuccessMessages[format]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export profile");
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
      toast.info("Clearing caches and refreshing app…");
      await forceRefreshSpa();
    } catch (err) {
      setRefreshingSpa(false);
      toast.error(err instanceof Error ? err.message : "Failed to refresh the app");
    }
  };

  const qc = useQueryClient();
  const [creatingBackup, setCreatingBackup] = useState(false);

  /**
   * Download a full backup to a user-chosen location.
   *
   * Uses the File System Access API (`showSaveFilePicker`) when available so
   * the browser opens a native "Save As" dialog — this is important on Android
   * and iOS, where the server-side `data/backups/` folder isn't reachable
   * without root. Falls back to an anchor-triggered download (which routes
   * through the browser's default Downloads handling).
   */
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch("/api/backup/download", {
        method: "POST",
        headers: getAdminSecretHeader(),
      });
      if (!res.ok) throw new Error(await readSettingsResponseError(res, "Backup failed"));

      // Pull the filename from Content-Disposition if provided
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
      const suggestedName = filenameMatch?.[1] ?? `marinara-backup-${timestamp}.zip`;

      const blob = await res.blob();

      // Preferred path: native "Save As" dialog (Chromium desktop, some Android)
      const w = window as typeof window & {
        showSaveFilePicker?: (options: {
          suggestedName?: string;
          types?: Array<{ description?: string; accept: Record<string, string[]> }>;
        }) => Promise<{
          createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
        }>;
      };
      if (typeof w.showSaveFilePicker === "function") {
        try {
          const handle = await w.showSaveFilePicker({
            suggestedName,
            types: [
              {
                description: "Marinara backup archive",
                accept: { "application/zip": [".zip"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("Backup saved!");
          qc.invalidateQueries({ queryKey: ["backups"] });
          return;
        } catch (err) {
          // User cancelled the native picker — treat as a silent no-op
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Any other failure falls through to the anchor fallback
        }
      }

      // Fallback: anchor download. On Android Chrome this routes through the
      // system Downloads handler (which typically prompts the user or drops
      // the file in the Downloads folder, both of which are user-accessible).
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded!");
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreatingBackup(false);
    }
  };

  const { data: backups } = useQuery<{ name: string; createdAt: string; path: string }[]>({
    queryKey: ["backups"],
    queryFn: () => api.get("/backup"),
  });

  const health = useQuery<{
    status: string;
    timestamp: string;
    version: string;
    commit: string | null;
    build: string;
  }>({
    queryKey: ["health"],
    queryFn: () => api.get("/health"),
    staleTime: 60_000,
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/backup/${name}`),
    onSuccess: () => {
      toast.success("Backup deleted");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
  });

  const saveAdminSecret = useCallback(() => {
    const trimmed = adminSecret.trim();
    if (trimmed) {
      localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, trimmed);
      toast.success("Admin secret saved for this browser");
    } else {
      localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
      toast.info("Admin secret cleared");
    }
  }, [adminSecret]);

  type UpdateChannelId = "stable" | "staging";
  const [updateChannel, setUpdateChannel] = useState<UpdateChannelId | null>(null);
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
    dockerLiteImageTag?: string;
    installType: "git" | "docker" | "standalone";
    serverPlatform?: "windows" | "macos" | "linux" | "android-termux" | "unknown";
    clientPlatform?: "ios" | "android" | "desktop" | "unknown";
    applyAvailable?: boolean;
    updatesApplyEnabled?: boolean;
    applyUnavailableReason?: "disabled" | "unsupported-install" | "container-install" | null;
    manualUpdateCommand?: string | null;
    manualUpdateHint?: string | null;
  }>({
    queryKey: ["update-check", updateChannel ?? "current"],
    queryFn: () =>
      api.get(updateChannel ? `/updates/check?channel=${encodeURIComponent(updateChannel)}` : "/updates/check"),
    enabled: false,
    retry: false,
  });

  const selectedUpdateChannelId = updateChannel ?? updateCheck.data?.channel ?? "stable";

  const applyUpdate = useMutation({
    mutationFn: () =>
      api.post<{ status: string; message: string }>("/updates/apply", {
        confirm: true,
        channel: selectedUpdateChannelId,
        currentVersion: updateCheck.data?.currentVersion ?? health.data?.version ?? APP_VERSION,
        currentCommit: updateCheck.data?.currentCommit ?? health.data?.commit ?? null,
        currentBuild: updateCheck.data?.currentBuild ?? health.data?.build ?? null,
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
        onSuccess: () => toast.success("All selected data was cleared. Runtime caches were reset immediately."),
        onError: () => toast.error("Failed to clear all data."),
        onSettled: () => setConfirmAction(null),
      });
      return;
    }

    expungeData.mutate(selectedScopes, {
      onSuccess: () => toast.success("Selected data was cleared. Runtime caches were reset immediately."),
      onError: () => toast.error("Failed to clear selected data."),
      onSettled: () => setConfirmAction(null),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ExportFormatDialog
        open={exportProfileDialogOpen}
        title="Export Profile"
        description="Native creates a Marinara profile JSON for restoring your data in Marinara. If the JSON would be too large, Marinara will offer a profile ZIP instead."
        nativeDescription="Keeps Marinara fields, lorebook folders, character/persona metadata, presets, agents, themes, and inline assets for re-import."
        compatibleDescription="Exports direct character JSON, simple persona JSON, and folderless lorebooks for other roleplay tools."
        onClose={() => setExportProfileDialogOpen(false)}
        onSelect={handleExportProfileChoice}
      />

      <SettingsIntro>
        Server maintenance, message utilities, backups, and data removal.
      </SettingsIntro>

      <SettingsSection
        title="Admin Access"
        description="Save the browser-side admin secret for protected maintenance actions."
        icon={<Power size="0.875rem" />}
        {...getSettingsSectionAnchorProps("admin-access")}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            className="w-full min-w-0 rounded-lg bg-[var(--background)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
          />
          <button
            type="button"
            onClick={saveAdminSecret}
            className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, "w-full gap-2 whitespace-nowrap")}
          >
            <span className="flex min-w-0 items-center justify-center gap-1.5">
              <Save size="0.75rem" className="shrink-0" />
              Save
            </span>
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Updates"
        description="Check this install, apply supported updates, or force-refresh the web shell."
        icon={<RefreshCw size="0.875rem" />}
        {...getSettingsSectionAnchorProps("updates")}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <label
              id={getSettingsControlAnchorId("release-channel")}
              className="flex scroll-mt-3 min-w-0 flex-col gap-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Release Channel
              <select
                value={selectedUpdateChannelId}
                onChange={(event) => setUpdateChannel(event.target.value as UpdateChannelId)}
                className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs font-medium normal-case tracking-normal text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
              >
                {updateChannelOptions.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => updateCheck.refetch()}
              disabled={updateCheck.isFetching}
              className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, "w-full gap-2")}
            >
              {updateCheck.isFetching ? (
                <>
                  <Loader2 size="0.8125rem" className="animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <RefreshCw size="0.8125rem" />
                  Check for Updates
                </>
              )}
            </button>
            <div className="flex flex-col px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <span>Release: {currentReleaseLabel}</span>
              <span>{currentBuildLabel}</span>
              {updateCheck.data?.currentBranch && <span>Branch: {updateCheck.data.currentBranch}</span>}
            </div>
          </div>

          {selectedUpdateChannel?.warning && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[0.6875rem] text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-200">
              <AlertTriangle size="0.8125rem" className="mt-0.5 shrink-0" />
              <span>{selectedUpdateChannel.warning}</span>
            </div>
          )}

          {updateCheck.data && !updateCheck.data.updateAvailable && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-2 ring-1 ring-[var(--border)]">
              <Check size="0.8125rem" className="text-green-500 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs">
                  You're on the latest {updateCheck.data.channelLabel ?? "release"} target ({currentReleaseLabel})
                </span>
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{currentBuildLabel}</span>
              </div>
            </div>
          )}

          {updateCheck.data?.updateAvailable && (
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--secondary)] p-2.5 ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {updateCheck.data.versionUpdate
                    ? `v${updateCheck.data.latestVersion} available`
                    : `${commitsBehind} commit${commitsBehind !== 1 ? "s" : ""} behind ${updateCheck.data.targetRef ?? "origin/main"}`}
                </span>
                {updateCheck.data.versionUpdate && (
                  <a
                    href={updateCheck.data.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[0.625rem] text-[var(--primary)] hover:underline"
                  >
                    Release notes <ExternalLink size="0.625rem" />
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
                  Commit counts compare this build with {updateCheck.data.targetRef ?? "origin/main"} and may include
                  unreleased development commits, not just tagged releases.
                </p>
              )}
              {isIosClient && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  On iPhone or iPad, this updates the Marinara server you are connected to. Reload the Home Screen app
                  after the host finishes updating.
                </p>
              )}
              {updateCheck.data.applyAvailable ? (
                <button
                  onClick={() => applyUpdate.mutate()}
                  disabled={applyUpdate.isPending}
                  className={SETTINGS_PRIMARY_BUTTON_CLASS}
                >
                  {applyUpdate.isPending ? (
                    <>
                      <Loader2 size="0.8125rem" className="animate-spin" />
                      Updating…
                    </>
                  ) : (
                    <>
                      <Download size="0.8125rem" />
                      Apply Update
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
                      className={SETTINGS_PRIMARY_BUTTON_CLASS}
                    >
                      <Download size="0.8125rem" />
                      Download v{updateCheck.data.latestVersion}
                    </a>
                  )}
                  {updateCheck.data.versionUpdate && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Android APK assets are WebView shells, not standalone apps. Start Marinara in Termux first.
                    </span>
                  )}
                  {manualUpdateHint && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">{manualUpdateHint}</span>
                  )}
                  {installType === "docker" && updateCheck.data.dockerImageTag && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Container tag:{" "}
                      <code className="break-all rounded bg-[var(--background)] px-1 py-0.5">
                        {updateCheck.data.dockerImageTag}
                      </code>
                      {updateCheck.data.dockerLiteImageTag ? (
                        <>
                          {" "}
                          Lite:{" "}
                          <code className="break-all rounded bg-[var(--background)] px-1 py-0.5">
                            {updateCheck.data.dockerLiteImageTag}
                          </code>
                        </>
                      ) : null}
                    </span>
                  )}
                  {manualUpdateCommand && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Manual update:{" "}
                      <code className="break-all rounded bg-[var(--background)] px-1 py-0.5">
                        {manualUpdateCommand}
                      </code>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {updateCheck.isError && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-xs text-[var(--destructive)]">
              <AlertTriangle size="0.8125rem" className="shrink-0" />
              Could not check for updates. Try again later.
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleForceRefreshSpa()}
              disabled={refreshingSpa}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--background)]/70 px-3 py-2 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshingSpa ? (
                <>
                  <Loader2 size="0.8125rem" className="animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>
                  <RefreshCw size="0.8125rem" />
                  Refresh App
                </>
              )}
            </button>
            <HelpTooltip
              side="bottom"
              text="Manual refresh unregisters the active service worker and clears browser caches before reloading. Marinara's stored chats, settings, and other local app data stay intact."
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Message Tools"
        description="Quick reply actions, message metadata, and debug visibility."
        icon={<MessageCircle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("message-tools")}
      >
        <div className="flex flex-col gap-2.5">
          <div
            id={getSettingsControlAnchorId("quick-replies")}
            className={cn(
              "scroll-mt-3 overflow-hidden rounded-xl border transition-colors",
              showQuickRepliesMenu
                ? "border-[var(--primary)]/30 bg-[var(--secondary)]/15"
                : "border-transparent bg-transparent hover:bg-[var(--secondary)]/30",
            )}
          >
            <div className="flex min-h-9 items-stretch">
              <div className="flex min-w-0 items-center gap-1.5 py-2 pl-1.5 pr-2">
                <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={showQuickRepliesMenu}
                    onChange={(e) => handleQuickRepliesMenuChange(e.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
                  />
                  <span className="min-w-0 text-xs">Quick replies</span>
                </label>
                <span className="shrink-0" onClick={(e) => e.preventDefault()}>
                  <HelpTooltip text="Adds alternate draft actions beside Send. One action appears directly; multiple actions open from the ellipsis." />
                </span>
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showQuickRepliesMenu) return;
                  setQuickRepliesDrawerOpen((open) => !open);
                }}
                aria-disabled={!showQuickRepliesMenu}
                aria-controls="quick-replies-actions-drawer"
                aria-expanded={showQuickRepliesMenu && quickRepliesDrawerOpen}
                aria-label={
                  !showQuickRepliesMenu
                    ? "Quick replies options disabled"
                    : quickRepliesDrawerOpen
                      ? "Collapse Quick replies options"
                      : "Expand Quick replies options"
                }
                title={
                  !showQuickRepliesMenu
                    ? "Enable Quick replies to configure options"
                    : quickRepliesDrawerOpen
                      ? "Collapse options"
                      : "Expand options"
                }
                className={cn(
                  "flex min-w-10 flex-1 items-center justify-end py-2 pl-2 pr-2 text-[var(--muted-foreground)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                  showQuickRepliesMenu && quickRepliesDrawerOpen ? "rounded-tr-xl" : "rounded-r-xl",
                  showQuickRepliesMenu
                    ? "cursor-pointer hover:bg-[var(--secondary)]/35 hover:text-[var(--foreground)] active:scale-[0.99]"
                    : "cursor-not-allowed opacity-35",
                )}
                tabIndex={showQuickRepliesMenu ? 0 : -1}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg">
                  <ChevronDown
                    size="0.875rem"
                    aria-hidden="true"
                    className={cn(
                      "transition-transform",
                      showQuickRepliesMenu && quickRepliesDrawerOpen ? "" : "-rotate-90",
                    )}
                  />
                </span>
              </button>
            </div>
            {showQuickRepliesMenu && quickRepliesDrawerOpen && (
              <div
                id="quick-replies-actions-drawer"
                className="grid gap-1 border-t border-[var(--border)]/60 bg-[var(--background)]/25 p-1"
                role="group"
                aria-label="Quick replies actions to include"
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
                      className={cn(
                        "group flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] active:scale-[0.99]",
                        option.checked
                          ? "bg-[var(--primary)]/8 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                          : "text-[var(--muted-foreground)] ring-1 ring-transparent hover:bg-[var(--secondary)]/45 hover:text-[var(--foreground)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 transition-colors",
                          option.checked
                            ? "bg-[var(--primary)]/12 text-[var(--primary)] ring-[var(--primary)]/30"
                            : "bg-[var(--secondary)]/35 text-[var(--muted-foreground)] ring-[var(--border)]/60 group-hover:text-[var(--foreground)]",
                        )}
                      >
                        <Icon size="0.8125rem" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">{option.label}</span>
                        <span className="block text-[0.65rem] leading-tight text-[var(--muted-foreground)]">
                          {option.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
                          option.checked
                            ? "mari-accent-animated bg-[var(--accent)] text-[var(--primary)] ring-[var(--primary)]/35"
                            : "bg-[var(--background)]/45 text-transparent ring-[var(--border)]/70 group-hover:text-[var(--muted-foreground)]",
                        )}
                        aria-hidden="true"
                      >
                        <Check size="0.625rem" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-message-timestamps")}
            label="Show message timestamps"
            checked={showTimestamps}
            onChange={setShowTimestamps}
            help="Displays the date and time each message was sent next to it in the chat."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-model-name")}
            label="Show model name on messages"
            checked={showModelName}
            onChange={setShowModelName}
            help="Displays which AI model generated each response, shown as a small label on assistant messages."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-token-usage")}
            label="Show token usage on messages"
            checked={showTokenUsage}
            onChange={setShowTokenUsage}
            help="Displays prompt and completion token counts on each AI message. Useful for monitoring context size and cost."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-message-numbers")}
            label="Show message numbers"
            checked={showMessageNumbers}
            onChange={setShowMessageNumbers}
            help="Displays message numbers in roleplay and conversation chats."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("guide-generations")}
            label="Guide swipes/regens with chat input"
            checked={guideGenerations}
            onChange={setGuideGenerations}
            help="Uses the current draft as direction when regenerating a message or manually triggering a character response."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("include-reasoning-in-exports")}
            label="Include reasoning in exports"
            checked={includeReasoningInExports}
            onChange={setIncludeReasoningInExports}
            help="Includes saved hidden thinking/reasoning metadata in JSONL and text chat exports. Keep this off when sharing transcripts."
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("debug-mode")}
            label="Debug mode"
            checked={debugMode}
            onChange={setDebugMode}
            help="Logs the prompt and response payloads sent to the model in the server console for debugging."
          />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1" title={nativeConsoleHelp}>
              <button
                type="button"
                onClick={handleOpenNativeConsole}
                disabled={!canOpenNativeConsole}
                className={cn(SETTINGS_BUTTON_CLASS, "w-full justify-center gap-1.5 px-3 py-2 text-xs")}
              >
                <Terminal size="0.8125rem" className="shrink-0" />
                <span>Open Console</span>
              </button>
            </div>
            <HelpTooltip side="bottom" text={nativeConsoleHelp} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Backup & Export"
        description="Download profile exports or full backup archives for recovery and migration."
        help="Download a full backup as a .zip archive (storage snapshots + avatars, sprites, backgrounds, gallery, fonts, knowledge sources). Import Profile can restore the zip directly. The raw folders are for manual recovery."
        icon={<Download size="0.875rem" />}
        {...getSettingsSectionAnchorProps("backup-export")}
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className={SETTINGS_PRIMARY_BUTTON_CLASS}
          >
            {creatingBackup ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                Creating backup…
              </>
            ) : (
              <>
                <Download size="0.8125rem" />
                Download Backup
              </>
            )}
          </button>
          <button
            onClick={() => setExportProfileDialogOpen(true)}
            disabled={exportingProfile}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium ring-1 ring-[var(--border)] transition-all hover:bg-[var(--secondary)]/80 active:scale-95 disabled:opacity-50"
          >
            {exportingProfile ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                Export Profile
              </>
            )}
          </button>
          {backups && backups.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Existing backups</span>
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
                    onClick={() => deleteBackupMutation.mutate(b.name)}
                    className="ml-2 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
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
        title="Danger Zone"
        description="Permanently clear selected categories of local data. Professor Mari is always preserved."
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
                      : "bg-[var(--background)]/40 ring-[var(--border)] hover:bg-[var(--secondary)]/70",
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
              onClick={() =>
                setSelectedScopes(isAllScopesSelected ? [] : EXPUNGE_SCOPE_OPTIONS.map((scope) => scope.id))
              }
              disabled={isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "w-full px-3 py-2 text-xs")}
            >
              {isAllScopesSelected ? "Clear Selection" : "Select All"}
            </button>
            <button
              onClick={() => setConfirmAction("selected")}
              disabled={selectedScopes.length === 0 || isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "w-full px-3 py-2 text-xs")}
            >
              <Trash2 size="0.8125rem" />
              Clear Selected Data
            </button>
            <button
              onClick={() => setConfirmAction("all")}
              disabled={isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "w-full px-3 py-2 text-xs")}
            >
              <Trash2 size="0.8125rem" />
              Clear All Data
            </button>
          </div>
          {confirmAction && (
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--background)]/55 p-2.5 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-2 text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-text)]">
                <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
                {confirmAction === "all"
                  ? "Delete all supported data categories except Professor Mari? There is no undo."
                  : `Delete ${selectedScopes.length} selected data categor${selectedScopes.length === 1 ? "y" : "ies"}? There is no undo.`}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={isClearing}
                  className={cn(SETTINGS_BUTTON_CLASS, "w-full px-3 py-2 text-xs")}
                >
                  Cancel
                </button>
                <button
                  onClick={() => runExpunge(confirmAction)}
                  disabled={isClearing}
                  className={cn(SETTINGS_BUTTON_CLASS, "w-full px-3 py-2 text-xs")}
                >
                  {isClearing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
