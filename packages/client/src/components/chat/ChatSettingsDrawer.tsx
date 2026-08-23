// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { Fragment, lazy, Suspense, useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  X,
  Users,
  User,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Image,
  Pencil,
  AlertTriangle,
  GripVertical,
  MessageCircle,
  MessageSquareQuote,
  Bot,
  CalendarClock,
  Camera,
  Clapperboard,
  RefreshCw,
  Settings2,
  Info,
  ArrowRightLeft,
  Archive,
  Unlink,
  Brain,
  Vibrate,
  Feather,
  Paintbrush,
  Regex,
  Activity,
  Puzzle,
  Save,
  FileText,
  FilePlus2,
  FolderOpen,
  Upload,
  Download,
  Star,
  StickyNote,
  Eye,
  EyeOff,
  Music2,
  ShieldCheck,
  Loader2,
  Wrench,
  Map as MapIcon,
  VenetianMask,
} from "lucide-react";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  getChatFloatingPanelDesktopRight,
  isChatToolbarPanelTrigger,
  type ChatToolbarFloatingPanelAnchor,
} from "./ChatToolbarControls";
import { PickerDropdown } from "../../features/chat-settings/PickerDropdown";
import { ChatSettingsSection as Section } from "../../features/chat-settings/ChatSettingsSection";
import { AdvancedParametersSection } from "../../features/chat-settings/sections/AdvancedParametersSection";
import { ChatNameSection } from "../../features/chat-settings/sections/ChatNameSection";
import { CombatStyleSection } from "../../features/chat-settings/sections/CombatStyleSection";
import { ConnectionSection } from "../../features/chat-settings/sections/ConnectionSection";
import { ConversationPromptSection } from "../../features/chat-settings/sections/ConversationPromptSection";
import { DiscordMirrorControls } from "../../features/chat-settings/sections/DiscordMirrorSection";
import { FunctionCallingSection } from "../../features/chat-settings/sections/FunctionCallingSection";
import { GameExtraPromptSection } from "../../features/chat-settings/sections/GameExtraPromptSection";
import { ImpersonateSection } from "../../features/chat-settings/sections/ImpersonateSection";
import { LorebooksSection } from "../../features/chat-settings/sections/LorebooksSection";
import { PromptPresetSection } from "../../features/chat-settings/sections/PromptPresetSection";
import { SceneInstructionsSection } from "../../features/chat-settings/sections/SceneInstructionsSection";
import { TranslationSection } from "../../features/chat-settings/sections/TranslationSection";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { showAlertDialog, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MacroTextarea } from "../ui/MacroTextarea";
import { Modal } from "../ui/Modal";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import {
  AGENT_SETTINGS_SURFACE_CLASS,
  AgentCategorySection,
  AgentDefaultStatus,
  AgentSettingsActionButton,
  AgentSettingsCard,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsTextarea,
  AgentSettingsToggle,
  GamePromptTemplateSelect,
  GenerationSettingsLink,
} from "./AgentSettingsControls";
import { ExpressionSpriteSettings } from "./ExpressionSpriteSettings";
import { AgentPromptTemplateSelect } from "./AgentPromptTemplateSelect";
import { HapticConnectionPanel } from "./HapticConnectionPanel";
import { HAPTIC_SENSITIVITY_OPTIONS } from "./haptic-sensitivity-options";
import { ChatModeIcon } from "./ChatModeIcon";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { SecretPlotPanel } from "../agents/SecretPlotPanel";
import { SummariesEditorModal } from "./SummariesEditorModal";
import { AgentSuiteModal } from "./AgentSuiteModal";
import { ConversationTimeZoneSelect } from "./ConversationTimeZoneSelect";
import { RoleplayMessagePreview } from "./ChatMessage";
import { CHAT_SETTINGS_SURFACES } from "./chat-settings-surfaces";
import { useCharacters, usePersonas, useCharacterGroups, type SpriteInfo } from "../../hooks/use-characters";
import { lorebookKeys, useLorebooks, useEntriesAcrossLorebooks } from "../../hooks/use-lorebooks";
import { useDefaultPreset, usePresetFull, usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useKnowledgeSources, useUploadKnowledgeSource } from "../../hooks/use-knowledge-sources";
import { useGenerate } from "../../hooks/use-generate";
import { useCapabilityAgentRegistry, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import {
  useUpdateChat,
  useUpdateChatMetadata,
  useCreateMessage,
  useChats,
  useConnectChat,
  useDisconnectChat,
  useChatMessagePeek,
  useChatMemories,
  useDeleteChatMemory,
  useClearChatMemories,
  useRefreshChatMemories,
  useExportChatMemories,
  useImportChatMemories,
  useChatNotes,
  useDeleteChatNote,
  useClearChatNotes,
  chatKeys,
} from "../../hooks/use-chats";
import { useUpdateGameWidgets } from "../../hooks/use-game";
import { useRegexScripts, useUpdateRegexScript, type RegexScriptRow } from "../../hooks/use-regex-scripts";
import { api } from "../../lib/api-client";
import { readCharacterGreetings, type CharacterGreeting } from "../../lib/character-greetings";
import { trackChatMetadataSave, waitForPendingChatMetadataSaves } from "../../lib/chat-metadata-save-barrier";
import { createSerializedMutationQueue } from "../../lib/serialized-mutation-queue";
import { appendLocalSidecarConnectionOption, filterLanguageGenerationConnections } from "../../lib/connection-filters";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
  type ActiveLorebookView,
} from "../../lib/chat-lorebooks";
import { getConnectedChatDisplayName } from "../../lib/chat-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";
import {
  getAgentRunIntervalMeta,
  getCadenceInputValue,
  parseCadenceInputValue,
  stepCadenceValue,
} from "../../lib/agent-cadence";
import { characterMatchesSearch, getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { buildRoleplayAgentSettingsOrder, hasStandaloneRoleplayAgentSettings } from "../../lib/agent-settings-order";
import { extractCreatorNotesCss } from "../../lib/creator-notes-css";
import { isLorebookScopeActiveForChat } from "../../lib/lorebook-scope";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { useUIStore } from "../../stores/ui.store";
import { abortGenerationForChat, useChatStore } from "../../stores/chat.store";
import { blurActiveChatFloatingUiControl, isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import {
  useChatPresets,
  useSaveChatPresetSettings,
  useDuplicateChatPreset,
  useUpdateChatPreset,
  useDeleteChatPreset,
  useApplyChatPreset,
  useImportChatPreset,
  useSetActiveChatPreset,
} from "../../hooks/use-chat-presets";
import type {
  AgentPhase,
  AgentPromptTemplateOption,
  ChatMode,
  ChatMemoryChunk,
  ChatMemoryRecallExportPayload,
  ChatPreset,
  ChatPresetSettings,
  ConversationCommandKey,
  ConversationNote,
  ExportEnvelope,
  HapticFeedbackSensitivity,
  HudWidget,
  KnowledgeAgentSourceSettings,
  Message,
  PromptPreset,
  SpotifySourceType,
  WeekSchedule,
} from "@marinara-engine/shared";
import {
  MAX_ILLUSTRATOR_IMAGES_PER_GENERATION,
  customAgentHasCapability,
  normalizeIllustratorImagesPerGeneration,
  normalizeSpotifySourceType,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import { useAgentConfigs, useCreateAgent, useUpdateAgent, type AgentConfigRow } from "../../hooks/use-agents";
import { useAgentStore } from "../../stores/agent.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  BUILT_IN_TOOLS,
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_AGENT_MAX_TOKENS,
  GAME_GM_BUILT_IN_PROMPT_TEMPLATES,
  getDefaultAgentPrompt,
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
  LIMITS,
  MIN_AGENT_MAX_TOKENS,
  PROFESSOR_MARI_ID,
  STORYBOARD_AGENT_ID,
  SUMMARY_TAIL_MESSAGES,
  estimateAgentLoadCost,
  getAgentPromptTemplateOptions,
  includesTextForMatch,
  AGENT_COST_HIGH_CALLS,
  AGENT_COST_HIGH_TOKENS,
  CONVERSATION_COMMAND_AGENT_IDS,
  CONVERSATION_COMMAND_KEYS,
  CHAT_SUMMARY_OUTPUT_TOKENS,
  getDefaultBuiltInAgentSettings,
  isAgentManifestAvailableInChatMode,
  isAgentConfigDeleted,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  mergeBuiltInAgentSettings,
  normalizeManualTrackerAgentTypes,
  normalizeAgentPromptTemplateOptions,
  normalizeAgentPhaseForType,
  normalizeAgentPromptTemplateSelectionMap,
  resolveDefaultAgentPromptTemplateId,
  resolveAgentPromptTemplate,
} from "@marinara-engine/shared";
import type {
  Chat,
  CharacterGroup,
  GameCombatStyle,
  Lorebook,
  SpriteCharacterVisualSettings,
} from "@marinara-engine/shared";
import {
  isCustomToolSelectable,
  useCustomToolCapabilities,
  useCustomTools,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import { normalizeSpritePlacements } from "./sprite-placement";
import {
  normalizeSpriteCharacterVisualSettingsMap,
  type LocalSpriteVisualSettings,
} from "./local-sprite-visual-settings";
import {
  DEFAULT_SPRITE_DISPLAY_MODES,
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_OPACITY_PERCENT_MAX,
  SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
  SPRITE_DISPLAY_SCALE_PERCENT_MAX,
  SPRITE_DISPLAY_SCALE_PERCENT_MIN,
  normalizeSpriteDisplayModes,
  type SpriteDisplayMode,
} from "./sprite-display-modes";
import {
  AgentAddSetupFields,
  applyAgentAddSetupToAgentSettings,
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
  normalizeCustomMusicExternalFolder,
  normalizeCustomMusicSource,
  type AgentAddSetupState,
  type AgentAddSpriteSubject,
  type CustomMusicSource,
  type MusicProvider,
} from "./AgentAddSetupFields";
import {
  CHAT_RESOURCE_AGENT_SETUP_EVENT,
  takePendingChatAgentSetupIds,
  takePendingChatResourcePanelRestore,
} from "../../lib/chat-resource-drag";
import { GameWidgetFileControls, GameWidgetSetupEditor, normalizeGameHudWidgets } from "../game/GameWidgetSetupEditor";

const QuickPresetSectionsEditor = lazy(() =>
  import("../presets/PresetEditor").then((module) => ({ default: module.QuickPresetSectionsEditor })),
);
const InlineChatCardEditor = lazy(() =>
  import("../../features/chat-settings/inline-editors/InlineChatCardEditor").then((module) => ({
    default: module.InlineChatCardEditor,
  })),
);
const InlineLorebookEntriesEditor = lazy(() =>
  import("../../features/chat-settings/inline-editors/InlineLorebookEntriesEditor").then((module) => ({
    default: module.InlineLorebookEntriesEditor,
  })),
);
const StoryboardChatSettingsPanel = lazy(() => import("./StoryboardChatSettingsPanel"));
const BeholderChatSettingsPanel = lazy(() => import("./BeholderChatSettingsPanel"));

interface ChatSettingsDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  anchor?: ChatToolbarFloatingPanelAnchor;
  initialSection?: "autonomous" | null;
  spriteArrangeMode?: boolean;
  onToggleSpriteArrange?: () => void;
  onResetSpritePlacements?: () => void;
  onResetSpriteCharacterVisualSettings?: (characterId: string) => void;
  onSpriteSideChange?: (side: "left" | "right", characterId?: string) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
}

const SPOTIFY_SOURCE_OPTIONS: Array<{ id: SpotifySourceType; label: string; description: string }> = [
  { id: "liked", label: "Liked Songs", description: "Pick from the user's saved tracks first." },
  { id: "playlist", label: "Playlist", description: "Keep choices inside one Spotify playlist." },
  { id: "artist", label: "Artist", description: "Search only around a named artist, like HOYO-MiX." },
  { id: "any", label: "Any Spotify", description: "Let the DJ use Spotify search when it fits." },
];

function getMusicProviderLabel(provider: MusicProvider): string {
  return provider === "spotify" ? "Spotify" : provider === "youtube" ? "YouTube" : "Custom";
}

function normalizeCustomMusicFolder(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  let start = 0;
  let end = raw.length;
  while (raw[start] === "/") start++;
  while (end > start && raw[end - 1] === "/") end--;
  const normalized = raw.slice(start, end);
  if (!normalized || normalized.includes("..")) return "music";
  return normalized.startsWith("music") ? normalized : `music/${normalized}`;
}

const DEFAULT_PROSE_GUARDIAN_BANNED_WORDS = "ozone";
const DEFAULT_PROSE_GUARDIAN_AVOID =
  "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";

function getAgentSettingsMenuId(chatId: string, agentId: string): string {
  return `chat-settings-agent-menu-${chatId}-${agentId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

const ACTIVE_AGENT_SETUP_DESCRIPTION_MARKERS = [
  "Add the Agent in Chat Settings",
  "Add as both a Command and an Agent in Chat Settings",
  "Enable it per chat from Chat Settings",
] as const;

function getActiveAgentMenuDescription(description: string): string {
  const cutoff = ACTIVE_AGENT_SETUP_DESCRIPTION_MARKERS.reduce((earliest, marker) => {
    const index = description.indexOf(marker);
    return index >= 0 ? Math.min(earliest, index) : earliest;
  }, description.length);
  return description.slice(0, cutoff).trim();
}

const GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATE_IDS = new Set(
  GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES.map((template) => template.id),
);

function normalizeGameVideoPromptTemplateId(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || fallback;
}

function getUniqueGameVideoPromptTemplateId(
  id: string,
  usedIds: Set<string>,
  fallback = "custom-game-video-prompt",
): string {
  const base = normalizeGameVideoPromptTemplateId(id, fallback);
  let candidate = base;
  let attempt = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt++;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeGameVideoPromptTemplates(value: unknown): AgentPromptTemplateOption[] {
  const usedIds = new Set(GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATE_IDS);
  return normalizeAgentPromptTemplateOptions(value)
    .map((template) => ({
      ...template,
      id: getUniqueGameVideoPromptTemplateId(template.id, usedIds),
    }))
    .slice(0, 20);
}

function getGameVideoPromptTemplateOptions(customTemplates: AgentPromptTemplateOption[]): AgentPromptTemplateOption[] {
  return [...GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES, ...customTemplates];
}

function resolveSelectedGameVideoPromptTemplateId(value: unknown, options: AgentPromptTemplateOption[]): string {
  const selected = typeof value === "string" ? value.trim() : "";
  if (selected && options.some((option) => option.id === selected)) return selected;
  return GAME_VIDEO_PROMPT_TEMPLATE_ID;
}

function renderRoleplayAgentMenuIcon(agentId: string, variant: "card" | "chip" = "card"): React.ReactNode {
  const size = variant === "chip" ? "0.6875rem" : "0.75rem";
  const className = variant === "chip" ? "shrink-0 text-[var(--primary)]" : "mt-0.5 shrink-0 text-[var(--primary)]";
  switch (agentId) {
    case "lorebook-keeper":
      return <BookOpen size={size} className={className} />;
    case "card-evolution-auditor":
      return <StickyNote size={size} className={className} />;
    case "prose-guardian":
      return <Feather size={size} className={className} />;
    case "director":
      return <Clapperboard size={size} className={className} />;
    case "continuity":
      return <ShieldCheck size={size} className={className} />;
    case "html":
      return <FileText size={size} className={className} />;
    case "knowledge-retrieval":
      return <Brain size={size} className={className} />;
    case "knowledge-router":
      return <ArrowRightLeft size={size} className={className} />;
    case "expression":
      return <VenetianMask size={size} className={className} />;
    case "echo-chamber":
      return <MessageCircle size={size} className={className} />;
    case "illustrator":
      return <Paintbrush size={size} className={className} />;
    case STORYBOARD_AGENT_ID:
      return <Image size={size} className={className} />;
    case "spotify":
      return <Music2 size={size} className={className} />;
    case "haptic":
      return <Vibrate size={size} className={className} />;
    case "long-term-memory":
      return <Archive size={size} className={className} />;
    case "memory-nag":
      return <MessageSquareQuote size={size} className={className} />;
    case "hierarchical-maps":
      return <MapIcon size={size} className={className} />;
    case "custom-agents":
      return <Bot size={size} className={className} />;
    default:
      return <Puzzle size={size} className={className} />;
  }
}

const CONVERSATION_COMMAND_TOGGLE_OPTIONS: Array<{
  id: ConversationCommandKey;
  label: string;
  description: string;
}> = [
  {
    id: "schedule_update",
    label: "Schedule Updates",
    description: "Let characters change their current status and activity.",
  },
  {
    id: "cross_post",
    label: "Cross-Post",
    description: "Let characters redirect a message into another shared chat.",
  },
  {
    id: "selfie",
    label: "Selfies",
    description: "Let characters request a generated selfie.",
  },
  {
    id: "memory",
    label: "Memories",
    description: "Let characters create memories for other characters.",
  },
  {
    id: "scene",
    label: "Scenes",
    description: "Let characters start an immersive scene from the conversation.",
  },
  {
    id: "music",
    label: "Music",
    description: "Let characters play songs through the active Music Player.",
  },
  {
    id: "haptic",
    label: "Haptics",
    description: "Let characters control connected haptic devices.",
  },
  {
    id: "influence",
    label: "Influence",
    description: "Let characters send one-shot influence to a connected chat.",
  },
  {
    id: "note",
    label: "Notes",
    description: "Let characters save durable notes for a connected chat.",
  },
  {
    id: "call",
    label: "Calls",
    description: "Let characters ring you for a Conversation call.",
  },
  {
    id: "react",
    label: "Reactions",
    description: "Let characters react to messages with emoji badges.",
  },
  {
    id: "uno",
    label: "UNO",
    description: "Let characters start a game of UNO at the table when you agree to play.",
  },
  {
    id: "chess",
    label: "Chess",
    description: "Let characters accept a one-on-one chess challenge at the table.",
  },
  {
    id: "poker",
    label: "Poker",
    description: "Let characters sit down for a game of Texas Hold'em poker at the table.",
  },
  {
    id: "eightball",
    label: "8-Ball Pool",
    description: "Let characters rack up a game of 8-ball pool at the table.",
  },
  {
    id: "tic_tac_toe",
    label: "Tic-Tac-Toe",
    description: "Let characters accept a one-on-one tic-tac-toe challenge at the table.",
  },
  {
    id: "rock_paper_scissors",
    label: "Rock-Paper-Scissors",
    description: "Let characters accept a one-on-one rock-paper-scissors match at the table.",
  },
];

function readConversationCommandToggles(value: unknown): Partial<Record<ConversationCommandKey, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const toggles: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    if (typeof source[key] === "boolean") toggles[key] = source[key] as boolean;
  }
  return toggles;
}

function isConversationCommandToggleEnabled(
  toggles: Partial<Record<ConversationCommandKey, boolean>>,
  command: ConversationCommandKey,
): boolean {
  return toggles[command] !== false;
}

const MODE_INTRO_KEYS: Record<ChatMode, string> = {
  conversation: "settings.chat.modeIntro.conversation",
  roleplay: "settings.chat.modeIntro.roleplay",
  game: "settings.chat.modeIntro.game",
};

const MARINARA_UNIVERSAL_PRESET_NAME = "Marinara's Universal Preset";
const MARINARA_UNIVERSAL_PRESET_AUTHOR = "Marinara";

const CHAT_SETTINGS_ORDER = {
  settingsPresets: -1600,
  modeIntro: -1500,
  chatName: -1400,
  connection: -1300,
  promptPreset: -1200,
  advancedParameters: -1100,
  combatStyle: -475,
  persona: -1000,
  characters: -900,
  cardTheming: -850,
  groupChat: -800,
  scopedRegex: -750,
  connectedChat: -700,
  connectedNotes: -690,
  lorebooks: -600,
  agents: -500,
  widgets: -450,
  impersonate: -400,
  memoryRecall: -300,
  functionCalling: -200,
  translation: -100,
  gamePrompt: 0,
} as const;

const CHAT_RESOURCE_REMOVE_BUTTON_CLASS =
  "mari-accent-animated flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-accent)] focus-visible:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:text-[var(--marinara-chat-chrome-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

const CHAT_PRESET_UNAPPLIED_SELECT_VALUE = "__chat_preset_unapplied__";
const DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 25;
const MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 100;

type AvailableAgent = {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
  execution?: "pipeline" | "feature" | "host";
};

type DrawerPersona = {
  id: string;
  name: string;
  comment: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop | null;
};

function DrawerPersonaAvatar({ persona, size = "sm" }: { persona: DrawerPersona; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-7 w-7" : "h-6 w-6";

  if (!persona.avatarPath) {
    return (
      <div
        className={cn(
          "mari-avatar-placeholder mari-avatar-placeholder--persona flex shrink-0 items-center justify-center rounded-full",
          sizeClass,
        )}
      >
        <User size={size === "md" ? "0.75rem" : "0.625rem"} />
      </div>
    );
  }

  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full", sizeClass)}>
      <img
        src={persona.avatarPath}
        alt={persona.name}
        loading="lazy"
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(persona.avatarCrop)}
      />
    </span>
  );
}

type AgentAddPreview = {
  agent: AvailableAgent;
  config: AgentConfigRow | null;
  contextSize: number;
  maxTokens: number;
  runInterval: number | null;
  setup: AgentAddSetupState;
};

type CustomAgentImageSetting = {
  imageConnectionId?: string | null;
  styleProfileId?: string | null;
};

type KnowledgeAgentType = "knowledge-retrieval" | "knowledge-router";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isKnowledgeAgentType(value: string): value is KnowledgeAgentType {
  return value === "knowledge-retrieval" || value === "knowledge-router";
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeStringArraySetting(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function readKnowledgeAgentSourceOverride(
  sources: unknown,
  agentType: KnowledgeAgentType,
): Record<string, unknown> | null {
  if (!isRecord(sources)) return null;
  const entry = sources[agentType];
  return isRecord(entry) ? entry : null;
}

function normalizeKnowledgeAgentSourceSettings(
  agentType: KnowledgeAgentType,
  baseSettings: Record<string, unknown>,
  metadataSources: unknown,
): KnowledgeAgentSourceSettings {
  const defaultSettings = getDefaultBuiltInAgentSettings(agentType);
  const override = readKnowledgeAgentSourceOverride(metadataSources, agentType);
  const useChatActiveLorebooks =
    typeof override?.useChatActiveLorebooks === "boolean"
      ? override.useChatActiveLorebooks
      : typeof baseSettings.useChatActiveLorebooks === "boolean"
        ? baseSettings.useChatActiveLorebooks
        : defaultSettings.useChatActiveLorebooks === true;
  const sourceLorebookIds =
    override && hasOwn(override, "sourceLorebookIds")
      ? normalizeStringArraySetting(override.sourceLorebookIds)
      : normalizeStringArraySetting(baseSettings.sourceLorebookIds);
  const sourceFileIds =
    agentType === "knowledge-retrieval"
      ? override && hasOwn(override, "sourceFileIds")
        ? normalizeStringArraySetting(override.sourceFileIds)
        : normalizeStringArraySetting(baseSettings.sourceFileIds)
      : [];

  return {
    useChatActiveLorebooks,
    sourceLorebookIds,
    ...(agentType === "knowledge-retrieval" ? { sourceFileIds } : {}),
  };
}

function isMemoryRecallExportEnvelope(value: unknown): value is ExportEnvelope<ChatMemoryRecallExportPayload> {
  if (!isRecord(value) || value.type !== "marinara_memory_recall" || value.version !== 1) return false;
  const data = value.data;
  return isRecord(data) && Array.isArray(data.chunks);
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function normalizeAgentMaxTokens(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_AGENT_MAX_TOKENS;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(value));
}

function normalizeAgentMaxTokensInputValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

function normalizeSpriteDisplayValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function customAgentCanBackfillLorebooks(agent: AvailableAgent, settings: Record<string, unknown>): boolean {
  if (agent.phase !== "post_processing") return false;
  const canEdit = customAgentHasCapability(settings, "edit_lorebooks");
  const canCreate = customAgentHasCapability(settings, "create_lorebooks");
  const enabledTools = Array.isArray(settings.enabledTools) ? settings.enabledTools : [];
  return (
    (canEdit && (settings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"))) ||
    (settings.resultType === "lorebook_update" && (canEdit || canCreate))
  );
}

function customLorebookBackfillChunkSize(settings: Record<string, unknown>): number {
  const value = settings.lorebookBackfillChunkSize;
  return normalizePositiveInteger(
    typeof value === "string" ? Number(value) : value,
    DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
    MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
  );
}

function getChatActiveAgentIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const activeIds =
    metadata && typeof metadata === "object" ? (metadata as { activeAgentIds?: unknown }).activeAgentIds : [];
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

export function ChatSettingsDrawer({
  chat,
  open,
  onClose,
  anchor,
  initialSection,
  spriteArrangeMode = false,
  onToggleSpriteArrange,
  onResetSpritePlacements,
  onResetSpriteCharacterVisualSettings,
  onSpriteSideChange,
  spriteVisualSettings,
  onSpriteVisualSettingsChange,
  onOpenScheduleEditor,
}: ChatSettingsDrawerProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scheduleControlsRef = useRef<HTMLDivElement | null>(null);
  const modePromptDefaultAppliedRef = useRef<string | null>(null);
  const agentSuiteCloseGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const drawerClosingRef = useRef(false);
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const updateMetaMutateAsyncRef = useRef(updateMeta.mutateAsync);
  const pendingCustomAgentImageSettingsRef = useRef<{
    chatId: string;
    revision: number;
    settings: Record<string, CustomAgentImageSetting>;
  } | null>(null);
  const pendingCustomAgentImageSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customAgentImageSettingsRevisionRef = useRef(0);
  const customAgentImageSettingsWriteQueueRef = useRef(createSerializedMutationQueue());
  const removingAgentImageSettingsRef = useRef(new Set<string>());
  const [customAgentImageSettingsDraft, setCustomAgentImageSettingsDraft] = useState<{
    chatId: string;
    revision: number;
    patch: Partial<Record<string, CustomAgentImageSetting | null>>;
  } | null>(null);
  updateMetaMutateAsyncRef.current = updateMeta.mutateAsync;
  const updateGameWidgets = useUpdateGameWidgets();
  const { data: regexScripts } = useRegexScripts();
  const updateRegexScript = useUpdateRegexScript();
  const updateAgentConfig = useUpdateAgent();
  const createAgent = useCreateAgent();
  const createMessage = useCreateMessage(chat.id);
  const connectChat = useConnectChat();
  const disconnectChat = useDisconnectChat();
  const { retryAgents } = useGenerate();
  const agentProcessing = useAgentStore((s) => s.processingChatIds.includes(chat.id));
  const hasLocalGeneration = useChatStore((s) => s.abortControllers.has(chat.id));
  const [stoppingGeneration, setStoppingGeneration] = useState(false);
  const scheduleGenerationPreferences = useUIStore((s) => s.scheduleGenerationPreferences);
  const setScheduleGenerationPreferences = useUIStore((s) => s.setScheduleGenerationPreferences);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const imageSelfieWidth = useUIStore((s) => s.imageSelfieWidth);
  const imageSelfieHeight = useUIStore((s) => s.imageSelfieHeight);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const musicPlayerSource = useUIStore((s) => s.musicPlayerSource);
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const debugMode = useUIStore((s) => s.debugMode);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const callsSettingsMenuId = getAgentSettingsMenuId(chat.id, "conversation-calls");
  const callsSettingsOpen = useUIStore((s) => s.chatSettingsExpandedSections[callsSettingsMenuId] ?? false);
  const setChatSettingsSectionExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);

  const { data: allCharacters } = useCharacters({ includeBuiltIn: true });
  const { data: characterGroups } = useCharacterGroups();
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: defaultPromptPreset } = useDefaultPreset();
  const { data: installedAgentManifests = [] } = useCapabilityAgentRegistry();
  const roleplayAgentSettingsOrder = useMemo(
    () => buildRoleplayAgentSettingsOrder(installedAgentManifests),
    [installedAgentManifests],
  );
  const customAgentSettingsOrder = roleplayAgentSettingsOrder.size + 100;
  const getRoleplayAgentSettingsOrder = useCallback(
    (agentId: string) => roleplayAgentSettingsOrder.get(agentId) ?? customAgentSettingsOrder,
    [customAgentSettingsOrder, roleplayAgentSettingsOrder],
  );
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages(open);
  const persistedChatMode = (chat as unknown as { mode?: unknown }).mode;
  const chatMode: ChatMode =
    persistedChatMode === "conversation" || persistedChatMode === "roleplay" || persistedChatMode === "game"
      ? persistedChatMode
      : "roleplay";
  const isConversation = chatMode === "conversation";
  const isGame = chatMode === "game";
  const isRoleplayMode = chatMode === "roleplay";
  const { data: generationStatus, refetch: refetchGenerationStatus } = useQuery({
    queryKey: ["generation-status", chat.id],
    queryFn: () => api.get<{ active: boolean }>(`/generate/status/${encodeURIComponent(chat.id)}`),
    enabled: open && isRoleplayMode,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.active ? 1_000 : false),
  });
  const activeGeneration = hasLocalGeneration || generationStatus?.active === true;
  const handleStopActiveGeneration = useCallback(async () => {
    setStoppingGeneration(true);
    try {
      const controller = useChatStore.getState().abortControllers.get(chat.id);
      await abortGenerationForChat(chat.id, controller);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.couldNotStopGeneration"),
      );
    } finally {
      await refetchGenerationStatus();
      setStoppingGeneration(false);
    }
  }, [chat.id, localizeUi, refetchGenerationStatus]);
  const worldMapsSettingsDescription = localizeUi("ui.chat.chatsettingsdrawer.worldMapsFeatureSummary");
  const supportsNarrativeDirectorSecretPlot = chatMode === "roleplay";
  const modeSettingsSurfaces = CHAT_SETTINGS_SURFACES[chatMode];
  const metadata = useMemo(
    () => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {})),
    [chat.metadata],
  );
  const noodleTimelineContextEnabled = metadata.noodleTimelineContextEnabled === true;
  const renderNoodleTimelineContextToggle = () => (
    <SettingsSwitch
      label={localizeUi("ui.chat.chatsettingsdrawer.allowNoodleReferences")}
      description={localizeUi("ui.chat.chatsettingsdrawer.timelineRefreshesMayIncludeRecentMessagesFromThisChat")}
      checked={noodleTimelineContextEnabled}
      onChange={(checked) => updateMeta.mutate({ id: chat.id, noodleTimelineContextEnabled: checked })}
      disabled={updateMeta.isPending}
      labelPosition="start"
      className={cn(
        "justify-between rounded-md px-3 py-2.5 text-left",
        noodleTimelineContextEnabled
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
      )}
      labelClassName="text-[0.6875rem] font-medium"
    />
  );
  const { data: currentPromptPresetFull } = usePresetFull(isRoleplayMode ? (chat.promptPresetId ?? null) : null);
  const promptPresetOptionsLoaded = Array.isArray(presets);
  const promptPresetOptions = useMemo(() => (presets ?? []) as PromptPreset[], [presets]);
  const marinaraUniversalPromptPreset = useMemo(
    () =>
      promptPresetOptions.find(
        (preset) =>
          preset.name === MARINARA_UNIVERSAL_PRESET_NAME && preset.author === MARINARA_UNIVERSAL_PRESET_AUTHOR,
      ) ?? null,
    [promptPresetOptions],
  );
  const fallbackPromptPreset = useMemo(() => {
    return (
      marinaraUniversalPromptPreset ??
      defaultPromptPreset ??
      promptPresetOptions.find((preset) => preset.isDefault) ??
      null
    );
  }, [defaultPromptPreset, marinaraUniversalPromptPreset, promptPresetOptions]);
  const hasModeCustomPrompt =
    isConversation && typeof metadata.customSystemPrompt === "string" && metadata.customSystemPrompt.trim().length > 0
      ? true
      : isGame && typeof metadata.gameSystemPrompt === "string" && metadata.gameSystemPrompt.trim().length > 0;
  const shouldApplyModePromptDefault = (isConversation || isGame) && promptPresetOptionsLoaded && !hasModeCustomPrompt;
  const effectiveModePromptPresetId =
    chat.promptPresetId ?? (shouldApplyModePromptDefault ? (fallbackPromptPreset?.id ?? null) : null);
  const selectedModePromptPreset = useMemo(() => {
    if (!effectiveModePromptPresetId) return null;
    return (
      promptPresetOptions.find((preset) => preset.id === effectiveModePromptPresetId) ??
      (fallbackPromptPreset?.id === effectiveModePromptPresetId ? fallbackPromptPreset : null)
    );
  }, [effectiveModePromptPresetId, fallbackPromptPreset, promptPresetOptions]);
  const { data: connections } = useConnections();
  const imageConnectionsList = useMemo(
    () =>
      ((connections as Array<{ id: string; name: string; model?: string; provider?: string }>) ?? []).filter(
        (c) => c.provider === "image_generation",
      ),
    [connections],
  );
  const videoConnectionsList = useMemo(
    () =>
      ((connections as Array<{ id: string; name: string; model?: string; provider?: string }>) ?? []).filter(
        (c) => c.provider === "video_generation",
      ),
    [connections],
  );
  const textConnectionsList = useMemo(
    () =>
      filterLanguageGenerationConnections(
        (connections as Array<{ id: string; name: string; model?: string; provider?: string }>) ?? [],
      ),
    [connections],
  );
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const chatGenerationConnectionsList = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        textConnectionsList,
        !isGame && sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [isGame, sidecarModelDisplayName, sidecarModelDownloaded, textConnectionsList],
  );
  const conversationSummaryConnectionId =
    typeof metadata.summaryConnectionId === "string" ? metadata.summaryConnectionId : "";
  const conversationSummaryConnectionMissing =
    conversationSummaryConnectionId.length > 0 &&
    !chatGenerationConnectionsList.some((connection) => connection.id === conversationSummaryConnectionId);
  const illustratorPromptConnectionsList = useMemo(() => {
    const options: Array<{ id: string; name: string; model?: string | null }> = [];
    for (const connection of chatGenerationConnectionsList) {
      const id = typeof connection.id === "string" ? connection.id.trim() : "";
      if (!id) continue;
      options.push({
        id,
        name: connection.name || "Connection",
        model: connection.model ?? null,
      });
    }
    return options;
  }, [chatGenerationConnectionsList]);
  const { data: allPersonas } = usePersonas();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: customTools } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const { data: allChats } = useChats({ refetchOnMount: false });
  const personas = useMemo(() => allPersonas ?? [], [allPersonas]);

  const chatCharIds: string[] = useMemo(
    () => getChatCharacterIds({ characterIds: chat.characterIds }),
    [chat.characterIds],
  );

  const gameWidgetSource = useMemo<HudWidget[]>(() => {
    const persistedWidgets = normalizeGameHudWidgets(metadata.gameWidgetState);
    if (persistedWidgets.length > 0 || Array.isArray(metadata.gameWidgetState)) return persistedWidgets;

    const blueprint =
      metadata.gameBlueprint && typeof metadata.gameBlueprint === "object" && !Array.isArray(metadata.gameBlueprint)
        ? (metadata.gameBlueprint as { hudWidgets?: unknown })
        : null;
    return normalizeGameHudWidgets(blueprint?.hudWidgets);
  }, [metadata.gameBlueprint, metadata.gameWidgetState]);
  const gameWidgetSourceSignature = useMemo(() => JSON.stringify(gameWidgetSource), [gameWidgetSource]);
  const [gameWidgetDrafts, setGameWidgetDrafts] = useState<HudWidget[]>(() => gameWidgetSource);
  const gameWidgetDraftSignature = useMemo(() => JSON.stringify(gameWidgetDrafts), [gameWidgetDrafts]);
  const gameWidgetsChanged = gameWidgetDraftSignature !== gameWidgetSourceSignature;

  useEffect(() => {
    setGameWidgetDrafts(gameWidgetSource);
  }, [chat.id, gameWidgetSource]);

  // Creator-notes card CSS: the current per-chat mode (default "chat"), and
  // whether any active character actually ships CSS — the Card Theming control
  // only appears when one does, so it never clutters chats it can't affect.
  const cardCssMode: "disabled" | "exclusive" | "chat" =
    metadata.cardCssMode === "exclusive" || metadata.cardCssMode === "chat" ? metadata.cardCssMode : "disabled";
  const activeCardsHaveCss = useMemo(() => {
    if (!allCharacters) return false;
    const byId = new Map((allCharacters as Array<{ id: string; data: unknown }>).map((c) => [c.id, c]));
    return chatCharIds.some((id) => {
      const row = byId.get(id);
      if (!row) return false;
      let parsed: Record<string, unknown>;
      try {
        if (typeof row.data === "string") parsed = JSON.parse(row.data) as Record<string, unknown>;
        else if (row.data && typeof row.data === "object") parsed = row.data as Record<string, unknown>;
        else return false;
      } catch {
        return false;
      }
      const notes = (parsed as { creator_notes?: string }).creator_notes;
      return typeof notes === "string" && extractCreatorNotesCss(notes).css.trim().length > 0;
    });
  }, [allCharacters, chatCharIds]);
  // Scoped regex: the per-chat display mode (default "disabled"), and whether any
  // script is character-scoped — the control only appears when at least one is.
  const scopedRegexMode: "disabled" | "exclusive" | "chat" =
    metadata.scopedRegexMode === "exclusive" || metadata.scopedRegexMode === "chat"
      ? metadata.scopedRegexMode
      : "disabled";
  // Character-scoped regex scripts grouped by the chat's characters — drives the
  // per-character list + the section badge, and whether the section shows at all.
  const chatScopedRegexGroups = useMemo(() => {
    if (!regexScripts) return [] as Array<{ characterId: string; name: string; scripts: RegexScriptRow[] }>;
    const charById = new Map(((allCharacters as Array<{ id: string; data?: unknown }>) ?? []).map((c) => [c.id, c]));
    const scripts = regexScripts as RegexScriptRow[];
    return chatCharIds
      .map((characterId) => {
        const row = charById.get(characterId);
        return {
          characterId,
          name: parseCharacterDisplayData({ data: row?.data }).name,
          scripts: scripts.filter((script) => {
            try {
              const ids = JSON.parse(script.targetCharacterIds ?? "[]");
              return Array.isArray(ids) && ids.includes(characterId);
            } catch {
              return false;
            }
          }),
        };
      })
      .filter((group) => group.scripts.length > 0);
  }, [regexScripts, allCharacters, chatCharIds]);
  const scopedRegexCount = useMemo(
    () => new Set(chatScopedRegexGroups.flatMap((g) => g.scripts.map((s) => s.id))).size,
    [chatScopedRegexGroups],
  );
  const conversationCommandToggles = useMemo(
    () => readConversationCommandToggles(metadata.conversationCommandToggles),
    [metadata.conversationCommandToggles],
  );
  const conversationCommandsEnabled = metadata.characterCommands !== false;
  const selfieConnectionId = typeof metadata.imageGenConnectionId === "string" ? metadata.imageGenConnectionId : "";
  const selfieCommandAllowed = conversationCommandToggles.selfie !== false;
  const selfieSettingsOpen =
    selfieCommandAllowed && (conversationCommandToggles.selfie === true || selfieConnectionId.length > 0);
  const selfieFeatureEnabled = conversationCommandsEnabled && selfieSettingsOpen;
  const toggleConversationSelfies = useCallback(() => {
    const nextEnabled = !selfieFeatureEnabled;
    updateMeta.mutate({
      id: chat.id,
      ...(nextEnabled ? { characterCommands: true } : {}),
      conversationCommandToggles: {
        ...conversationCommandToggles,
        selfie: nextEnabled,
      },
    });
  }, [chat.id, conversationCommandToggles, selfieFeatureEnabled, updateMeta]);
  const openGenerationSettings = useCallback(() => {
    setSettingsTab("generations");
    openRightPanel("settings");
  }, [openRightPanel, setSettingsTab]);
  const openDownloadAgents = useCallback(() => {
    onClose();
    openRightPanel("agents");
    openAgentCatalog();
  }, [onClose, openAgentCatalog, openRightPanel]);
  const refreshLorebooks = useCallback(() => qc.invalidateQueries({ queryKey: lorebookKeys.all }), [qc]);
  const openLorebookFromSettings = useCallback(
    (lorebookId: string) => {
      void refreshLorebooks();
      onClose();
      openLorebookDetail(lorebookId);
    },
    [onClose, openLorebookDetail, refreshLorebooks],
  );
  const inactiveCharacterIds = useMemo<string[]>(
    () =>
      Array.isArray(metadata.inactiveCharacterIds)
        ? metadata.inactiveCharacterIds.filter(
            (id: unknown): id is string => typeof id === "string" && chatCharIds.includes(id),
          )
        : [],
    [chatCharIds, metadata.inactiveCharacterIds],
  );
  const activeCharacterIds = useMemo<string[]>(
    () => chatCharIds.filter((id) => !inactiveCharacterIds.includes(id)),
    [chatCharIds, inactiveCharacterIds],
  );
  const supportsCharacterActivityToggle = chatCharIds.length > 1 && !isGame;
  useEffect(() => {
    if (!open || initialSection !== "autonomous" || !isConversation) return;
    const frame = window.requestAnimationFrame(() => {
      scheduleControlsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, isConversation, open]);
  const hasGeneratedConversationSchedules =
    !!metadata.characterSchedules &&
    typeof metadata.characterSchedules === "object" &&
    Object.keys(metadata.characterSchedules).length > 0;
  const conversationSchedulesEnabled =
    metadata.conversationSchedulesEnabled === true ||
    (metadata.conversationSchedulesEnabled == null && hasGeneratedConversationSchedules);
  const autonomousDailyCapOverride =
    typeof metadata.autonomousDailyCapOverride === "number" && Number.isFinite(metadata.autonomousDailyCapOverride)
      ? Math.max(1, Math.floor(metadata.autonomousDailyCapOverride))
      : null;
  const activeLorebookIds = useMemo(() => getChatActiveLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  const readLatestActiveLorebookIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    return latestChat ? getChatActiveLorebookIds(latestChat) : [...activeLorebookIds];
  }, [activeLorebookIds, chat.id, qc]);
  const excludedLorebookIds = useMemo(() => getChatExcludedLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  const readLatestExcludedLorebookIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    return latestChat ? getChatExcludedLorebookIds(latestChat) : [...excludedLorebookIds];
  }, [chat.id, excludedLorebookIds, qc]);
  const gameLorebookKeeperEnabled = metadata.gameLorebookKeeperEnabled === true;
  const gameLorebookKeeperLorebookId =
    typeof metadata.gameLorebookKeeperLorebookId === "string" ? metadata.gameLorebookKeeperLorebookId : null;
  const activeLorebooks = useMemo<ActiveLorebookView[]>(() => {
    return deriveActiveLorebookViews({
      activeLorebookIds,
      chat,
      excludedLorebookIds,
      excludeGameLorebookKeeper: isGame && !gameLorebookKeeperEnabled,
      gameLorebookKeeperLorebookId,
      lorebooks: (lorebooks ?? []) as Lorebook[],
    });
  }, [
    activeLorebookIds,
    excludedLorebookIds,
    chat,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    isGame,
    lorebooks,
  ]);
  const lorebookTokenBudget =
    typeof metadata.lorebookTokenBudget === "number" && Number.isFinite(metadata.lorebookTokenBudget)
      ? Math.max(0, Math.floor(metadata.lorebookTokenBudget))
      : LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET;
  const agentConfigsByType = useMemo(() => {
    const map = new Map<string, AgentConfigRow>();
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      map.set(config.type, config);
    }
    return map;
  }, [agentConfigs]);
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  const deletedBuiltInAgentTypes = useMemo(
    () =>
      new Set(
        ((agentConfigs ?? []) as AgentConfigRow[])
          .filter((config) => installedAgentIds.has(config.type))
          .filter((config) => isAgentConfigDeleted(config.settings))
          .map((config) => config.type),
      ),
    [agentConfigs, installedAgentIds],
  );
  const activeAgentIds = useMemo<string[]>(
    () =>
      (Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : []).filter(
        (id: unknown): id is string => typeof id === "string" && !deletedBuiltInAgentTypes.has(id),
      ),
    [deletedBuiltInAgentTypes, metadata.activeAgentIds],
  );
  const mapsPackage = installedCapabilities.find(
    (item) => item.status === "active" && item.manifest.kind.includes("maps") && item.manifest.entrypoints.client,
  );
  const mapsPackageEnabledForChat =
    metadata.enableAgents === true && Boolean(mapsPackage && activeAgentIds.includes(mapsPackage.id));
  const ltmPackage = installedCapabilities.find(
    (item) => item.status === "active" && item.id === "long-term-memory" && item.manifest.entrypoints.client,
  );
  const ltmPackageId = ltmPackage?.id;
  const callsPackage = installedCapabilities.find(
    (item) =>
      item.status === "active" && item.manifest.kind.includes("conversation-calls") && item.manifest.entrypoints.client,
  );
  const chatSettingsPackageByAgentId = useMemo(() => {
    const packages = new Map<string, (typeof installedCapabilities)[number]>();
    for (const item of installedCapabilities) {
      if (
        item.status === "active" &&
        item.manifest.entrypoints.client &&
        item.manifest.contributions?.slots?.includes("chat-settings")
      ) {
        packages.set(item.id, item);
      }
    }
    return packages;
  }, [installedCapabilities]);
  const renderDownloadedAgentChatSettings = (
    agent: { id: string; name: string; description: string },
    className = "mt-2 block overflow-hidden rounded-lg",
  ) => {
    if (agent.id === "hierarchical-maps" || agent.id === "long-term-memory") return null;
    const capabilityPackage = chatSettingsPackageByAgentId.get(agent.id);
    if (!capabilityPackage) return null;
    return (
      <CapabilityElement
        packageId={capabilityPackage.id}
        view="settings"
        capabilityProps={{
          chatId: chat.id,
          chatMode,
          debugMode,
          agent,
          connections: chatGenerationConnectionsList,
          onDirtyChange: setEditorDirty,
          confirmAction: showConfirmDialog,
        }}
        className={className}
      />
    );
  };
  const availableConversationCommandOptions = useMemo(() => {
    return CONVERSATION_COMMAND_TOGGLE_OPTIONS.filter((command) => {
      const agentId = CONVERSATION_COMMAND_AGENT_IDS[command.id];
      return !agentId || installedAgentIds.has(agentId);
    });
  }, [installedAgentIds]);
  const hasConversationCommands = availableConversationCommandOptions.length > 0;
  const illustratorInstalled = installedAgentIds.has("illustrator");
  const readLatestActiveAgentIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const ids = latestChat ? getChatActiveAgentIds(latestChat) : [...activeAgentIds];
    return ids.filter((id) => !deletedBuiltInAgentTypes.has(id));
  }, [activeAgentIds, chat.id, deletedBuiltInAgentTypes, qc]);
  const setMapsEnabledForChat = useCallback(
    async (enabled: boolean) => {
      if (!mapsPackage) return;
      const current = readLatestActiveAgentIds();
      await updateMeta.mutateAsync({
        id: chat.id,
        ...(enabled ? { enableAgents: true } : {}),
        activeAgentIds: enabled
          ? Array.from(new Set([...current, mapsPackage.id]))
          : current.filter((id) => id !== mapsPackage.id),
      });
    },
    [chat.id, mapsPackage, readLatestActiveAgentIds, updateMeta],
  );
  const setLtmEnabledForChat = useCallback(
    async (enabled: boolean) => {
      if (!ltmPackageId) return;
      const current = readLatestActiveAgentIds();
      await updateMeta.mutateAsync({
        id: chat.id,
        ...(enabled ? { enableAgents: true } : {}),
        activeAgentIds: enabled
          ? Array.from(new Set([...current, ltmPackageId]))
          : current.filter((id) => id !== ltmPackageId),
      });
    },
    [chat.id, ltmPackageId, readLatestActiveAgentIds, updateMeta],
  );
  const activeToolIds: string[] = metadata.activeToolIds ?? [];
  const spotifyActive = activeAgentIds.includes("spotify");
  const gameLorebookKeeperLorebook = gameLorebookKeeperLorebookId
    ? ((lorebooks ?? []) as Array<{ id: string; name: string }>).find(
        (book) => book.id === gameLorebookKeeperLorebookId,
      )
    : null;
  const spotifySourceType = normalizeSpotifySourceType(metadata.spotifySourceType);
  const spotifyPlaylistId = typeof metadata.spotifyPlaylistId === "string" ? metadata.spotifyPlaylistId : "";
  const spotifyArtist = typeof metadata.spotifyArtist === "string" ? metadata.spotifyArtist : "";
  const gameUseSpotifyMusic = metadata.gameUseSpotifyMusic === true;
  const gameSpotifySourceType = metadata.gameSpotifySourceType ?? "liked";
  const gameSpotifyPlaylistId =
    typeof metadata.gameSpotifyPlaylistId === "string" ? metadata.gameSpotifyPlaylistId : "";
  const gameSpotifyArtist = typeof metadata.gameSpotifyArtist === "string" ? metadata.gameSpotifyArtist : "";
  const musicDjSettings = mergeBuiltInAgentSettings("spotify", agentConfigsByType.get("spotify")?.settings);
  const customMusicSource = normalizeCustomMusicSource(musicDjSettings);
  const customMusicFolder = normalizeCustomMusicFolder(metadata.customMusicFolder ?? musicDjSettings.customMusicFolder);
  const customMusicExternalFolder = normalizeCustomMusicExternalFolder(
    musicDjSettings.customMusicExternalFolder ?? musicDjSettings.localMusicExternalFolder,
  );
  const gameMusicDjEnabled =
    metadata.gameUseMusicDj === true || gameUseSpotifyMusic || activeAgentIds.includes("youtube");
  const spriteCharacterIds = useMemo<string[]>(
    () => (Array.isArray(metadata.spriteCharacterIds) ? metadata.spriteCharacterIds : []),
    [metadata.spriteCharacterIds],
  );
  const spriteDisplayModes = normalizeSpriteDisplayModes(metadata.spriteDisplayModes);
  const spritePosition: "left" | "right" =
    spriteVisualSettings?.spritePosition ?? (metadata.spritePosition === "right" ? "right" : "left");
  const spriteScale = normalizeSpriteDisplayValue(
    metadata.spriteScale,
    roleplaySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const expressionSpriteScale = normalizeSpriteDisplayValue(
    spriteVisualSettings?.expressionSpriteScale ?? metadata.expressionSpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const fullBodySpriteScale = normalizeSpriteDisplayValue(
    spriteVisualSettings?.fullBodySpriteScale ?? metadata.fullBodySpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const spriteOpacity = normalizeSpriteDisplayValue(
    metadata.spriteOpacity,
    1,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const expressionSpriteOpacity = normalizeSpriteDisplayValue(
    spriteVisualSettings?.expressionSpriteOpacity ?? metadata.expressionSpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const fullBodySpriteOpacity = normalizeSpriteDisplayValue(
    spriteVisualSettings?.fullBodySpriteOpacity ?? metadata.fullBodySpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const expressionAvatarsEnabled =
    (spriteVisualSettings?.expressionAvatarsEnabled ?? metadata.expressionAvatarsEnabled) === true;
  const hasLocalCharacterVisualSettings =
    !!spriteVisualSettings && Object.prototype.hasOwnProperty.call(spriteVisualSettings, "characterOverrides");
  const spriteCharacterVisualSettings = normalizeSpriteCharacterVisualSettingsMap(
    hasLocalCharacterVisualSettings ? spriteVisualSettings?.characterOverrides : metadata.spriteCharacterVisualSettings,
  );
  const [selectedSpriteLayoutCharacterId, setSelectedSpriteLayoutCharacterId] = useState<string | null>(null);
  const selectedSpriteCharacterVisualSettings = selectedSpriteLayoutCharacterId
    ? spriteCharacterVisualSettings[selectedSpriteLayoutCharacterId]
    : undefined;
  const editedSpritePosition = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.spritePosition ?? spritePosition)
    : spritePosition;
  const editedExpressionSpriteScale = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.expressionSpriteScale ?? expressionSpriteScale)
    : expressionSpriteScale;
  const editedFullBodySpriteScale = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.fullBodySpriteScale ?? fullBodySpriteScale)
    : fullBodySpriteScale;
  const editedExpressionSpriteOpacity = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.expressionSpriteOpacity ?? expressionSpriteOpacity)
    : expressionSpriteOpacity;
  const editedFullBodySpriteOpacity = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.fullBodySpriteOpacity ?? fullBodySpriteOpacity)
    : fullBodySpriteOpacity;
  const [expressionSpriteScalePercent, setExpressionSpriteScalePercent] = useState(() =>
    Math.round(editedExpressionSpriteScale * 100),
  );
  const [fullBodySpriteScalePercent, setFullBodySpriteScalePercent] = useState(() =>
    Math.round(editedFullBodySpriteScale * 100),
  );
  const [expressionSpriteOpacityPercent, setExpressionSpriteOpacityPercent] = useState(() =>
    Math.round(editedExpressionSpriteOpacity * 100),
  );
  const [fullBodySpriteOpacityPercent, setFullBodySpriteOpacityPercent] = useState(() =>
    Math.round(editedFullBodySpriteOpacity * 100),
  );
  const hasLocalSpritePlacements =
    !!spriteVisualSettings && Object.prototype.hasOwnProperty.call(spriteVisualSettings, "spritePlacements");
  const spritePlacementSource = hasLocalSpritePlacements
    ? spriteVisualSettings?.spritePlacements
    : metadata.spritePlacements;
  const hasCustomSpritePlacements = Object.keys(normalizeSpritePlacements(spritePlacementSource)).length > 0;
  const spotifyPlaylistsQuery = useQuery({
    queryKey: ["spotify", "playlists", 50],
    queryFn: () =>
      api.get<{
        playlists: Array<{
          id: string;
          name: string;
          uri: string;
          trackCount: number | null;
          owned: boolean | null;
        }>;
      }>("/spotify/playlists?limit=50"),
    enabled:
      open &&
      ((isGame && gameMusicDjEnabled && musicPlayerSource === "spotify" && gameSpotifySourceType === "playlist") ||
        (isRoleplayMode &&
          metadata.enableAgents &&
          spotifyActive &&
          musicPlayerSource === "spotify" &&
          spotifySourceType === "playlist")),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    setExpressionSpriteScalePercent(Math.round(editedExpressionSpriteScale * 100));
  }, [editedExpressionSpriteScale]);

  useEffect(() => {
    setFullBodySpriteScalePercent(Math.round(editedFullBodySpriteScale * 100));
  }, [editedFullBodySpriteScale]);

  useEffect(() => {
    setExpressionSpriteOpacityPercent(Math.round(editedExpressionSpriteOpacity * 100));
  }, [editedExpressionSpriteOpacity]);

  useEffect(() => {
    setFullBodySpriteOpacityPercent(Math.round(editedFullBodySpriteOpacity * 100));
  }, [editedFullBodySpriteOpacity]);

  const agentPromptTemplateSelections = useMemo(
    () => normalizeAgentPromptTemplateSelectionMap(metadata.agentPromptTemplateIds),
    [metadata.agentPromptTemplateIds],
  );
  const readLatestAgentPromptTemplateSelections = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const latestMetadata =
      latestChat && typeof latestChat.metadata === "string"
        ? JSON.parse(latestChat.metadata)
        : (latestChat?.metadata ?? metadata);
    return normalizeAgentPromptTemplateSelectionMap(
      latestMetadata && typeof latestMetadata === "object"
        ? (latestMetadata as { agentPromptTemplateIds?: unknown }).agentPromptTemplateIds
        : undefined,
    );
  }, [chat.id, metadata, qc]);
  const getPromptOptionsForAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      const settings = mergeBuiltInAgentSettings(agentId, cfg?.settings);
      return getAgentPromptTemplateOptions({
        promptTemplate: cfg?.promptTemplate || "",
        fallbackPromptTemplate: getDefaultAgentPrompt(agentId),
        settings,
      });
    },
    [agentConfigsByType],
  );
  const getDefaultPromptTemplateIdForAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      return resolveDefaultAgentPromptTemplateId(mergeBuiltInAgentSettings(agentId, cfg?.settings));
    },
    [agentConfigsByType],
  );
  // Build the available agent list: built-in + custom agents from DB
  // Mode capabilities decide which built-ins are exposed for each chat mode.
  // Custom agents are user-authored and can be attached to any chat mode.
  const availableAgents = useMemo(() => {
    const agents: AvailableAgent[] = [];
    for (const a of installedAgentManifests) {
      if (a.libraryHidden) continue;
      if (!isAgentManifestAvailableInChatMode(chatMode, a)) continue;
      const existing = agentConfigsByType.get(a.id);
      if (existing && isAgentConfigDeleted(existing.settings)) continue;
      agents.push({
        id: a.id,
        name: a.name,
        description: existing?.description ?? a.description,
        category: a.category,
        phase: normalizeAgentPhaseForType(a.id, existing?.phase ?? a.phase),
        builtIn: true,
        runtimeDisabled: isBuiltInAgentRuntimeDisabled(a.id),
        execution: a.execution,
      });
    }
    // Custom agents from DB
    if (agentConfigs) {
      for (const c of agentConfigs as AgentConfigRow[]) {
        if (isAgentConfigDeleted(c.settings)) continue;
        if (isRetiredBuiltInAgentId(c.type)) continue;
        if (!installedAgentIds.has(c.type)) {
          agents.push({
            id: c.type,
            name: c.name,
            description: c.description,
            category: "custom",
            phase: normalizeAgentPhaseForType(c.type, c.phase),
            builtIn: false,
            runtimeDisabled: false,
            execution: "pipeline",
          });
        }
      }
    }
    return agents;
  }, [agentConfigs, agentConfigsByType, chatMode, installedAgentIds, installedAgentManifests]);
  const visibleActiveAgentIds = useMemo(
    () => activeAgentIds.filter((agentId) => availableAgents.some((agent) => agent.id === agentId)),
    [activeAgentIds, availableAgents],
  );
  const activeTrackerAgents = useMemo(
    () =>
      availableAgents.filter(
        (agent) => agent.category === "tracker" && activeAgentIds.includes(agent.id) && !agent.runtimeDisabled,
      ),
    [activeAgentIds, availableAgents],
  );
  const manualTrackerAgentTypes = useMemo(
    () => normalizeManualTrackerAgentTypes(metadata.manualTrackerAgentTypes),
    [metadata.manualTrackerAgentTypes],
  );
  const activeManualTrackerTypes = useMemo(() => {
    const set = new Set<string>();
    for (const agent of activeTrackerAgents) {
      if (metadata.manualTrackers === true || manualTrackerAgentTypes[agent.id] === true) set.add(agent.id);
    }
    return set;
  }, [activeTrackerAgents, manualTrackerAgentTypes, metadata.manualTrackers]);
  const toggleManualTrackerAgent = useCallback(
    (agentId: string) => {
      const next = { ...manualTrackerAgentTypes };
      if (next[agentId] === true) {
        delete next[agentId];
      } else {
        next[agentId] = true;
      }
      updateMeta.mutate({ id: chat.id, manualTrackerAgentTypes: next });
    },
    [chat.id, manualTrackerAgentTypes, updateMeta],
  );
  const agentSuiteAgents = useMemo(
    () =>
      visibleActiveAgentIds
        .map((agentId) => availableAgents.find((agent) => agent.id === agentId))
        .filter((agent): agent is AvailableAgent => !!agent),
    [availableAgents, visibleActiveAgentIds],
  );
  const getAgentDisplayMeta = useCallback(
    (agentId: string, fallback: { name: string; description: string }) => {
      const available = availableAgents.find((agent) => agent.id === agentId);
      const builtIn = installedAgentManifests.find((agent) => agent.id === agentId);
      const config = agentConfigsByType.get(agentId);
      const description = available?.description ?? config?.description ?? builtIn?.description ?? fallback.description;
      return {
        name: available?.name ?? builtIn?.name ?? config?.name ?? fallback.name,
        description: getActiveAgentMenuDescription(description),
      };
    },
    [agentConfigsByType, availableAgents, installedAgentManifests],
  );
  const lorebookKeeperAgentMeta = getAgentDisplayMeta("lorebook-keeper", {
    name: "Lorebook Keeper",
    description: "Creates and updates durable chat lorebook entries from important story facts.",
  });
  const cardEvolutionAuditorAgentMeta = getAgentDisplayMeta("card-evolution-auditor", {
    name: "Card Evolution Auditor",
    description: "Audits durable roleplay changes against saved character cards for user approval.",
  });
  const proseGuardianAgentMeta = getAgentDisplayMeta("prose-guardian", {
    name: "Prose Guardian",
    description: "Post-processes the latest assistant message to remove unwanted prose habits.",
  });
  const continuityAgentMeta = getAgentDisplayMeta("continuity", {
    name: "Continuity Checker",
    description: "Post-processes the latest assistant message to fix concrete spatial and timeline errors.",
  });
  const htmlAgentMeta = getAgentDisplayMeta("html", {
    name: "Immersive HTML",
    description: "Post-processes the latest assistant message with diegetic HTML/CSS/JS visuals.",
  });
  const directorAgentMeta = getAgentDisplayMeta("director", {
    name: "Narrative Director",
    description: "Creates one-shot story directions when you choose to push the next response forward.",
  });
  const expressionAgentMeta = getAgentDisplayMeta("expression", {
    name: "Expression Engine",
    description: "Detects character emotions and selects VN sprites/expressions.",
  });
  const illustratorAgentMeta = getAgentDisplayMeta("illustrator", {
    name: "Illustrator",
    description: "Responsible for image and video generations.",
  });
  const echoChamberAgentMeta = getAgentDisplayMeta("echo-chamber", {
    name: "Echo Chamber",
    description: "Simulates a live streaming-style chat reacting to your roleplay in real time.",
  });
  const musicDjAgentMeta = getAgentDisplayMeta("spotify", {
    name: "Music DJ",
    description: "Analyzes the narrative mood and plays matching music through Spotify or YouTube.",
  });
  const knowledgeRetrievalAgentMeta = getAgentDisplayMeta("knowledge-retrieval", {
    name: "Knowledge Retrieval",
    description: "Scans selected lorebooks and files for facts relevant to the current scene.",
  });
  const knowledgeRouterAgentMeta = getAgentDisplayMeta("knowledge-router", {
    name: "Knowledge Router",
    description: "Routes relevant lorebook entries into the next prompt by ID.",
  });
  const hapticAgentMeta = getAgentDisplayMeta("haptic", {
    name: "Haptic Feedback",
    description: "Analyzes narrative content and controls connected intimate toys in real time.",
  });

  // Estimate the per-turn cost of the active agent loadout — feeds the readout
  // in the agents picker header and the per-row token badges. Approximate; see
  // `estimateAgentLoadCost` doc comment for what's counted vs not.
  const agentLoadCost = useMemo(() => {
    const inputs = activeAgentIds.flatMap((id) => {
      const meta = availableAgents.find((a) => a.id === id);
      if (!meta) return [];
      const cfg = agentConfigsByType.get(id);
      const settings = mergeBuiltInAgentSettings(id, cfg?.settings);
      const promptTemplate = resolveAgentPromptTemplate({
        promptTemplate: cfg?.promptTemplate || "",
        fallbackPromptTemplate: getDefaultAgentPrompt(id),
        settings,
        selectedPromptTemplateId: agentPromptTemplateSelections[id] ?? null,
      });
      return [
        {
          type: id,
          phase: meta.phase,
          connectionId: cfg?.connectionId ?? null,
          promptTemplate,
          resultType: typeof settings.resultType === "string" ? settings.resultType : undefined,
        },
      ];
    });
    const tokensByType = new Map<string, number>(inputs.map((i) => [i.type, Math.ceil(i.promptTemplate.length / 4)]));
    return {
      cost: estimateAgentLoadCost(inputs, chat.connectionId ?? null),
      tokensByType,
    };
  }, [activeAgentIds, agentConfigsByType, agentPromptTemplateSelections, availableAgents, chat.connectionId]);

  const lorebookKeeperActive = activeAgentIds.includes("lorebook-keeper");
  const cardEvolutionAuditorActive = activeAgentIds.includes("card-evolution-auditor");
  const expressionActive = activeAgentIds.includes("expression");
  const illustratorActive = activeAgentIds.includes("illustrator");
  const echoChamberActive = activeAgentIds.includes("echo-chamber");
  const proseGuardianActive = activeAgentIds.includes("prose-guardian");
  const continuityActive = activeAgentIds.includes("continuity");
  const htmlActive = activeAgentIds.includes("html");
  const directorActive = activeAgentIds.includes("director");
  const hapticActive = activeAgentIds.includes("haptic");
  const hapticSensitivity: HapticFeedbackSensitivity =
    metadata.hapticSensitivity === "subtle" || metadata.hapticSensitivity === "intense"
      ? metadata.hapticSensitivity
      : "standard";
  const agentWriteApprovalRequired = metadata.agentWriteApprovalRequired === true;
  const knowledgeRetrievalActive = activeAgentIds.includes("knowledge-retrieval");
  const knowledgeRouterActive = activeAgentIds.includes("knowledge-router");
  const illustratorConfig = agentConfigsByType.get("illustrator");
  const proseGuardianConfig = agentConfigsByType.get("prose-guardian");
  const continuityConfig = agentConfigsByType.get("continuity");
  const htmlConfig = agentConfigsByType.get("html");
  const directorConfig = agentConfigsByType.get("director");
  const illustratorDefaults = useMemo(
    () => mergeBuiltInAgentSettings("illustrator", illustratorConfig?.settings),
    [illustratorConfig?.settings],
  );
  const proseGuardianDefaults = useMemo(
    () => mergeBuiltInAgentSettings("prose-guardian", proseGuardianConfig?.settings),
    [proseGuardianConfig?.settings],
  );
  const continuityDefaults = useMemo(
    () => mergeBuiltInAgentSettings("continuity", continuityConfig?.settings),
    [continuityConfig?.settings],
  );
  const htmlDefaults = useMemo(() => mergeBuiltInAgentSettings("html", htmlConfig?.settings), [htmlConfig?.settings]);
  const directorDefaults = useMemo(
    () => mergeBuiltInAgentSettings("director", directorConfig?.settings),
    [directorConfig?.settings],
  );
  const narrativeDirectorSecretPlotEnabled =
    typeof metadata.narrativeDirectorSecretPlotEnabled === "boolean"
      ? metadata.narrativeDirectorSecretPlotEnabled
      : directorDefaults.secretPlotEnabled === true;
  const narrativeDirectorSecretPlotRunInterval = normalizePositiveInteger(
    metadata.narrativeDirectorSecretPlotRunInterval ?? directorDefaults.secretPlotRunInterval,
    8,
    100,
  );
  // #4721: this reader must NOT observe the shared chatKeys.messages infinite
  // query — pageSize lives in that query's option closures (not its key), so a
  // second observer with pageSize 100 hijacks the transcript's queryFn and
  // getNextPageParam: refetches fetch 100 rows regardless of the user's
  // messages-per-page and hasNextPage mis-evaluates, hiding "Load More". The
  // peek hook keys by limit and returns the same newest-N window.
  const secretPlotMessagesQuery = useChatMessagePeek(
    chat.id,
    100,
    open && directorActive && supportsNarrativeDirectorSecretPlot && narrativeDirectorSecretPlotEnabled,
  );
  const secretPlotMessages = useMemo<Message[]>(
    () => secretPlotMessagesQuery.data ?? [],
    [secretPlotMessagesQuery.data],
  );
  const illustratorIncludeCharacterAppearance =
    typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
      ? metadata.illustratorIncludeCharacterAppearance
      : illustratorDefaults.includeCharacterAppearance === true;
  const illustratorUseAvatarReferences =
    typeof metadata.illustratorUseAvatarReferences === "boolean"
      ? metadata.illustratorUseAvatarReferences
      : illustratorDefaults.useAvatarReferences === true;
  const illustratorPromptConnectionId =
    typeof metadata.illustratorPromptConnectionId === "string" ? metadata.illustratorPromptConnectionId : "";
  const illustratorImageConnectionId =
    typeof metadata.illustratorImageConnectionId === "string" ? metadata.illustratorImageConnectionId : "";
  const illustratorImagesPerGeneration = normalizeIllustratorImagesPerGeneration(
    metadata.illustratorImagesPerGeneration,
  );
  const illustratorAutoBackgroundsEnabled = metadata.illustratorAutoBackgroundsEnabled === true;
  const selectedIllustratorPromptConnectionMissing =
    illustratorPromptConnectionId.length > 0 &&
    !illustratorPromptConnectionsList.some((connection) => connection.id === illustratorPromptConnectionId);
  const selectedIllustratorImageConnectionMissing =
    illustratorImageConnectionId.length > 0 &&
    !imageConnectionsList.some((connection) => connection.id === illustratorImageConnectionId);
  const selfieUseAvatarReferences = metadata.selfieUseAvatarReferences === true;
  const selfieIncludeCharacterAppearance = metadata.selfieIncludeCharacterAppearance === true;
  const gameImageUseAvatarReferences = metadata.gameImageUseAvatarReferences !== false;
  const gameImageIncludeCharacterAppearance = metadata.gameImageIncludeCharacterAppearance !== false;
  const gameImageAutoGenerationEnabled = metadata.gameImageAutoGenerationEnabled !== false;
  const gameImageDynamicPromptEnabled = metadata.gameImageDynamicPromptEnabled === true;
  const effectiveCombatStyle: GameCombatStyle =
    (metadata.gameCombatStyle as GameCombatStyle | undefined) ??
    (metadata.gameSetupConfig?.combatStyle as GameCombatStyle | undefined) ??
    "classic";
  const gameSceneVideosEnabled =
    metadata.gameSceneVideosEnabled === true ||
    (metadata.gameSceneVideosEnabled !== false &&
      typeof metadata.gameVideoConnectionId === "string" &&
      metadata.gameVideoConnectionId.trim().length > 0);
  const selectedGameGmPromptTemplateId = useMemo(() => {
    const selected = typeof metadata.gameGmPromptTemplateId === "string" ? metadata.gameGmPromptTemplateId.trim() : "";
    return selected && GAME_GM_BUILT_IN_PROMPT_TEMPLATES.some((template) => template.id === selected) ? selected : null;
  }, [metadata.gameGmPromptTemplateId]);
  const updateGameGmPromptTemplateSelection = useCallback(
    (templateId: string | null) => {
      updateMeta.mutate({ id: chat.id, gameGmPromptTemplateId: templateId });
    },
    [chat.id, updateMeta],
  );
  const gameVideoPromptTemplates = useMemo(
    () => normalizeGameVideoPromptTemplates(metadata.gameVideoPromptTemplates),
    [metadata.gameVideoPromptTemplates],
  );
  const gameVideoPromptOptions = useMemo(
    () => getGameVideoPromptTemplateOptions(gameVideoPromptTemplates),
    [gameVideoPromptTemplates],
  );
  const selectedGameVideoPromptTemplateId = useMemo(
    () => resolveSelectedGameVideoPromptTemplateId(metadata.gameVideoPromptTemplateId, gameVideoPromptOptions),
    [gameVideoPromptOptions, metadata.gameVideoPromptTemplateId],
  );
  const updateGameVideoPromptSelection = useCallback(
    (promptTemplateId: string) => {
      updateMeta.mutate({
        id: chat.id,
        gameVideoPromptTemplateId: promptTemplateId === GAME_VIDEO_PROMPT_TEMPLATE_ID ? null : promptTemplateId,
      });
    },
    [chat.id, updateMeta],
  );
  const updateIllustratorPromptConnection = useCallback(
    (connectionId: string) => {
      updateMeta.mutate({
        id: chat.id,
        illustratorPromptConnectionId: connectionId || null,
      });
    },
    [chat.id, updateMeta],
  );
  const renderIllustratorPromptConnectionSelect = () => (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.promptModel")}
      </span>
      <select
        value={illustratorPromptConnectionId}
        onChange={(event) => updateIllustratorPromptConnection(event.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      >
        <option value="">{localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}</option>
        {selectedIllustratorPromptConnectionMissing && (
          <option value={illustratorPromptConnectionId}>
            {localizeUi("ui.chat.chatsettingsdrawer.missingConnection")}
          </option>
        )}
        {illustratorPromptConnectionsList.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name ?? "Connection"}
            {connection.model ? localizeUi("ui.chat.datablock.value1", { value1: connection.model }) : ""}
          </option>
        ))}
      </select>
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.choosesTheTextModelThatWritesIllustratorSelfiePrompts")}
      </span>
      <AgentDefaultStatus
        overridden={illustratorPromptConnectionId.length > 0}
        onReset={() => updateIllustratorPromptConnection("")}
      />
    </div>
  );
  const updateIllustratorImageConnection = (connectionId: string) => {
    updateMeta.mutate({
      id: chat.id,
      illustratorImageConnectionId: connectionId || null,
    });
  };
  const renderIllustratorImageConnectionSelect = () => (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
      </span>
      <select
        value={illustratorImageConnectionId}
        onChange={(event) => updateIllustratorImageConnection(event.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      >
        <option value="">{localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}</option>
        {selectedIllustratorImageConnectionMissing && (
          <option value={illustratorImageConnectionId}>
            {localizeUi("ui.chat.chatsettingsdrawer.missingConnection")}
          </option>
        )}
        {imageConnectionsList.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name}
            {connection.model ? localizeUi("ui.chat.datablock.value1", { value1: connection.model }) : ""}
          </option>
        ))}
      </select>
      <AgentDefaultStatus
        overridden={illustratorImageConnectionId.length > 0}
        onReset={() => updateIllustratorImageConnection("")}
      />
    </div>
  );
  const toggleIllustratorCharacterAppearance = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorIncludeCharacterAppearance: !illustratorIncludeCharacterAppearance,
    });
  }, [chat.id, illustratorIncludeCharacterAppearance, updateMeta]);
  const toggleIllustratorAvatarReferences = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorUseAvatarReferences: !illustratorUseAvatarReferences,
    });
  }, [chat.id, illustratorUseAvatarReferences, updateMeta]);
  const resetIllustratorCharacterAppearance = useCallback(() => {
    updateMeta.mutate({ id: chat.id, illustratorIncludeCharacterAppearance: null });
  }, [chat.id, updateMeta]);
  const resetIllustratorAvatarReferences = useCallback(() => {
    updateMeta.mutate({ id: chat.id, illustratorUseAvatarReferences: null });
  }, [chat.id, updateMeta]);
  const toggleIllustratorAutoBackgrounds = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorAutoBackgroundsEnabled: !illustratorAutoBackgroundsEnabled,
    });
  }, [chat.id, illustratorAutoBackgroundsEnabled, updateMeta]);
  const renderIllustratorImageStyleSelect = (options: { emptyOptionLabel?: string; description?: string } = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
      </span>
      <select
        value={(metadata.imageStyleProfileId as string) ?? ""}
        onChange={(event) => updateMeta.mutate({ id: chat.id, imageStyleProfileId: event.target.value || null })}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      >
        <option value="">
          {options.emptyOptionLabel ?? "Use default style from Style Profiles in Advanced settings"}
        </option>
        {imageStyleProfiles.profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      {options.description ? (
        <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">{options.description}</span>
      ) : null}
    </label>
  );
  const renderIllustratorImagesPerGeneration = () => (
    <label className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imagesPerGeneration")}
      </span>
      <select
        value={illustratorImagesPerGeneration}
        onChange={(event) =>
          updateMeta.mutate({
            id: chat.id,
            illustratorImagesPerGeneration: normalizeIllustratorImagesPerGeneration(event.target.value),
          })
        }
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      >
        {Array.from({ length: MAX_ILLUSTRATOR_IMAGES_PER_GENERATION }, (_, index) => index + 1).map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.generateThisManyVariantsForEachIllustrationOrSelfie")}
      </span>
    </label>
  );
  const proseGuardianBannedWords =
    typeof metadata.proseGuardianBannedWords === "string"
      ? metadata.proseGuardianBannedWords
      : typeof proseGuardianDefaults.banned === "string"
        ? proseGuardianDefaults.banned
        : DEFAULT_PROSE_GUARDIAN_BANNED_WORDS;
  const proseGuardianAvoidInstructions =
    typeof metadata.proseGuardianAvoidInstructions === "string"
      ? metadata.proseGuardianAvoidInstructions
      : typeof proseGuardianDefaults.avoid === "string"
        ? proseGuardianDefaults.avoid
        : DEFAULT_PROSE_GUARDIAN_AVOID;
  const proseGuardianStyleInstructions =
    typeof metadata.proseGuardianStyleInstructions === "string"
      ? metadata.proseGuardianStyleInstructions
      : typeof proseGuardianDefaults.prefer === "string"
        ? proseGuardianDefaults.prefer
        : "";
  const proseGuardianHoldForRewrite =
    typeof metadata.proseGuardianHoldForRewrite === "boolean"
      ? metadata.proseGuardianHoldForRewrite
      : (proseGuardianActive && proseGuardianDefaults.holdForRewrite !== false) ||
        (continuityActive && continuityDefaults.holdForRewrite !== false) ||
        (htmlActive && htmlDefaults.holdForRewrite !== false);
  const [proseGuardianBannedDraft, setProseGuardianBannedDraft] = useState(proseGuardianBannedWords);
  const [proseGuardianAvoidDraft, setProseGuardianAvoidDraft] = useState(proseGuardianAvoidInstructions);
  const [proseGuardianStyleDraft, setProseGuardianStyleDraft] = useState(proseGuardianStyleInstructions);
  useEffect(() => {
    setProseGuardianBannedDraft(proseGuardianBannedWords);
  }, [proseGuardianBannedWords]);

  useEffect(() => {
    setProseGuardianAvoidDraft(proseGuardianAvoidInstructions);
  }, [proseGuardianAvoidInstructions]);

  useEffect(() => {
    setProseGuardianStyleDraft(proseGuardianStyleInstructions);
  }, [proseGuardianStyleInstructions]);

  const updateMetaAsync = updateMeta.mutateAsync;
  const saveProseGuardianSettings = useCallback(
    (patch: Record<string, unknown>) =>
      trackChatMetadataSave(chat.id, () => updateMetaAsync({ id: chat.id, ...patch })),
    [chat.id, updateMetaAsync],
  );
  const commitProseGuardianSettings = useCallback(
    (patch: Record<string, unknown>) => {
      void saveProseGuardianSettings(patch).catch(() => {
        toast.error(localizeUi("ui.chat.chatsettingsdrawer.failedToSaveProseGuardianChanges"));
      });
    },
    [saveProseGuardianSettings, localizeUi],
  );
  const flushProseGuardianDrafts = useCallback(async () => {
    const patch: Record<string, unknown> = {};
    const banned = proseGuardianBannedDraft.trim();
    const avoid = proseGuardianAvoidDraft.trim();
    const prefer = proseGuardianStyleDraft.trim();

    if (banned !== proseGuardianBannedWords) patch.proseGuardianBannedWords = banned;
    if (avoid !== proseGuardianAvoidInstructions) patch.proseGuardianAvoidInstructions = avoid;
    if (prefer !== proseGuardianStyleInstructions) patch.proseGuardianStyleInstructions = prefer;
    if (Object.keys(patch).length === 0) {
      await waitForPendingChatMetadataSaves(chat.id);
      return true;
    }

    try {
      await saveProseGuardianSettings(patch);
      return true;
    } catch {
      toast.error(localizeUi("ui.chat.chatsettingsdrawer.failedToSaveProseGuardianChanges"));
      return false;
    }
  }, [
    chat.id,
    proseGuardianAvoidDraft,
    proseGuardianAvoidInstructions,
    proseGuardianBannedDraft,
    proseGuardianBannedWords,
    proseGuardianStyleDraft,
    proseGuardianStyleInstructions,
    saveProseGuardianSettings,
    localizeUi,
  ]);
  const getKnowledgeAgentSourceSettings = useCallback(
    (agentType: KnowledgeAgentType) => {
      const config = agentConfigsByType.get(agentType);
      const baseSettings = mergeBuiltInAgentSettings(agentType, config?.settings);
      return normalizeKnowledgeAgentSourceSettings(agentType, baseSettings, metadata.knowledgeAgentSources);
    },
    [agentConfigsByType, metadata.knowledgeAgentSources],
  );
  const updateKnowledgeAgentSourceSettings = useCallback(
    (agentType: KnowledgeAgentType, patch: Partial<KnowledgeAgentSourceSettings>) => {
      const currentSources = isRecord(metadata.knowledgeAgentSources) ? metadata.knowledgeAgentSources : {};
      const nextEntry: KnowledgeAgentSourceSettings = {
        ...getKnowledgeAgentSourceSettings(agentType),
        ...patch,
      };
      if (agentType === "knowledge-router") {
        delete nextEntry.sourceFileIds;
      }
      updateMeta.mutate({
        id: chat.id,
        knowledgeAgentSources: {
          ...currentSources,
          [agentType]: nextEntry,
        },
      });
    },
    [chat.id, getKnowledgeAgentSourceSettings, metadata.knowledgeAgentSources, updateMeta],
  );

  const customAgents = useMemo(() => availableAgents.filter((agent) => agent.category === "custom"), [availableAgents]);
  const activeCustomAgents = useMemo(
    () => customAgents.filter((agent) => activeAgentIds.includes(agent.id)),
    [activeAgentIds, customAgents],
  );
  const inactiveCustomAgents = useMemo(
    () => customAgents.filter((agent) => !activeAgentIds.includes(agent.id)),
    [activeAgentIds, customAgents],
  );
  const mapsAgent = availableAgents.find((agent) => agent.id === mapsPackage?.id);
  const ltmAgent = availableAgents.find((agent) => agent.id === ltmPackage?.id);
  const storyboardAgent = availableAgents.find((agent) => agent.id === STORYBOARD_AGENT_ID);
  const beholderAgent = availableAgents.find((agent) => agent.id === "beholder");
  const standaloneRoleplayAgents = useMemo(
    () =>
      metadata.enableAgents === true && isRoleplayMode
        ? availableAgents.filter((agent) => {
            if (!activeAgentIds.includes(agent.id) || !hasStandaloneRoleplayAgentSettings(agent.id)) return false;
            if (agent.id === "hierarchical-maps") return Boolean(mapsPackage);
            if (agent.id === "long-term-memory") return Boolean(ltmPackage);
            if (agent.id === STORYBOARD_AGENT_ID || agent.id === "beholder") return true;
            return chatSettingsPackageByAgentId.has(agent.id);
          })
        : [],
    [
      activeAgentIds,
      availableAgents,
      chatSettingsPackageByAgentId,
      isRoleplayMode,
      ltmPackage,
      mapsPackage,
      metadata.enableAgents,
    ],
  );
  const standaloneRoleplayAgentIds = useMemo(
    () => new Set(standaloneRoleplayAgents.map((agent) => agent.id)),
    [standaloneRoleplayAgents],
  );
  const [pendingAgentMenuTargetId, setPendingAgentMenuTargetId] = useState<string | null>(null);
  const roleplayAgentMenuLinks = useMemo(() => {
    if (!metadata.enableAgents || !isRoleplayMode || isGame) return [];
    const links: Array<{
      id: string;
      label: string;
      targetId: string;
      order: number;
      count?: number;
    }> = [];
    const addLink = (agentId: string, active: boolean, label: string) => {
      if (!active) return;
      links.push({
        id: agentId,
        label,
        targetId: getAgentSettingsMenuId(chat.id, agentId),
        order: getRoleplayAgentSettingsOrder(agentId),
      });
    };
    addLink("lorebook-keeper", lorebookKeeperActive, lorebookKeeperAgentMeta.name);
    addLink("card-evolution-auditor", cardEvolutionAuditorActive, cardEvolutionAuditorAgentMeta.name);
    addLink("prose-guardian", proseGuardianActive, proseGuardianAgentMeta.name);
    addLink("director", directorActive, directorAgentMeta.name);
    addLink("continuity", continuityActive, continuityAgentMeta.name);
    addLink("html", htmlActive, htmlAgentMeta.name);
    addLink("knowledge-retrieval", knowledgeRetrievalActive, knowledgeRetrievalAgentMeta.name);
    addLink("knowledge-router", knowledgeRouterActive, knowledgeRouterAgentMeta.name);
    addLink("expression", expressionActive, expressionAgentMeta.name);
    addLink("echo-chamber", echoChamberActive, echoChamberAgentMeta.name);
    addLink("illustrator", illustratorActive, illustratorAgentMeta.name);
    addLink("spotify", spotifyActive, musicDjAgentMeta.name);
    addLink("haptic", hapticActive, hapticAgentMeta.name);
    if (ltmAgent && ltmPackage) {
      addLink(ltmPackage.id, metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id), ltmAgent.name);
    }
    if (storyboardAgent) {
      addLink(STORYBOARD_AGENT_ID, activeAgentIds.includes(STORYBOARD_AGENT_ID), storyboardAgent.name);
    }
    if (beholderAgent) addLink("beholder", activeAgentIds.includes("beholder"), beholderAgent.name);
    if (mapsAgent && mapsPackage) addLink(mapsPackage.id, mapsPackageEnabledForChat, mapsAgent.name);
    for (const [agentId, capabilityPackage] of chatSettingsPackageByAgentId) {
      if (
        agentId === "hierarchical-maps" ||
        agentId === "long-term-memory" ||
        links.some((link) => link.id === agentId)
      ) {
        continue;
      }
      const agent = availableAgents.find((candidate) => candidate.id === agentId);
      addLink(agentId, activeAgentIds.includes(agentId), agent?.name ?? capabilityPackage.manifest.name);
    }
    if (activeCustomAgents.length > 0) {
      links.push({
        id: "custom-agents",
        label: activeCustomAgents.length === 1 ? activeCustomAgents[0]!.name : "Custom Agents",
        targetId: getAgentSettingsMenuId(chat.id, "custom-agents"),
        order: customAgentSettingsOrder,
        count: activeCustomAgents.length > 1 ? activeCustomAgents.length : undefined,
      });
    }
    return links.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [
    activeCustomAgents,
    activeAgentIds,
    availableAgents,
    beholderAgent,
    cardEvolutionAuditorActive,
    cardEvolutionAuditorAgentMeta.name,
    chatSettingsPackageByAgentId,
    chat.id,
    continuityActive,
    continuityAgentMeta.name,
    customAgentSettingsOrder,
    directorActive,
    directorAgentMeta.name,
    echoChamberActive,
    echoChamberAgentMeta.name,
    expressionActive,
    expressionAgentMeta.name,
    hapticActive,
    hapticAgentMeta.name,
    htmlActive,
    htmlAgentMeta.name,
    illustratorActive,
    illustratorAgentMeta.name,
    isGame,
    isRoleplayMode,
    getRoleplayAgentSettingsOrder,
    knowledgeRetrievalActive,
    knowledgeRetrievalAgentMeta.name,
    knowledgeRouterActive,
    knowledgeRouterAgentMeta.name,
    ltmAgent,
    ltmPackage,
    lorebookKeeperActive,
    lorebookKeeperAgentMeta.name,
    mapsAgent,
    mapsPackage,
    mapsPackageEnabledForChat,
    metadata.enableAgents,
    musicDjAgentMeta.name,
    proseGuardianActive,
    proseGuardianAgentMeta.name,
    spotifyActive,
    storyboardAgent,
  ]);
  const focusAgentMenu = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    return true;
  }, []);
  const scrollToAgentMenu = useCallback(
    (targetId: string) => {
      if (!focusAgentMenu(targetId)) setPendingAgentMenuTargetId(targetId);
    },
    [focusAgentMenu],
  );
  useEffect(() => {
    if (!pendingAgentMenuTargetId) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (focusAgentMenu(pendingAgentMenuTargetId)) setPendingAgentMenuTargetId(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [focusAgentMenu, pendingAgentMenuTargetId]);
  const gameAgentFeatureCount =
    (metadata.enableAgents ? 1 : 0) +
    (gameLorebookKeeperEnabled ? 1 : 0) +
    (gameMusicDjEnabled ? 1 : 0) +
    activeCustomAgents.length;
  const lorebookKeeperTargetLorebookId =
    typeof metadata.lorebookKeeperTargetLorebookId === "string" ? metadata.lorebookKeeperTargetLorebookId : "";
  const lorebookKeeperReadBehindMessages = normalizeNonNegativeInteger(
    metadata.lorebookKeeperReadBehindMessages,
    0,
    100,
  );

  // Build the available tool list: built-in + custom tools from DB
  const availableTools = useMemo(() => {
    const tools: Array<{ id: string; name: string; description: string }> = [];
    for (const t of BUILT_IN_TOOLS) {
      // update_about_me is Conversation-only (enforced server-side); hide the
      // toggle in other modes so it doesn't look available where it can't run.
      if (t.name === "update_about_me" && !isConversation) continue;
      tools.push({ id: t.name, name: t.name, description: t.description });
    }
    if (customTools) {
      for (const ct of customTools as CustomToolRow[]) {
        if (isCustomToolSelectable(ct, customToolCapabilities)) {
          tools.push({ id: ct.name, name: ct.name, description: ct.description });
        }
      }
    }
    return tools;
  }, [customToolCapabilities, customTools, isConversation]);

  // ── Helpers ──
  const characters = useMemo(
    () =>
      (allCharacters ?? []) as Array<{
        id: string;
        data: string;
        comment?: string | null;
        avatarPath: string | null;
      }>,
    [allCharacters],
  );
  const selectableCharacters = useMemo(
    () => characters.filter((character) => character.id !== PROFESSOR_MARI_ID),
    [characters],
  );

  const chatCharacters = useMemo(
    () =>
      chatCharIds
        .map((characterId) => characters.find((character) => character.id === characterId))
        .filter((character): character is { id: string; data: string; avatarPath: string | null } => !!character),
    [chatCharIds, characters],
  );

  const activePersona = useMemo(
    () => (chat.personaId ? (personas.find((persona) => persona.id === chat.personaId) ?? null) : null),
    [chat.personaId, personas],
  );

  const chatSpriteSubjects = useMemo(
    () => [
      ...chatCharacters.map((character) => ({ kind: "character" as const, id: character.id, character })),
      ...(activePersona ? [{ kind: "persona" as const, id: activePersona.id, persona: activePersona }] : []),
    ],
    [activePersona, chatCharacters],
  );

  const chatSpriteQueries = useQueries({
    queries: chatSpriteSubjects.map((subject) => ({
      queryKey: ["sprites", subject.id],
      queryFn: () => api.get<SpriteInfo[]>(`/sprites/${subject.id}`),
      enabled: !!subject.id,
      staleTime: 5 * 60_000,
    })),
  });

  const chatSpriteSubjectsWithSprites = chatSpriteSubjects.filter((_, index) => {
    const sprites = chatSpriteQueries[index]?.data;
    return Array.isArray(sprites) && sprites.length > 0;
  });
  const chatSpriteSubjectsLoading =
    (chatCharIds.length > 0 && allCharacters == null) || (!!chat.personaId && allPersonas == null);
  const chatSpriteChoicesLoading =
    chatSpriteSubjects.length > 0 &&
    chatSpriteSubjectsWithSprites.length === 0 &&
    chatSpriteQueries.some((query) => query.isLoading);

  // Memoize character name parsing — avoids repeated JSON.parse per render
  const charInfoMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseCharacterDisplayData>>();
    for (const c of characters) {
      map.set(c.id, parseCharacterDisplayData(c));
    }
    return map;
  }, [characters]);

  const charNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, info] of charInfoMap) {
      map.set(id, info.name);
    }
    return map;
  }, [charInfoMap]);

  const getCharacterInfo = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => {
      if (c.id && charInfoMap.has(c.id)) return charInfoMap.get(c.id)!;
      return parseCharacterDisplayData(c);
    },
    [charInfoMap],
  );

  const charName = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => getCharacterInfo(c).name,
    [getCharacterInfo],
  );

  const charTitle = useCallback(
    (c: { id?: string; data: string; comment?: string | null }) => getCharacterTitle(getCharacterInfo(c)),
    [getCharacterInfo],
  );

  const renderInlineCardEditor = (kind: "character" | "persona", id: string, displayName: string) => {
    if (inlineResourceEditor?.kind !== kind || inlineResourceEditor.id !== id) return null;
    return (
      <Suspense
        fallback={
          <div className="mari-chat-settings-inline-editor mt-2 space-y-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5">
            <div className="shimmer h-7 rounded-lg" />
            <div className="shimmer h-14 rounded-lg" />
            <div className="shimmer h-14 rounded-lg" />
          </div>
        }
      >
        <InlineChatCardEditor
          key={`${kind}:${id}`}
          entityKind={kind}
          entityId={id}
          displayName={displayName}
          onClose={() => setInlineResourceEditor(null)}
        />
      </Suspense>
    );
  };

  const agentAddSpriteSubjects = useMemo<AgentAddSpriteSubject[]>(
    () =>
      chatSpriteSubjects.map((subject) => {
        if (subject.kind === "persona") {
          return {
            id: subject.id,
            name: subject.persona.name,
            subtitle: subject.persona.comment || "Persona",
            avatarPath: subject.persona.avatarPath ?? null,
          };
        }
        return {
          id: subject.id,
          name: charName(subject.character),
          subtitle: charTitle(subject.character),
          avatarPath: subject.character.avatarPath ?? null,
        };
      }),
    [chatSpriteSubjects, charName, charTitle],
  );
  const spriteLayoutSubjects = useMemo(
    () => agentAddSpriteSubjects.filter((subject) => spriteCharacterIds.includes(subject.id)),
    [agentAddSpriteSubjects, spriteCharacterIds],
  );

  useEffect(() => {
    setSelectedSpriteLayoutCharacterId(null);
  }, [chat.id]);

  useEffect(() => {
    setSelectedSpriteLayoutCharacterId((current) => {
      if (current && spriteLayoutSubjects.some((subject) => subject.id === current)) return current;
      return null;
    });
  }, [spriteLayoutSubjects]);

  // ── First message confirm state ──
  const [firstMesConfirm, setFirstMesConfirm] = useState<{
    charId: string;
    charName: string;
    dialogueColor?: string;
    greetings: CharacterGreeting[];
    selectedIndex: number;
  } | null>(null);
  const greetingDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusScope(firstMesConfirm !== null, greetingDialogRef);

  useEffect(() => {
    if (!firstMesConfirm) return;
    const dismissGreetingDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFirstMesConfirm(null);
    };
    document.addEventListener("keydown", dismissGreetingDialog);
    return () => document.removeEventListener("keydown", dismissGreetingDialog);
  }, [firstMesConfirm]);

  const handleFirstMesConfirm = useCallback(async () => {
    if (!firstMesConfirm) return;
    const confirmation = firstMesConfirm;
    const selectedGreeting = confirmation.greetings[confirmation.selectedIndex];
    if (!selectedGreeting) return;
    let messageId: string | null = null;
    try {
      const msg = await createMessage.mutateAsync({
        role: "assistant",
        content: selectedGreeting.text,
        characterId: confirmation.charId,
      });
      messageId = msg?.id ?? null;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
      return;
    }

    const remainingGreetings = confirmation.greetings
      .filter((_greeting, index) => index !== confirmation.selectedIndex)
      .map((greeting) => greeting.text);
    try {
      if (messageId && remainingGreetings.length > 0) {
        await addSilentGreetingSwipes(chat.id, messageId, remainingGreetings);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
    }
    try {
      await qc.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
    }
    setFirstMesConfirm((current) => (current === confirmation ? null : current));
  }, [firstMesConfirm, createMessage, chat.id, qc, localizeUi]);

  // ── Mutations ──
  const syncGamePartyMetadata = (nextCharacterIds: string[]) => {
    if (!isGame) return;
    const storedPartyIds: unknown[] = Array.isArray(metadata.gamePartyCharacterIds)
      ? metadata.gamePartyCharacterIds
      : Array.isArray((metadata.gameSetupConfig as { partyCharacterIds?: unknown[] } | undefined)?.partyCharacterIds)
        ? (metadata.gameSetupConfig as { partyCharacterIds: unknown[] }).partyCharacterIds
        : [];
    const npcPartyIds = storedPartyIds.filter((id): id is string => typeof id === "string" && id.startsWith("npc:"));
    const nextPartyIds = Array.from(new Set([...nextCharacterIds, ...npcPartyIds]));
    const gameSetupConfig =
      metadata.gameSetupConfig && typeof metadata.gameSetupConfig === "object"
        ? { ...(metadata.gameSetupConfig as Record<string, unknown>), partyCharacterIds: nextPartyIds }
        : metadata.gameSetupConfig;
    updateMeta.mutate({
      id: chat.id,
      gamePartyCharacterIds: nextPartyIds,
      ...(gameSetupConfig ? { gameSetupConfig } : {}),
    });
  };

  const toggleCharacter = (charId: string) => {
    const current = [...chatCharIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
      updateChat.mutate(
        { id: chat.id, characterIds: current },
        {
          onSuccess: () => syncGamePartyMetadata(current),
        },
      );
      if (spriteCharacterIds.includes(charId)) {
        const nextSpritePlacements = { ...normalizeSpritePlacements(metadata.spritePlacements) };
        delete nextSpritePlacements[charId];
        delete nextSpritePlacements[`${charId}:expressions`];
        delete nextSpritePlacements[`${charId}:full-body`];
        updateMeta.mutate({
          id: chat.id,
          spriteCharacterIds: spriteCharacterIds.filter((id) => id !== charId),
          spritePlacements: nextSpritePlacements,
        });
      }
      if (inactiveCharacterIds.includes(charId)) {
        updateMeta.mutate({
          id: chat.id,
          inactiveCharacterIds: inactiveCharacterIds.filter((id) => id !== charId),
        });
      }
    } else {
      current.push(charId);
      updateChat.mutate(
        { id: chat.id, characterIds: current },
        {
          onSuccess: () => {
            syncGamePartyMetadata(current);
            // Skip auto-greeting for conversation mode
            if (isConversation) return;
            const char = characters.find((c) => c.id === charId);
            if (!char) return;
            const { greetings, dialogueColor } = readCharacterGreetings(char.data);
            if (greetings.length > 0) {
              setFirstMesConfirm({
                charId,
                charName: charName(char),
                dialogueColor,
                greetings,
                selectedIndex: 0,
              });
            }
          },
        },
      );
    }
  };

  const toggleCharacterActivity = (charId: string) => {
    if (!supportsCharacterActivityToggle) return;
    const isInactive = inactiveCharacterIds.includes(charId);
    if (!isInactive && activeCharacterIds.length <= 1) {
      void showAlertDialog({
        title: "Keep one character active",
        message: "At least one character needs to stay active so the chat has someone to respond.",
      });
      return;
    }
    updateMeta.mutate({
      id: chat.id,
      inactiveCharacterIds: isInactive
        ? inactiveCharacterIds.filter((id) => id !== charId)
        : [...inactiveCharacterIds, charId],
    });
  };

  const toggleSprite = (charId: string) => {
    const current = [...spriteCharacterIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(charId);
    }
    updateMeta.mutate({ id: chat.id, spriteCharacterIds: current });
  };

  const toggleSpriteDisplayMode = (mode: SpriteDisplayMode) => {
    const current = normalizeSpriteDisplayModes(metadata.spriteDisplayModes);
    const active = current.includes(mode);
    const next = active ? current.filter((value) => value !== mode) : [...current, mode];
    updateMeta.mutate({
      id: chat.id,
      spriteDisplayModes: next.length > 0 ? next : [...DEFAULT_SPRITE_DISPLAY_MODES],
    });
  };

  const updateSpriteCharacterVisualSettings = useCallback(
    (nextSettings: Record<string, SpriteCharacterVisualSettings>) => {
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ characterOverrides: nextSettings });
        return;
      }
      updateMeta.mutate({ id: chat.id, spriteCharacterVisualSettings: nextSettings });
    },
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
  );

  const patchSelectedSpriteCharacterVisualSettings = useCallback(
    (patch: Partial<SpriteCharacterVisualSettings>) => {
      if (!selectedSpriteLayoutCharacterId) return false;
      updateSpriteCharacterVisualSettings({
        ...spriteCharacterVisualSettings,
        [selectedSpriteLayoutCharacterId]: {
          ...(spriteCharacterVisualSettings[selectedSpriteLayoutCharacterId] ?? {}),
          ...patch,
        },
      });
      return true;
    },
    [selectedSpriteLayoutCharacterId, spriteCharacterVisualSettings, updateSpriteCharacterVisualSettings],
  );

  const resetSelectedSpriteCharacterVisualSettings = useCallback(() => {
    if (!selectedSpriteLayoutCharacterId) return;
    if (onResetSpriteCharacterVisualSettings) {
      onResetSpriteCharacterVisualSettings(selectedSpriteLayoutCharacterId);
      return;
    }
    const nextSettings = { ...spriteCharacterVisualSettings };
    delete nextSettings[selectedSpriteLayoutCharacterId];
    updateSpriteCharacterVisualSettings(nextSettings);
  }, [
    onResetSpriteCharacterVisualSettings,
    selectedSpriteLayoutCharacterId,
    spriteCharacterVisualSettings,
    updateSpriteCharacterVisualSettings,
  ]);

  const setSpriteSide = useCallback(
    (nextSide: "left" | "right") => {
      if (selectedSpriteLayoutCharacterId) {
        if (onSpriteSideChange) {
          onSpriteSideChange(nextSide, selectedSpriteLayoutCharacterId);
          return;
        }
        patchSelectedSpriteCharacterVisualSettings({ spritePosition: nextSide });
        return;
      }
      if (nextSide === editedSpritePosition) return;
      if (onSpriteSideChange) {
        onSpriteSideChange(nextSide);
        return;
      }
      updateMeta.mutate({ id: chat.id, spritePosition: nextSide });
    },
    [
      chat.id,
      editedSpritePosition,
      onSpriteSideChange,
      patchSelectedSpriteCharacterVisualSettings,
      selectedSpriteLayoutCharacterId,
      updateMeta,
    ],
  );

  const resetSpritePlacements = useCallback(() => {
    if (onResetSpritePlacements) {
      onResetSpritePlacements();
      return;
    }
    updateMeta.mutate({ id: chat.id, spritePlacements: {} });
  }, [chat.id, onResetSpritePlacements, updateMeta]);

  const setExpressionSpriteScale = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_SCALE_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, nextPercent),
      );
      setExpressionSpriteScalePercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ expressionSpriteScale: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ expressionSpriteScale: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        expressionSpriteScale: clampedPercent / 100,
        spriteScale: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setFullBodySpriteScale = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_SCALE_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteScalePercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ fullBodySpriteScale: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteScale: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteScale: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setExpressionSpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setExpressionSpriteOpacityPercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ expressionSpriteOpacity: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ expressionSpriteOpacity: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        expressionSpriteOpacity: clampedPercent / 100,
        spriteOpacity: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setFullBodySpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteOpacityPercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ fullBodySpriteOpacity: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteOpacity: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteOpacity: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  // ── Character drag-and-drop reordering ──
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleCharDragStart = (idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleCharDragOver = (cardIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropIdx(e.clientY < midY ? cardIdx : cardIdx + 1);
  };

  const commitCharacterReorder = useCallback(
    (sourceIdx: number, targetIdx: number) => {
      if (sourceIdx < 0 || sourceIdx >= chatCharIds.length || targetIdx < 0 || targetIdx > chatCharIds.length) return;
      let insertAt = targetIdx;
      if (sourceIdx < insertAt) insertAt--;
      if (sourceIdx === insertAt) return;
      const ids = [...chatCharIds];
      const [moved] = ids.splice(sourceIdx, 1);
      if (!moved) return;
      ids.splice(insertAt, 0, moved);
      updateChat.mutate({ id: chat.id, characterIds: ids });
    },
    [chat.id, chatCharIds, updateChat],
  );

  const handleCharDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragIdx;
    const tgt = dropIdx;
    setDragIdx(null);
    setDropIdx(null);
    if (src === null || tgt === null) return;
    commitCharacterReorder(src, tgt);
  };

  const handleCharDragEnd = () => {
    setDragIdx(null);
    setDropIdx(null);
  };

  const { startTouchDrag: startCharacterReorderTouchDrag } = useTouchFolderDrag({
    onActivate: (characterId) => {
      const idx = chatCharIds.indexOf(characterId);
      if (idx < 0) return;
      setDragIdx(idx);
    },
    onDrop: (characterId, x, y) => {
      const sourceIdx = chatCharIds.indexOf(characterId);
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="chat-settings-character"]',
        rootSelector: "[data-chat-settings-character-root]",
        itemCount: chatCharIds.length,
      });
      setDragIdx(null);
      setDropIdx(null);
      if (sourceIdx < 0 || targetIdx === null) return;
      commitCharacterReorder(sourceIdx, targetIdx);
    },
    onCancel: () => {
      setDragIdx(null);
      setDropIdx(null);
    },
  });

  const toggleLorebook = (lbId: string) => {
    const current = readLatestActiveLorebookIds();
    const idx = current.indexOf(lbId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(lbId);
    updateMeta.mutate({ id: chat.id, activeLorebookIds: current });
  };

  // Disable / re-enable an auto-activated (character/global/persona) lorebook for
  // this chat. Unlike unpinning, this does not touch activeLorebookIds — it adds
  // the book to excludedLorebookIds so the scope filter drops it before injection.
  const setLorebookExcluded = (lbId: string, excluded: boolean) => {
    const current = readLatestExcludedLorebookIds();
    const has = current.includes(lbId);
    if (excluded === has) return;
    const next = excluded ? [...current, lbId] : current.filter((id) => id !== lbId);
    updateMeta.mutate({ id: chat.id, excludedLorebookIds: next });
  };

  const hasSecretPlotMemory = (memory: Record<string, unknown> | null | undefined) => {
    if (!memory) return false;
    const arc = memory.overarchingArc;
    if (typeof arc === "string" && arc.trim()) return true;
    if (arc && typeof arc === "object") {
      const arcRecord = arc as Record<string, unknown>;
      if (
        String(arcRecord.description ?? "").trim() ||
        String(arcRecord.protagonistArc ?? "").trim() ||
        String(arcRecord.characterArc ?? "").trim() ||
        arcRecord.completed === true
      ) {
        return true;
      }
    }
    return false;
  };

  const getNarrativeDirectorRemovalWarning = async (): Promise<string | null> => {
    let shouldWarn: boolean;
    try {
      const res = await api.get<{ memory: Record<string, unknown> }>(`/agents/memory/director/${chat.id}`);
      shouldWarn = hasSecretPlotMemory(res.memory);
    } catch {
      shouldWarn = true;
    }
    return shouldWarn
      ? "Are you sure you want to remove Narrative Director from this chat? This will wipe its hidden secret plot arc for this chat. This cannot be undone."
      : null;
  };

  const toggleAgent = async (agentId: string, options?: { skipDirectorRemovalWarning?: boolean }) => {
    const wasRemoving = readLatestActiveAgentIds().includes(agentId);
    if (wasRemoving && agentId === "director" && !options?.skipDirectorRemovalWarning) {
      const warningMessage = await getNarrativeDirectorRemovalWarning();
      if (warningMessage) {
        const ok = await showConfirmDialog({
          title: localizeUi("ui.chat.chatsettingsdrawer.removeNarrativeDirector"),
          message: warningMessage,
          confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.removeAgent"),
          tone: "destructive",
        });
        if (!ok) return;
      }
    }

    const current = readLatestActiveAgentIds();
    const idx = current.indexOf(agentId);
    const isRemoving = idx >= 0;
    if (isRemoving) current.splice(idx, 1);
    else current.push(agentId);
    const latestPromptTemplateSelections = readLatestAgentPromptTemplateSelections();
    const nextPromptTemplateSelections =
      isRemoving && latestPromptTemplateSelections[agentId]
        ? (() => {
            const next = { ...latestPromptTemplateSelections };
            delete next[agentId];
            return next;
          })()
        : null;
    let metadataSaved = false;
    if (isRemoving) removingAgentImageSettingsRef.current.add(agentId);
    try {
      if (isRemoving) {
        do {
          await flushPendingCustomAgentImageSettings().catch(() => undefined);
          await customAgentImageSettingsWriteQueueRef.current.waitForIdle();
        } while (pendingCustomAgentImageSettingsRef.current?.chatId === chat.id);
      }
      const latestImageSettings = readLatestCustomAgentImageSettings();
      const nextImageSettings =
        isRemoving && latestImageSettings[agentId]
          ? (() => {
              const next = { ...latestImageSettings };
              delete next[agentId];
              return next;
            })()
          : null;
      const saveAgentSelection = async () => {
        await updateMeta.mutateAsync(
          {
            id: chat.id,
            activeAgentIds: current,
            ...(nextPromptTemplateSelections ? { agentPromptTemplateIds: nextPromptTemplateSelections } : {}),
            ...(nextImageSettings ? { customAgentImageSettings: nextImageSettings } : {}),
          },
          {
            onSuccess: async () => {
              metadataSaved = true;
              // When removing an agent that stores persistent memory, clean it up after metadata is saved.
              if (isRemoving && agentId === "director") {
                await api.delete(`/agents/memory/${agentId}/${chat.id}`);
              }
            },
          },
        );
      };
      if (isRemoving) await customAgentImageSettingsWriteQueueRef.current.enqueue(saveAgentSelection);
      else await saveAgentSelection();
    } catch (error) {
      if (metadataSaved && isRemoving && agentId === "director") {
        const rollbackIds = Array.from(new Set([...readLatestActiveAgentIds(), agentId]));
        await updateMeta.mutateAsync({ id: chat.id, activeAgentIds: rollbackIds }).catch(() => undefined);
      }
      await showAlertDialog({
        title: isRemoving ? "Couldn't Remove Agent" : "Couldn't Add Agent",
        message: error instanceof Error ? error.message : "The agent list could not be updated. Please try again.",
      });
    } finally {
      if (isRemoving) removingAgentImageSettingsRef.current.delete(agentId);
    }
  };

  const removeAgentFromMenu = async (agentId: string, agentName: string) => {
    const warningMessage = agentId === "director" ? await getNarrativeDirectorRemovalWarning() : null;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.chatsettingsdrawer.removeValue1", { value1: agentName }),
      message: warningMessage ?? `Are you sure you want to remove ${agentName} from this chat?`,
      confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.removeAgent"),
      tone: "destructive",
    });
    if (!ok) return;
    await toggleAgent(agentId, { skipDirectorRemovalWarning: true });
  };

  const getRoleplayAgentMenuRemoveHandler = (agentId: string, agentName: string) => {
    if (!isRoleplayMode) return undefined;
    return () => {
      void removeAgentFromMenu(agentId, agentName);
    };
  };

  const renderStandaloneRoleplayAgentSettingsCard = (agent: (typeof availableAgents)[number]) => {
    let settings: React.ReactNode = null;

    if (agent.id === "hierarchical-maps" && mapsPackage) {
      settings = (
        <CapabilityElement
          packageId={mapsPackage.id}
          view="settings"
          capabilityProps={{
            chatId: chat.id,
            chatName: chat.name,
            chatMode,
            debugMode,
            enabledForChat: mapsPackageEnabledForChat,
            onEnabledForChatChange: setMapsEnabledForChat,
            confirmAction: showConfirmDialog,
            onDirtyChange: setEditorDirty,
            onOpenLorebook: openLorebookFromSettings,
            onLorebooksChanged: refreshLorebooks,
          }}
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === "long-term-memory" && ltmPackage) {
      settings = (
        <CapabilityElement
          packageId={ltmPackage.id}
          view="settings"
          capabilityProps={{
            chatId: chat.id,
            enabledForChat: metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id),
            chatSettings: {
              longTermMemoryRecallStyle: metadata.longTermMemoryRecallStyle,
              longTermMemoryBudgetTokens: metadata.longTermMemoryBudgetTokens,
              longTermMemoryMaxChunks: metadata.longTermMemoryMaxChunks,
            },
            onEnabledForChatChange: setLtmEnabledForChat,
            onChatSettingsChange: async (patch: Record<string, unknown>) => {
              await updateMeta.mutateAsync({ id: chat.id, ...patch });
            },
            onOpenAgentSettings: () => {
              void requestClose().then((closed) => {
                if (closed) useUIStore.getState().openAgentDetail("long-term-memory");
              });
            },
            onDirtyChange: setEditorDirty,
          }}
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === STORYBOARD_AGENT_ID) {
      settings = (
        <Suspense fallback={null}>
          <StoryboardChatSettingsPanel
            chatId={chat.id}
            metadata={metadata as Record<string, unknown>}
            onClose={onClose}
            ownerMode="roleplay"
          />
        </Suspense>
      );
    } else if (agent.id === "beholder") {
      settings = (
        <Suspense fallback={null}>
          <BeholderChatSettingsPanel
            chatId={chat.id}
            onOpenAgentSettings={() => {
              void requestClose().then((closed) => {
                if (closed) useUIStore.getState().openAgentDetail("beholder");
              });
            }}
          />
        </Suspense>
      );
    } else {
      settings = renderDownloadedAgentChatSettings(agent, "block overflow-hidden");
    }

    if (!settings) return null;
    return (
      <AgentSettingsCard
        key={agent.id}
        id={getAgentSettingsMenuId(chat.id, agent.id)}
        icon={renderRoleplayAgentMenuIcon(agent.id)}
        title={agent.name}
        description={
          agent.id === "hierarchical-maps"
            ? worldMapsSettingsDescription
            : getActiveAgentMenuDescription(agent.description)
        }
        order={getRoleplayAgentSettingsOrder(agent.id)}
        onRemove={getRoleplayAgentMenuRemoveHandler(agent.id, agent.name)}
      >
        {settings}
      </AgentSettingsCard>
    );
  };

  const updateAgentPromptTemplateSelection = useCallback(
    (agentId: string, promptTemplateId: string) => {
      const next = { ...readLatestAgentPromptTemplateSelections() };
      if (!promptTemplateId || promptTemplateId === getDefaultPromptTemplateIdForAgent(agentId)) {
        delete next[agentId];
      } else {
        next[agentId] = promptTemplateId;
      }
      updateMeta.mutate({ id: chat.id, agentPromptTemplateIds: next });
    },
    [chat.id, getDefaultPromptTemplateIdForAgent, readLatestAgentPromptTemplateSelections, updateMeta],
  );

  const handleLorebookKeeperBackfill = useCallback(async () => {
    await retryAgents(chat.id, ["lorebook-keeper"], { lorebookKeeperBackfill: true });
  }, [chat.id, retryAgents]);

  const handleRerunCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId]);
    },
    [chat.id, retryAgents],
  );

  const handleBackfillCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId], { customLorebookBackfill: true });
    },
    [chat.id, retryAgents],
  );

  const updateCustomAgentBackfillSettings = useCallback(
    async (agentId: string, patch: Record<string, unknown>) => {
      const config = agentConfigsByType.get(agentId);
      if (!config) return;
      try {
        await updateAgentConfig.mutateAsync({
          id: config.id,
          settings: { ...parseAgentSettingsRecord(config.settings), ...patch },
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.chat.customAgentBackfill.couldNotSaveSettings"),
        );
      }
    },
    [agentConfigsByType, localizeUi, updateAgentConfig],
  );

  const customAgentImageSelections = useMemo(() => {
    const raw = metadata.customAgentImageSettings;
    const persisted =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Partial<Record<string, CustomAgentImageSetting>>)
        : {};
    if (customAgentImageSettingsDraft?.chatId !== chat.id) return persisted;
    const merged = { ...persisted };
    for (const [agentId, settings] of Object.entries(customAgentImageSettingsDraft.patch)) {
      if (settings) merged[agentId] = settings;
      else delete merged[agentId];
    }
    return merged;
  }, [chat.id, customAgentImageSettingsDraft, metadata.customAgentImageSettings]);
  const readLatestCustomAgentImageSettings = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const latestMetadata =
      latestChat && typeof latestChat.metadata === "string"
        ? JSON.parse(latestChat.metadata)
        : (latestChat?.metadata ?? metadata);
    const raw =
      latestMetadata && typeof latestMetadata === "object"
        ? (latestMetadata as { customAgentImageSettings?: unknown }).customAgentImageSettings
        : undefined;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? {
          ...(raw as Record<string, CustomAgentImageSetting>),
        }
      : {};
  }, [chat.id, metadata, qc]);
  const flushPendingCustomAgentImageSettings = useCallback((): Promise<void> => {
    if (pendingCustomAgentImageSettingsTimerRef.current !== null) {
      clearTimeout(pendingCustomAgentImageSettingsTimerRef.current);
      pendingCustomAgentImageSettingsTimerRef.current = null;
    }
    const pending = pendingCustomAgentImageSettingsRef.current;
    if (!pending) return customAgentImageSettingsWriteQueueRef.current.waitForIdle();
    pendingCustomAgentImageSettingsRef.current = null;
    return customAgentImageSettingsWriteQueueRef.current
      .enqueue(async () => {
        await updateMetaMutateAsyncRef.current({
          id: pending.chatId,
          customAgentImageSettings: pending.settings,
        });
      })
      .finally(() => {
        setCustomAgentImageSettingsDraft((current) =>
          current?.chatId === pending.chatId && current.revision === pending.revision ? null : current,
        );
      });
  }, []);
  useEffect(
    () => () => {
      void flushPendingCustomAgentImageSettings().catch(() => undefined);
    },
    [chat.id, flushPendingCustomAgentImageSettings],
  );
  const updateCustomAgentImageSetting = useCallback(
    (agentId: string, field: "imageConnectionId" | "styleProfileId", value: string) => {
      if (removingAgentImageSettingsRef.current.has(agentId)) return;
      const pending = pendingCustomAgentImageSettingsRef.current;
      if (pending && pending.chatId !== chat.id) {
        void flushPendingCustomAgentImageSettings().catch(() => undefined);
      }
      const next = pending?.chatId === chat.id ? { ...pending.settings } : readLatestCustomAgentImageSettings();
      const agentSettings = { ...next[agentId] };
      if (value) agentSettings[field] = value;
      else delete agentSettings[field];
      const hasAgentSettings = !!(agentSettings.imageConnectionId || agentSettings.styleProfileId);
      if (hasAgentSettings) next[agentId] = agentSettings;
      else delete next[agentId];
      const revision = customAgentImageSettingsRevisionRef.current + 1;
      customAgentImageSettingsRevisionRef.current = revision;
      pendingCustomAgentImageSettingsRef.current = { chatId: chat.id, revision, settings: next };
      setCustomAgentImageSettingsDraft((current) => ({
        chatId: chat.id,
        revision,
        patch: {
          ...(current?.chatId === chat.id ? current.patch : {}),
          [agentId]: hasAgentSettings ? agentSettings : null,
        },
      }));
      if (pendingCustomAgentImageSettingsTimerRef.current !== null) {
        clearTimeout(pendingCustomAgentImageSettingsTimerRef.current);
      }
      pendingCustomAgentImageSettingsTimerRef.current = setTimeout(() => {
        void flushPendingCustomAgentImageSettings().catch(() => undefined);
      }, 150);
    },
    [chat.id, flushPendingCustomAgentImageSettings, readLatestCustomAgentImageSettings],
  );
  const updateCustomAgentImageConnection = useCallback(
    (agentId: string, connectionId: string) =>
      updateCustomAgentImageSetting(agentId, "imageConnectionId", connectionId),
    [updateCustomAgentImageSetting],
  );
  const updateCustomAgentImageStyle = useCallback(
    (agentId: string, styleProfileId: string) =>
      updateCustomAgentImageSetting(agentId, "styleProfileId", styleProfileId),
    [updateCustomAgentImageSetting],
  );
  const isImageCapableCustomAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      return !!cfg && customAgentHasCapability(parseAgentSettingsRecord(cfg.settings), "trigger_image_generation");
    },
    [agentConfigsByType],
  );
  const handleSnapshotCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId], { forceImageGeneration: true });
    },
    [chat.id, retryAgents],
  );

  const toggleTool = (toolId: string) => {
    const current = [...activeToolIds];
    const idx = current.indexOf(toolId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(toolId);
    updateMeta.mutate({ id: chat.id, activeToolIds: current });
  };

  const handleCreateCustomTool = () => {
    setShowToolPicker(false);
    setPendingToolIds([]);
    setToolSearch("");
    openToolDetail("__new__");
    onClose();
  };

  const currentPromptPresetHasVariables = (currentPromptPresetFull?.choiceBlocks?.length ?? 0) > 0;
  const currentPromptPresetHasLorebookMarker = useMemo(() => {
    const sections = currentPromptPresetFull?.sections ?? [];
    return sections.some((section) => {
      const enabled = (section as { enabled?: boolean | string }).enabled;
      const isMarker = (section as { isMarker?: boolean | string }).isMarker;
      if (enabled === false || enabled === "false") return false;
      if (isMarker !== true && isMarker !== "true") return false;
      try {
        const config =
          typeof section.markerConfig === "string" ? JSON.parse(section.markerConfig) : section.markerConfig;
        return (
          config?.type === "lorebook" || config?.type === "world_info_before" || config?.type === "world_info_after"
        );
      } catch {
        return false;
      }
    });
  }, [currentPromptPresetFull?.sections]);
  const hasScopedOrGlobalLorebooks = useMemo(() => {
    return ((lorebooks ?? []) as Lorebook[]).some(
      (lorebook) =>
        lorebook.enabled !== false &&
        isLorebookScopeActiveForChat(lorebook.scope, chat.id) &&
        !(
          isGame &&
          !gameLorebookKeeperEnabled &&
          (lorebook.id === gameLorebookKeeperLorebookId || lorebook.sourceAgentId === "game-lorebook-keeper")
        ) &&
        (lorebook.isGlobal ||
          activeLorebookIds.includes(lorebook.id) ||
          lorebook.characterIds?.some((id) => chatCharIds.includes(id)) ||
          (lorebook.characterId && chatCharIds.includes(lorebook.characterId)) ||
          (chat.personaId && lorebook.personaIds?.includes(chat.personaId)) ||
          (lorebook.personaId && lorebook.personaId === chat.personaId) ||
          (lorebook.chatId && lorebook.chatId === chat.id)),
    );
  }, [
    activeLorebookIds,
    chat.id,
    chat.personaId,
    chatCharIds,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    isGame,
    lorebooks,
  ]);
  const showLorebookMarkerWarning =
    !!chat.promptPresetId &&
    !isConversation &&
    !isGame &&
    hasScopedOrGlobalLorebooks &&
    !currentPromptPresetHasLorebookMarker;

  const [choiceModalPresetId, setChoiceModalPresetId] = useState<string | null>(null);
  const setPreset = useCallback(
    (presetId: string | null) => {
      updateChat.mutate(
        { id: chat.id, promptPresetId: presetId },
        {
          onSuccess: async () => {
            if (!presetId || !isRoleplayMode) {
              setChoiceModalPresetId(null);
              return;
            }

            try {
              const presetFull = await api.get<{ choiceBlocks?: unknown[] }>(`/prompts/${presetId}/full`);
              if ((presetFull.choiceBlocks?.length ?? 0) > 0) {
                setChoiceModalPresetId(presetId);
              } else {
                setChoiceModalPresetId(null);
              }
            } catch {
              setChoiceModalPresetId(null);
            }
          },
        },
      );
    },
    [chat.id, isRoleplayMode, updateChat],
  );
  const assignEditablePresetCopy = useCallback(
    (presetId: string) => {
      updateChat.mutate({ id: chat.id, promptPresetId: presetId });
    },
    [chat.id, updateChat],
  );

  const setConnection = (connectionId: string | null) => {
    updateChat.mutate({ id: chat.id, connectionId });
  };

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(chat.name);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showLbPicker, setShowLbPicker] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showConnectionPicker, setShowConnectionPicker] = useState(false);
  const [showSummariesModal, setShowSummariesModal] = useState(false);
  const [showAgentSuiteModal, setShowAgentSuiteModal] = useState(false);
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [inlineResourceEditor, setInlineResourceEditor] = useState<{
    kind: "character" | "persona" | "lorebook";
    id: string;
  } | null>(null);
  const toggleInlineResourceEditor = useCallback((kind: "character" | "persona" | "lorebook", id: string) => {
    setInlineResourceEditor((current) => (current?.kind === kind && current.id === id ? null : { kind, id }));
  }, []);
  useEffect(() => {
    setInlineResourceEditor(null);
  }, [chat.id]);
  const handleAgentSuiteCloseGuardChange = useCallback((guard: (() => Promise<boolean>) | null) => {
    agentSuiteCloseGuardRef.current = guard;
  }, []);
  const requestClose = useCallback(async () => {
    if (drawerClosingRef.current) return false;
    blurActiveChatFloatingUiControl();
    drawerClosingRef.current = true;
    try {
      const canCloseAgentSuite =
        !showAgentSuiteModal || (await (agentSuiteCloseGuardRef.current?.() ?? Promise.resolve(true)));
      if (!canCloseAgentSuite) return false;
      if (!(await flushProseGuardianDrafts())) return false;
      setShowAgentSuiteModal(false);
      onClose();
      return true;
    } finally {
      drawerClosingRef.current = false;
    }
  }, [flushProseGuardianDrafts, onClose, showAgentSuiteModal]);
  // Session-ephemeral: did the user change Day Rollover Hour in this drawer mount?
  // Used to gate the "transitional duplication" warning so it only appears
  // immediately after a change (when the warning is operationally useful) and
  // doesn't permanently clutter chats that already have summaries.
  const [rolloverTouchedThisSession, setRolloverTouchedThisSession] = useState(false);
  useEffect(() => {
    setRolloverTouchedThisSession(false);
  }, [chat.id]);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [personaSearch, setPersonaSearch] = useState("");
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([]);
  const [charSearch, setCharSearch] = useState("");
  const [lbSearch, setLbSearch] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [agentAddPreview, setAgentAddPreview] = useState<AgentAddPreview | null>(null);
  const [agentSetupQueue, setAgentSetupQueue] = useState<string[]>([]);
  const [agentAddCadenceInputFocused, setAgentAddCadenceInputFocused] = useState(false);
  const [addingAgentToChat, setAddingAgentToChat] = useState(false);
  const [isRegeneratingSchedules, setIsRegeneratingSchedules] = useState(false);
  // Synchronous lock to close the re-entry gap: React state commits are async, so two
  // fast clicks can both pass the `isRegeneratingSchedules` check before the state updates.
  const isRegeneratingSchedulesRef = useRef(false);
  type ScheduleGenerationResult = { status: string; schedule?: Record<string, unknown> };
  type ScheduleGenerationResponse = {
    results?: Record<string, ScheduleGenerationResult>;
    schedules?: Record<string, unknown>;
  };
  const generateConversationSchedules = useCallback(
    async (forceRefresh = false) => {
      if (isRegeneratingSchedulesRef.current) return;
      isRegeneratingSchedulesRef.current = true;
      setIsRegeneratingSchedules(true);
      try {
        const scheduleGenerationPreferences = useUIStore.getState().scheduleGenerationPreferences;
        const conversationTimeZone = useUIStore.getState().conversationTimeZone;
        const result = await api.post<ScheduleGenerationResponse>("/conversation/schedule/generate", {
          chatId: chat.id,
          characterIds: chatCharIds,
          forceRefresh,
          scheduleGenerationPreferences,
          timeZone: conversationTimeZone,
        });
        await qc.refetchQueries({ queryKey: chatKeys.detail(chat.id) });
        await qc.invalidateQueries({ queryKey: chatKeys.list() });
        await qc.invalidateQueries({ queryKey: ["conversation-status", chat.id] });

        const statuses = Object.values(result.results ?? {}).map((entry) => entry.status);
        const generatedCount = statuses.filter((status) => status === "generated").length;
        const sharedCount = statuses.filter((status) => status === "shared").length;
        const freshCount = statuses.filter((status) => status === "fresh").length;
        const skippedCount = statuses.filter((status) => status === "skipped_assistant").length;
        const errorMessages = statuses
          .filter((status) => status.startsWith("error:"))
          .map((status) => status.slice("error:".length).trim())
          .filter(Boolean);

        if (errorMessages.length > 0) {
          const prefix = errorMessages[0]?.startsWith("Refused to fetch")
            ? "Connection failed"
            : "Schedule generation failed";
          const summary = `${prefix}: ${errorMessages[0]}`;
          if (generatedCount + sharedCount + freshCount > 0) {
            toast.error(
              localizeUi("ui.chat.chatsettingsdrawer.value1Value2GeneratedValue3ReusedValue4AlreadyFresh", {
                value1: summary,
                value2: generatedCount,
                value3: sharedCount,
                value4: freshCount,
              }),
            );
          } else {
            toast.error(summary);
          }
          return;
        }

        if (generatedCount > 0 || sharedCount > 0) {
          const parts: string[] = [];
          if (generatedCount > 0) parts.push(`${generatedCount} generated`);
          if (sharedCount > 0) parts.push(`${sharedCount} reused`);
          if (freshCount > 0) parts.push(`${freshCount} already fresh`);
          if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
          toast.success(localizeUi("ui.chat.chatsettingsdrawer.schedulesReadyValue1", { value1: parts.join(", ") }));
          return;
        }

        if (freshCount > 0) {
          toast.info(
            localizeUi("ui.chat.chatsettingsdrawer.schedulesAreAlreadyUpToDateValue1", {
              value1:
                freshCount > 1
                  ? localizeUi("ui.chat.chatsettingsdrawer.forValue1Characters", { value1: freshCount })
                  : "",
            }),
          );
          return;
        }

        if (skippedCount > 0) {
          toast.info(localizeUi("ui.chat.chatsettingsdrawer.noSchedulesWereNeededForTheSelectedCharacters"));
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToGenerateSchedules"),
        );
      } finally {
        isRegeneratingSchedulesRef.current = false;
        setIsRegeneratingSchedules(false);
      }
    },
    [chat.id, chatCharIds, qc, localizeUi],
  );
  const [scenePromptExpanded, setScenePromptExpanded] = useState(false);
  const [scenePromptDraft, setScenePromptDraft] = useState(metadata.sceneSystemPrompt ?? "");
  const [groupScenarioDraft, setGroupScenarioDraft] = useState((metadata.groupScenarioText as string) ?? "");
  const gameAgentPool = useMemo(
    () =>
      availableAgents.filter(
        (agent) =>
          agent.builtIn &&
          agent.id !== "spotify" &&
          agent.id !== "youtube" &&
          agent.id !== "lorebook-keeper" &&
          agent.category !== "custom",
      ),
    [availableAgents],
  );
  const [gameSpecialInstructionsDraft, setGameSpecialInstructionsDraft] = useState(
    (metadata.gameSpecialInstructions as string) ?? "",
  );
  const [gameImagePromptInstructionsDraft, setGameImagePromptInstructionsDraft] = useState(
    (metadata.gameImagePromptInstructions as string) ?? "",
  );
  const gameSetupConfig =
    metadata.gameSetupConfig && typeof metadata.gameSetupConfig === "object"
      ? (metadata.gameSetupConfig as Record<string, unknown>)
      : {};
  const campaignArtStyle = typeof gameSetupConfig.artStylePrompt === "string" ? gameSetupConfig.artStylePrompt : "";
  const generatedCampaignArtStyle =
    typeof gameSetupConfig.generatedArtStylePrompt === "string" ? gameSetupConfig.generatedArtStylePrompt : "";
  const useCampaignArtStyle = gameSetupConfig.useCampaignArtStyle !== false;
  const [campaignArtStyleDraft, setCampaignArtStyleDraft] = useState(campaignArtStyle);
  const [spotifyArtistDraft, setSpotifyArtistDraft] = useState(spotifyArtist);
  const [gameSpotifyArtistDraft, setGameSpotifyArtistDraft] = useState(gameSpotifyArtist);

  // ── Chat settings profiles (legacy API/type names still use "chat preset") ──
  const presetMode = chatMode;
  const { data: chatPresets } = useChatPresets(presetMode);
  const saveChatPreset = useSaveChatPresetSettings();
  const duplicateChatPreset = useDuplicateChatPreset();
  const renameChatPreset = useUpdateChatPreset();
  const deleteChatPreset = useDeleteChatPreset();
  const applyChatPreset = useApplyChatPreset();
  const importChatPreset = useImportChatPreset();
  const setActiveChatPreset = useSetActiveChatPreset();
  const presetList = useMemo(() => (chatPresets ?? []) as ChatPreset[], [chatPresets]);
  const appliedPresetId = (metadata.appliedChatPresetId as string | undefined) ?? null;
  const appliedChatPreset = useMemo(() => {
    if (!appliedPresetId) return null;
    return presetList.find((p) => p.id === appliedPresetId) ?? null;
  }, [presetList, appliedPresetId]);
  const selectedChatPreset = useMemo(() => {
    if (appliedChatPreset) return appliedChatPreset;
    return presetList.find((p) => p.isDefault) ?? null;
  }, [presetList, appliedChatPreset]);
  const chatPresetSelectValue =
    appliedChatPreset?.id ?? (presetList.length > 0 ? CHAT_PRESET_UNAPPLIED_SELECT_VALUE : "");
  const [renamingPreset, setRenamingPreset] = useState(false);
  const [renamePresetVal, setRenamePresetVal] = useState("");
  const presetFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setAgentAddPreview(null);
      setAddingAgentToChat(false);
    }
  }, [open]);

  useEffect(() => {
    setGameImagePromptInstructionsDraft((metadata.gameImagePromptInstructions as string) ?? "");
  }, [chat.id, metadata.gameImagePromptInstructions]);

  useEffect(() => {
    setCampaignArtStyleDraft(campaignArtStyle);
  }, [campaignArtStyle, chat.id]);

  const commitCampaignArtStyle = () => {
    const nextArtStyle = campaignArtStyleDraft.trim();
    if (nextArtStyle === campaignArtStyle) return;
    updateMeta.mutate({
      id: chat.id,
      gameSetupConfig: {
        ...gameSetupConfig,
        artStylePrompt: nextArtStyle,
        generatedArtStylePrompt: generatedCampaignArtStyle || campaignArtStyle,
      },
    });
  };

  const commitGameImagePromptInstructions = () => {
    const stored = (metadata.gameImagePromptInstructions as string) ?? "";
    if (gameImagePromptInstructionsDraft === stored) return;
    updateMeta.mutate({
      id: chat.id,
      gameImagePromptInstructions: gameImagePromptInstructionsDraft.trim() || null,
    });
  };

  useEffect(() => {
    modePromptDefaultAppliedRef.current = null;
  }, [chat.id]);

  useEffect(() => {
    if (!open || !shouldApplyModePromptDefault || chat.promptPresetId || !fallbackPromptPreset?.id) return;
    const fallbackKey = `${chat.id}:${fallbackPromptPreset.id}`;
    if (modePromptDefaultAppliedRef.current === fallbackKey) return;
    modePromptDefaultAppliedRef.current = fallbackKey;
    updateChat.mutate({ id: chat.id, promptPresetId: fallbackPromptPreset.id });
  }, [chat.id, chat.promptPresetId, fallbackPromptPreset?.id, open, shouldApplyModePromptDefault, updateChat]);

  useEffect(() => {
    setGameSpecialInstructionsDraft((metadata.gameSpecialInstructions as string) ?? "");
  }, [chat.id, metadata.gameSpecialInstructions]);

  useEffect(() => {
    setGameSpotifyArtistDraft(gameSpotifyArtist);
  }, [chat.id, gameSpotifyArtist]);

  useEffect(() => {
    setSpotifyArtistDraft(spotifyArtist);
  }, [chat.id, spotifyArtist]);

  const handleModePromptPresetChange = useCallback(
    (promptPresetId: string | null) => {
      if (!promptPresetId && fallbackPromptPreset?.id) {
        modePromptDefaultAppliedRef.current = `${chat.id}:${fallbackPromptPreset.id}`;
      }
      setPreset(promptPresetId);
      if (isConversation) {
        updateMeta.mutate({ id: chat.id, customSystemPrompt: null });
      }
      if (isGame) {
        updateMeta.mutate({ id: chat.id, gameSystemPrompt: null });
      }
    },
    [chat.id, fallbackPromptPreset?.id, isConversation, isGame, setPreset, updateMeta],
  );

  const openAgentAddModal = useCallback(
    (agent: AvailableAgent) => {
      setAgentAddCadenceInputFocused(false);
      const config = agentConfigsByType.get(agent.id) ?? null;
      const mergedSettings = mergeBuiltInAgentSettings(agent.id, config?.settings);
      const intervalMeta = getAgentRunIntervalMeta(agent.id, agent.builtIn);
      setAgentAddPreview({
        agent,
        config,
        contextSize: normalizePositiveInteger(mergedSettings.contextSize, DEFAULT_AGENT_CONTEXT_SIZE, 200),
        maxTokens: normalizeAgentMaxTokens(mergedSettings.maxTokens),
        runInterval: intervalMeta
          ? normalizePositiveInteger(mergedSettings.runInterval, intervalMeta.defaultValue, intervalMeta.max)
          : null,
        setup: buildInitialAgentAddSetupState({
          agentId: agent.id,
          settings: mergedSettings,
          metadata,
          musicPlayerSource,
          roleplaySpriteScale,
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
        }),
      });
    },
    [agentConfigsByType, metadata, musicPlayerSource, roleplaySpriteScale, supportsNarrativeDirectorSecretPlot],
  );

  useEffect(() => {
    setAgentAddPreview(null);
    setAgentSetupQueue([]);
  }, [chat.id]);

  // A mobile dock drop closed the library panel and handed the restore to this drawer, so the user
  // only goes back to the library once the agent setup modal is done with.
  useEffect(() => {
    if (!open) return;
    return () => {
      const panel = takePendingChatResourcePanelRestore();
      if (panel && !useUIStore.getState().rightPanelOpen) useUIStore.getState().openRightPanel(panel);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const consumeRequest = () => {
      const ids = takePendingChatAgentSetupIds(chat.id);
      if (ids.length > 0) {
        // Dropped agents are already active by this point, so only dedupe against the setup queue.
        setAgentSetupQueue((current) => Array.from(new Set([...current, ...ids])));
      }
    };
    consumeRequest();
    window.addEventListener(CHAT_RESOURCE_AGENT_SETUP_EVENT, consumeRequest);
    return () => window.removeEventListener(CHAT_RESOURCE_AGENT_SETUP_EVENT, consumeRequest);
  }, [chat.id, open]);

  useEffect(() => {
    if (!open || agentAddPreview || agentSetupQueue.length === 0) return;
    const agent = availableAgents.find((entry) => entry.id === agentSetupQueue[0]);
    if (!agent) {
      setAgentSetupQueue((current) => current.slice(1));
      toast.error(localizeUi("ui.chat.chatresourcedropoverlay.agentUnavailable"));
      return;
    }
    openAgentAddModal(agent);
  }, [agentAddPreview, agentSetupQueue, availableAgents, open, openAgentAddModal, localizeUi]);

  const confirmAddAgent = async () => {
    if (!agentAddPreview) return;

    const { agent, config, contextSize, maxTokens, runInterval, setup } = agentAddPreview;
    const normalizedMaxTokens = normalizeAgentMaxTokens(maxTokens);
    const builtInMeta = installedAgentManifests.find((entry) => entry.id === agent.id) ?? null;
    let nextSettings: Record<string, unknown> = {
      ...mergeBuiltInAgentSettings(agent.id, config?.settings),
      contextSize,
      maxTokens: normalizedMaxTokens,
    };
    const intervalMeta = getAgentRunIntervalMeta(agent.id, !!builtInMeta);
    if (intervalMeta && runInterval != null) {
      nextSettings.runInterval = runInterval;
    }
    nextSettings = applyAgentAddSetupToAgentSettings(agent.id, setup, nextSettings, {
      allowSecretPlot: supportsNarrativeDirectorSecretPlot,
    });
    const nextEnabledTools = nextSettings.enabledTools;
    if (
      builtInMeta &&
      (!Array.isArray(nextEnabledTools) ||
        (agent.id === "spotify" && nextSettings.musicProvider === "spotify" && nextEnabledTools.length === 0))
    ) {
      nextSettings.enabledTools = DEFAULT_AGENT_TOOLS[agent.id] ?? [];
    }

    setAddingAgentToChat(true);
    try {
      if (builtInMeta?.execution === "feature") {
        // Feature packages own their settings and runtime; chat activation is enough.
      } else if (config) {
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
      } else if (builtInMeta) {
        await createAgent.mutateAsync({
          type: builtInMeta.id,
          name: agent.name,
          description: agent.description,
          phase: normalizeAgentPhaseForType(agent.id, agent.phase),
          connectionId: null,
          promptTemplate: "",
          settings: nextSettings,
        });
      }

      await updateMeta.mutateAsync({
        id: chat.id,
        enableAgents: true,
        activeAgentIds: Array.from(new Set([...readLatestActiveAgentIds(), agent.id])),
        ...buildAgentAddMetadataPatch(agent.id, setup, metadata, {
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
          defaultPromptTemplateId: resolveDefaultAgentPromptTemplateId(nextSettings),
          illustratorDefaults: {
            includeCharacterAppearance: nextSettings.includeCharacterAppearance === true,
            useAvatarReferences: nextSettings.useAvatarReferences === true,
          },
        }),
      });
      toast.success(
        localizeUi("ui.chat.chatsettingsdrawer.addedValue1YouCanAccessItsSettingsInAgents", { value1: agent.name }),
      );
      setAgentAddPreview(null);
      setAgentSetupQueue((current) => (current[0] === agent.id ? current.slice(1) : current));
    } catch (error) {
      await showAlertDialog({
        title: "Couldn’t Add Agent",
        message: error instanceof Error ? error.message : "Failed to add the agent to this chat.",
      });
    } finally {
      setAddingAgentToChat(false);
    }
  };

  const ensureMusicDjAgent = useCallback(
    async (provider: MusicProvider) => {
      const builtInMeta = installedAgentManifests.find((entry) => entry.id === "spotify");
      if (!builtInMeta) throw new Error("Music DJ agent metadata is missing.");
      const config = agentConfigsByType.get("spotify") ?? null;
      const nextSettings: Record<string, unknown> = {
        ...mergeBuiltInAgentSettings("spotify", config?.settings),
        musicProvider: provider,
        musicPlayerSource: provider,
        customMusicSource,
        customMusicFolder,
        customMusicExternalFolder,
        enabledTools: provider === "spotify" ? (DEFAULT_AGENT_TOOLS.spotify ?? []) : [],
      };

      if (config) {
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
        return;
      }

      await createAgent.mutateAsync({
        type: builtInMeta.id,
        name: builtInMeta.name,
        description: builtInMeta.description,
        phase: normalizeAgentPhaseForType(builtInMeta.id, builtInMeta.phase),
        connectionId: null,
        promptTemplate: "",
        settings: nextSettings,
      });
    },
    [
      agentConfigsByType,
      createAgent,
      customMusicExternalFolder,
      customMusicFolder,
      customMusicSource,
      installedAgentManifests,
      updateAgentConfig,
    ],
  );

  const changeMusicDjProvider = useCallback(
    async (provider: MusicProvider) => {
      setMusicPlayerSource(provider);
      const musicDjActive = gameMusicDjEnabled || activeAgentIds.includes("spotify");
      if (!musicDjActive) return;
      try {
        await ensureMusicDjAgent(provider);
        if (isGame && gameMusicDjEnabled) {
          updateMeta.mutate({
            id: chat.id,
            gameUseSpotifyMusic: provider === "spotify",
          });
        }
      } catch (error) {
        await showAlertDialog({
          title: "Couldn't Update Music DJ",
          message: error instanceof Error ? error.message : "Music DJ provider could not be updated.",
        });
      }
    },
    [activeAgentIds, chat.id, ensureMusicDjAgent, gameMusicDjEnabled, isGame, setMusicPlayerSource, updateMeta],
  );

  const saveCustomMusicFolder = useCallback(
    async (value: string) => {
      const folder = normalizeCustomMusicFolder(value);
      updateMeta.mutate({ id: chat.id, customMusicFolder: folder });
      const config = agentConfigsByType.get("spotify") ?? null;
      if (!config) return;
      const nextSettings = {
        ...mergeBuiltInAgentSettings("spotify", config.settings),
        customMusicFolder: folder,
      };
      await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
    },
    [agentConfigsByType, chat.id, updateAgentConfig, updateMeta],
  );

  const updateCustomMusicLibrary = useCallback(
    async (patch: { customMusicSource?: CustomMusicSource; customMusicExternalFolder?: string }) => {
      try {
        const config = agentConfigsByType.get("spotify") ?? null;
        if (!config) throw new Error("Music DJ agent settings are missing.");
        const nextSettings = {
          ...mergeBuiltInAgentSettings("spotify", config.settings),
          ...patch,
        };
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
      } catch (error) {
        await showAlertDialog({
          title: "Couldn't Update Music Folder",
          message: error instanceof Error ? error.message : "The custom music folder could not be updated.",
        });
      }
    },
    [agentConfigsByType, updateAgentConfig],
  );

  const selectCustomMusicExternalFolder = useCallback(async () => {
    try {
      const data = await api.post<{ success: boolean; path: string }>("/game-assets/pick-local-music-folder");
      if (data.success !== true || !data.path) throw new Error("No folder selected.");
      await updateCustomMusicLibrary({
        customMusicSource: "folder",
        customMusicExternalFolder: data.path,
      });
    } catch (error) {
      await showAlertDialog({
        title: "Couldn't Select Music Folder",
        message: error instanceof Error ? error.message : "The music folder could not be selected.",
      });
    }
  }, [updateCustomMusicLibrary]);

  const renderCustomMusicLibrarySettings = (surface: "game" | "roleplay") => (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.customMusicSource")}
        </span>
        <select
          value={customMusicSource}
          onChange={(event) =>
            void updateCustomMusicLibrary({ customMusicSource: event.target.value as CustomMusicSource })
          }
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
        >
          <option value="game-assets">{localizeUi("game.toolbar.assets")}</option>
          <option value="folder">{localizeUi("ui.chat.musicdjsetupfields.folderOnThisDevice")}</option>
        </select>
      </label>

      {customMusicSource === "folder" ? (
        <div className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.musicFolderOnThisDevice")}
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              key={`${chat.id}-${surface}-custom-music-folder-${customMusicExternalFolder}`}
              defaultValue={customMusicExternalFolder}
              onBlur={(event) =>
                void updateCustomMusicLibrary({
                  customMusicSource: "folder",
                  customMusicExternalFolder: normalizeCustomMusicExternalFolder(event.target.value),
                })
              }
              placeholder={localizeUi("ui.agents.agenteditor.noFolderSelected")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
            />
            <button
              type="button"
              onClick={() => void selectCustomMusicExternalFolder()}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <FolderOpen size="0.75rem" />
              {localizeUi("ui.chat.musicdjsetupfields.chooseFolder")}
            </button>
          </div>
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.musicDjWillChooseFromAudioFilesInThis")}
          </span>
        </div>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.gameAssetsMusicFolder")}
          </span>
          <input
            key={`${chat.id}-${surface}-custom-music-${customMusicFolder}`}
            defaultValue={customMusicFolder}
            onBlur={(event) => void saveCustomMusicFolder(event.target.value)}
            placeholder={localizeUi("ui.agents.agenteditor.music")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.readsLocalAudioFromGameAssetsForExample")} <code>music</code>{" "}
            {localizeUi("ui.noodle.noodlehome.or")} <code>music/combat</code>.
          </span>
        </label>
      )}
    </div>
  );

  const toggleGameMusicDj = useCallback(async () => {
    const latestActiveAgentIds = readLatestActiveAgentIds();
    if (gameMusicDjEnabled) {
      await updateMeta.mutateAsync({
        id: chat.id,
        gameUseMusicDj: false,
        gameUseSpotifyMusic: false,
        activeAgentIds: latestActiveAgentIds.filter((id) => id !== "spotify" && id !== "youtube"),
      });
      return;
    }

    try {
      await ensureMusicDjAgent(musicPlayerSource);
      await updateMeta.mutateAsync({
        id: chat.id,
        enableAgents: true,
        gameUseMusicDj: true,
        gameUseSpotifyMusic: musicPlayerSource === "spotify",
        gameSpotifySourceType,
        activeAgentIds: Array.from(new Set([...latestActiveAgentIds.filter((id) => id !== "youtube"), "spotify"])),
      });
    } catch (error) {
      await showAlertDialog({
        title: "Couldn't Enable Music DJ",
        message:
          error instanceof Error
            ? error.message
            : "Music DJ could not be enabled for this game. Check the setup and try again.",
      });
    }
  }, [
    chat.id,
    ensureMusicDjAgent,
    gameMusicDjEnabled,
    gameSpotifySourceType,
    musicPlayerSource,
    readLatestActiveAgentIds,
    updateMeta,
  ]);

  const saveGameWidgets = useCallback(async () => {
    const widgets = normalizeGameHudWidgets(gameWidgetDrafts);
    try {
      await updateGameWidgets.mutateAsync({ chatId: chat.id, widgets });
      toast.success(localizeUi("ui.chat.chatsettingsdrawer.gameWidgetsUpdated"));
    } catch {
      toast.error(localizeUi("ui.chat.chatsettingsdrawer.failedToUpdateGameWidgets"));
    }
  }, [chat.id, gameWidgetDrafts, updateGameWidgets, localizeUi]);

  const toggleGameLorebookKeeper = useCallback(() => {
    const latestActiveAgentIds = readLatestActiveAgentIds();
    const nextActiveAgentIds = latestActiveAgentIds.filter((id) => id !== "lorebook-keeper");
    if (gameLorebookKeeperEnabled) {
      const keeperLorebookIds = new Set(
        ((lorebooks ?? []) as Lorebook[])
          .filter((lorebook) => lorebook.sourceAgentId === "game-lorebook-keeper")
          .map((lorebook) => lorebook.id),
      );
      if (gameLorebookKeeperLorebookId) keeperLorebookIds.add(gameLorebookKeeperLorebookId);
      updateMeta.mutate({
        id: chat.id,
        gameLorebookKeeperEnabled: false,
        activeAgentIds: nextActiveAgentIds,
        activeLorebookIds: activeLorebookIds.filter((id) => !keeperLorebookIds.has(id)),
      });
      return;
    }

    updateMeta.mutate({
      id: chat.id,
      gameLorebookKeeperEnabled: true,
      activeAgentIds: nextActiveAgentIds,
    });
  }, [
    activeLorebookIds,
    chat.id,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    lorebooks,
    readLatestActiveAgentIds,
    updateMeta,
  ]);

  const agentAddIntervalMeta = agentAddPreview
    ? getAgentRunIntervalMeta(agentAddPreview.agent.id, agentAddPreview.agent.builtIn)
    : null;
  const agentAddIsRuntimeDisabled = agentAddPreview?.agent.runtimeDisabled === true;
  const agentAddIsFeature = agentAddPreview?.agent.execution === "feature";

  const snapshotCurrentPresetSettings = useCallback((): ChatPresetSettings => {
    return {
      connectionId: chat.connectionId ?? null,
      promptPresetId: chat.promptPresetId ?? null,
      metadata: { ...metadata },
    };
  }, [chat.connectionId, chat.promptPresetId, metadata]);

  const handleSelectPreset = (id: string) => {
    if (!id || id === CHAT_PRESET_UNAPPLIED_SELECT_VALUE || id === appliedChatPreset?.id) return;
    applyChatPreset.mutate({ presetId: id, chatId: chat.id });
  };

  const handleToggleDefaultPreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isActive) return;
    setActiveChatPreset.mutate(selectedChatPreset.id);
  };

  const handleSaveIntoPreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    saveChatPreset.mutate({ id: selectedChatPreset.id, settings: snapshotCurrentPresetSettings() });
  };

  const handleStartRenamePreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    setRenamePresetVal(selectedChatPreset.name);
    setRenamingPreset(true);
  };

  const handleCommitRenamePreset = () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) {
      setRenamingPreset(false);
      return;
    }
    const next = renamePresetVal.trim();
    if (next && next !== selectedChatPreset.name) {
      renameChatPreset.mutate({ id: selectedChatPreset.id, name: next });
    }
    setRenamingPreset(false);
  };

  const handleSaveAsPreset = async () => {
    if (!selectedChatPreset) return;
    const baseName = await showPromptDialog({
      title: localizeUi("chat.settingsProfile.dialog.createTitle"),
      message: localizeUi("chat.settingsProfile.dialog.newName"),
      defaultValue: `${selectedChatPreset.name} Copy`,
      confirmLabel: localizeUi("ui.modals.createcharactermodal.create"),
    });
    if (!baseName?.trim()) return;
    const trimmed = baseName.trim().slice(0, 120);
    duplicateChatPreset.mutate(
      { id: selectedChatPreset.id, name: trimmed },
      {
        onSuccess: (created) => {
          if (!created) return;
          // Save the current chat settings into the new profile, then apply it
          // (which records appliedChatPresetId on the chat so the dropdown follows).
          saveChatPreset.mutate(
            { id: created.id, settings: snapshotCurrentPresetSettings() },
            {
              onSuccess: () => applyChatPreset.mutate({ presetId: created.id, chatId: chat.id }),
            },
          );
        },
      },
    );
  };

  const handleDeletePreset = async () => {
    if (!selectedChatPreset || selectedChatPreset.isDefault) return;
    const ok = await showConfirmDialog({
      title: localizeUi("chat.settingsProfile.action.delete"),
      message: localizeUi("dialog.delete.namedPermanent", {
        name: selectedChatPreset.name,
      }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!ok) return;
    const wasApplied = selectedChatPreset.id === appliedPresetId;
    const defaultPreset = presetList.find((p) => p.isDefault);
    deleteChatPreset.mutate(selectedChatPreset.id, {
      onSuccess: () => {
        // If the chat was using the profile we just deleted, fall back to the
        // Default profile's settings: without this, the chat would visually
        // show "Default" but keep the deleted profile's actual values.
        if (wasApplied && defaultPreset) {
          applyChatPreset.mutate({ presetId: defaultPreset.id, chatId: chat.id });
        }
      },
    });
  };

  const handleExportPreset = () => {
    if (!selectedChatPreset) return;
    api.download(
      `/chat-presets/${selectedChatPreset.id}/export`,
      `${selectedChatPreset.name}.marinara-settings-profile.json`,
    );
  };

  const handleImportClick = () => {
    presetFileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const created = await importChatPreset.mutateAsync(envelope);
      if (created?.id && created.mode === chat.mode) {
        applyChatPreset.mutate({ presetId: created.id, chatId: chat.id });
      }
    } catch (err) {
      await showAlertDialog({
        title: localizeUi("chat.settingsProfile.import.failedTitle"),
        message: localizeUi("chat.settingsProfile.import.failedWithReason", {
          reason: err instanceof Error ? err.message : localizeUi("chat.settingsProfile.import.invalidFile"),
        }),
        tone: "destructive",
      });
    }
  };

  const saveName = () => {
    if (nameVal.trim() && nameVal !== chat.name) {
      updateChat.mutate({ id: chat.id, name: nameVal.trim() });
    }
    setEditingName(false);
  };

  const renderMemoryRecallControls = (defaultOn: boolean) => {
    const effectiveValue = metadata.enableMemoryRecall !== undefined ? metadata.enableMemoryRecall === true : defaultOn;
    return (
      <div className="space-y-2">
        <SettingsSwitch
          label={localizeUi("ui.chat.chatsettingsdrawer.enableMemoryRecall")}
          description={localizeUi("ui.chat.chatsettingsdrawer.recallRelevantFragmentsFromEarlierInThisChatAnd")}
          checked={effectiveValue}
          onChange={(enableMemoryRecall) => updateMeta.mutate({ id: chat.id, enableMemoryRecall })}
          labelPosition="start"
          className={cn(
            "justify-between rounded-md px-3 py-2.5 text-left",
            effectiveValue
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-[0.6875rem] font-medium"
        />
        <button
          type="button"
          onClick={() => setShowMemoriesModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
        >
          <Brain size="0.75rem" />
          {localizeUi("ui.chat.chatsettingsdrawer.accessMemoriesForThisChat")}
        </button>
      </div>
    );
  };

  const renderCustomAgentPicker = ({ showWhenEmpty = false }: { showWhenEmpty?: boolean } = {}) => {
    if (customAgents.length === 0 && !showWhenEmpty) return null;
    return (
      <AgentCategorySection
        label={localizeUi("ui.panels.agentspanel.customAgents")}
        icon={<Settings2 size="0.75rem" />}
        description={localizeUi("ui.chat.chatsettingsdrawer.addYourCustomCreatedAgentsToThisChat")}
        count={activeCustomAgents.length}
      >
        {inactiveCustomAgents.length > 0 ? (
          <div className="flex flex-col gap-1">
            {inactiveCustomAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => openAgentAddModal(agent)}
                className="flex items-center gap-2.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{agent.name}</span>
                  <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                    {agent.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : customAgents.length === 0 ? (
          <div className="space-y-2 px-1">
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.noCustomAgentsAreAvailableYetCreateOneIn")}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                const ui = useUIStore.getState();
                ui.openRightPanel("agents");
                ui.openAgentDetail("__new__");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <Plus size="0.75rem" />
              {localizeUi("ui.chat.chatsettingsdrawer.createCustomAgent")}
            </button>
          </div>
        ) : (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {isGame && !metadata.enableAgents
              ? localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreAlreadyAttachedEnableAgentsTo")
              : localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreActiveConfigureThemBelowThe")}
          </p>
        )}
      </AgentCategorySection>
    );
  };

  const renderActiveCustomAgentSettingsCard = () => {
    if (!metadata.enableAgents || activeCustomAgents.length === 0) return null;
    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "custom-agents")}
        icon={renderRoleplayAgentMenuIcon("custom-agents")}
        title={localizeUi("ui.panels.agentspanel.customAgents")}
        description={localizeUi("ui.chat.chatsettingsdrawer.configureCustomAgentsCurrentlyAttachedToThisChat")}
        order={customAgentSettingsOrder}
      >
        <div className="space-y-1.5">
          {activeCustomAgents.map((agent) => {
            const agentConfig = agentConfigsByType.get(agent.id);
            const agentSettings = parseAgentSettingsRecord(agentConfig?.settings);
            const backfillAvailable = customAgentCanBackfillLorebooks(agent, agentSettings);
            const backfillEnabled = backfillAvailable && agentSettings.lorebookBackfillEnabled === true;
            const backfillChunkSize = customLorebookBackfillChunkSize(agentSettings);
            const tokenEst = agentLoadCost.tokensByType.get(agent.id);
            const promptOptions = getPromptOptionsForAgent(agent.id);
            const imageCapable = isImageCapableCustomAgent(agent.id);
            const agentImageConnectionId = customAgentImageSelections[agent.id]?.imageConnectionId ?? "";
            const agentImageStyleProfileId = customAgentImageSelections[agent.id]?.styleProfileId ?? "";
            const agentImageConnectionMissing =
              agentImageConnectionId.length > 0 &&
              !imageConnectionsList.some((connection) => connection.id === agentImageConnectionId);
            const agentImageStyleProfileMissing =
              agentImageStyleProfileId.length > 0 &&
              !imageStyleProfiles.profiles.some((profile) => profile.id === agentImageStyleProfileId);
            return (
              <div
                key={agent.id}
                className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]"
              >
                <div className="flex items-start gap-2.5">
                  <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="block min-w-0 truncate text-xs font-medium">{agent.name}</span>
                      {tokenEst != null ? (
                        <span
                          className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                          title={localizeUi("ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated", {
                            value1: tokenEst.toLocaleString(),
                          })}
                        >
                          ~{tokenEst.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                      {agent.description}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      void handleRerunCustomAgent(agent.id);
                    }}
                    disabled={agentProcessing}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                      agentProcessing
                        ? "cursor-not-allowed opacity-40"
                        : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                    )}
                    title={localizeUi("ui.chat.chatsettingsdrawer.reRunValue1OnTheLastMessage", { value1: agent.name })}
                  >
                    <RefreshCw size="0.6875rem" className={cn(agentProcessing && "animate-spin")} />
                  </button>
                  {imageCapable && (
                    <button
                      onClick={() => {
                        void handleSnapshotCustomAgent(agent.id);
                      }}
                      disabled={agentProcessing}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                        agentProcessing
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                      )}
                      title={localizeUi("ui.chat.chatsettingsdrawer.generateAnImageWithValue1Now", {
                        value1: agent.name,
                      })}
                    >
                      <Camera size="0.6875rem" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      void toggleAgent(agent.id);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
                <AgentPromptTemplateSelect
                  options={promptOptions}
                  selectedId={agentPromptTemplateSelections[agent.id] ?? getDefaultPromptTemplateIdForAgent(agent.id)}
                  overridden={typeof agentPromptTemplateSelections[agent.id] === "string"}
                  onChange={(promptTemplateId) => updateAgentPromptTemplateSelection(agent.id, promptTemplateId)}
                />
                {backfillAvailable && agentConfig && (
                  <div className="mt-2 space-y-2">
                    <AgentSettingsToggle
                      label={localizeUi("ui.agents.agenteditor.enableChunkedBackfill")}
                      description={localizeUi("ui.agents.agenteditor.enableChunkedBackfillDescription")}
                      enabled={backfillEnabled}
                      onToggle={() =>
                        void updateCustomAgentBackfillSettings(agent.id, {
                          lorebookBackfillEnabled: !backfillEnabled,
                          lorebookBackfillChunkSize: backfillChunkSize,
                        })
                      }
                    />
                    {backfillEnabled && (
                      <div className="flex flex-col gap-2 rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)] sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          <span className="mb-1 block font-medium text-[var(--foreground)]">
                            {localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                          </span>
                          <DraftNumberInput
                            value={backfillChunkSize}
                            min={1}
                            max={MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE}
                            disabled={updateAgentConfig.isPending}
                            onCommit={(lorebookBackfillChunkSize) =>
                              void updateCustomAgentBackfillSettings(agent.id, { lorebookBackfillChunkSize })
                            }
                            ariaLabel={localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleBackfillCustomAgent(agent.id)}
                          disabled={agentProcessing}
                          className={cn(
                            "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                            agentProcessing
                              ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)]"
                              : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15",
                          )}
                        >
                          <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
                          {localizeUi("ui.chat.customAgentBackfill.nextChunk")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {imageCapable && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                    </span>
                    <select
                      aria-label={localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                      value={agentImageConnectionId}
                      onChange={(event) => updateCustomAgentImageConnection(agent.id, event.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    >
                      <option value="">{localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}</option>
                      {agentImageConnectionMissing && (
                        <option value={agentImageConnectionId}>
                          {localizeUi("ui.chat.chatsettingsdrawer.missingConnection")}
                        </option>
                      )}
                      {imageConnectionsList.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.name}
                          {connection.model ? localizeUi("ui.chat.datablock.value1", { value1: connection.model }) : ""}
                        </option>
                      ))}
                    </select>
                    <AgentDefaultStatus
                      overridden={agentImageConnectionId.length > 0}
                      onReset={() => updateCustomAgentImageConnection(agent.id, "")}
                    />
                    <span className="mt-1 text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                    </span>
                    <select
                      aria-label={localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                      value={agentImageStyleProfileId}
                      onChange={(event) => updateCustomAgentImageStyle(agent.id, event.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    >
                      <option value="">{localizeUi("ui.chat.chatsettingsdrawer.chatDefault")}</option>
                      {agentImageStyleProfileMissing && (
                        <option value={agentImageStyleProfileId}>
                          {localizeUi("ui.chat.chatsettingsdrawer.missingStyleProfile")}
                        </option>
                      )}
                      {imageStyleProfiles.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <AgentDefaultStatus
                      overridden={agentImageStyleProfileId.length > 0 && !agentImageStyleProfileMissing}
                      onReset={() => updateCustomAgentImageStyle(agent.id, "")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AgentSettingsCard>
    );
  };

  const renderHapticSettingsCard = () => {
    if (!metadata.enableAgents || !hapticActive) return null;

    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "haptic")}
        icon={renderRoleplayAgentMenuIcon("haptic")}
        title={hapticAgentMeta.name}
        description={hapticAgentMeta.description}
        order={getRoleplayAgentSettingsOrder("haptic")}
        onRemove={getRoleplayAgentMenuRemoveHandler("haptic", hapticAgentMeta.name)}
      >
        <AgentSettingsToggle
          label={localizeUi("ui.chat.hapticsetupfields.hapticFeedback")}
          description={
            metadata.enableHapticFeedback
              ? localizeUi("ui.chat.hapticsetupfields.touchCuesAreEnabledForThisChat")
              : localizeUi("ui.chat.hapticsetupfields.allowThisAgentToSendTouchCuesDuringThe")
          }
          enabled={metadata.enableHapticFeedback}
          onToggle={() => updateMeta.mutate({ id: chat.id, enableHapticFeedback: !metadata.enableHapticFeedback })}
        />
        {metadata.enableHapticFeedback && (
          <>
            <div className="space-y-2 rounded-lg bg-[var(--background)]/75 p-2.5 ring-1 ring-[var(--border)]">
              <div className="space-y-1">
                <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.touchSensitivity")}
                </span>
                <AgentSettingsSegmentedControl<HapticFeedbackSensitivity>
                  value={hapticSensitivity}
                  columns={3}
                  options={HAPTIC_SENSITIVITY_OPTIONS.map((option) => ({
                    id: option.id,
                    label: localizeUi(option.labelKey),
                  }))}
                  onChange={(hapticSensitivity) => updateMeta.mutate({ id: chat.id, hapticSensitivity })}
                />
              </div>
              <AgentSettingsToggle
                label={localizeUi("ui.chat.chatsettingsdrawer.incidentalContact")}
                description={localizeUi("ui.chat.hapticsetupfields.tinyTapsForAccidentalBrushesAndBumps")}
                enabled={metadata.hapticIncidentalContact === true}
                onToggle={() =>
                  updateMeta.mutate({
                    id: chat.id,
                    hapticIncidentalContact: metadata.hapticIncidentalContact !== true,
                  })
                }
              />
            </div>
            <HapticConnectionPanel
              intifaceUrl={typeof metadata.hapticIntifaceUrl === "string" ? metadata.hapticIntifaceUrl : undefined}
              onIntifaceUrlChange={(hapticIntifaceUrl) => updateMeta.mutate({ id: chat.id, hapticIntifaceUrl })}
            />
          </>
        )}
      </AgentSettingsCard>
    );
  };

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (isDesktopShellNavigationTarget(target)) return;
      if (isChatToolbarPanelTrigger(target, "settings")) return;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-chat-floating-panel]")) return;
      // The expanded prompt editor and the macro reference render in a portal
      // outside the drawer panel; interacting with them must not close Chat
      // Settings — only their own close controls should.
      if (target instanceof Element && target.closest("[data-macro-modal]")) return;
      requestClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open, requestClose]);

  if (!open) return null;
  const anchoredOnMobile = !!anchor && typeof window !== "undefined" && window.innerWidth < 768;
  const panelStyle: CSSProperties | undefined = anchor
    ? anchoredOnMobile
      ? {
          bottom: "auto",
          left: "auto",
          maxHeight: `min(42rem, calc(100dvh - ${anchor.top}px - 0.75rem - env(safe-area-inset-bottom)))`,
          right: `${anchor.right}px`,
          top: `${anchor.top}px`,
          width: `min(34rem, calc(100vw - ${anchor.right}px - 0.75rem))`,
        }
      : {
          right: getChatFloatingPanelDesktopRight(anchor),
          top: `${anchor.top}px`,
        }
    : undefined;

  return (
    <>
      {/* Floating panel */}
      <div
        ref={panelRef}
        data-chat-floating-panel
        className={cn(
          NEUTRAL_PANEL_SHELL,
          "mari-chat-settings-popover",
          "mari-chat-settings-drawer",
          "fixed bottom-3 z-[70] flex min-h-0 w-[min(34rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
        )}
        style={panelStyle}
      >
        {/* Header */}
        <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
          <h3 className={NEUTRAL_PANEL_TITLE}>
            <Settings2 size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            {localizeUi("chat.toolbar.settings")}
          </h3>
          <button
            type="button"
            onClick={requestClose}
            aria-label={localizeUi("ui.chat.chatsettingsdrawer.closeChatSettings")}
            className={NEUTRAL_PANEL_CLOSE_BUTTON}
          >
            <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
          </button>
        </div>

        {/* Desktop-only: drag-and-drop hint (sidebar drag is disabled on mobile overlays) */}
        <div className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] px-4 py-2 text-[0.6875rem] leading-snug text-[var(--muted-foreground)] max-md:hidden">
          <Info size="0.8125rem" className="mt-px shrink-0" />
          <span>{localizeUi("chat.settings.dragDropHint")}</span>
        </div>

        <div
          className={cn(
            NEUTRAL_PANEL_SCROLL_AREA,
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]",
          )}
        >
          {/* Settings profile bar — hidden in Game Mode. Scene chats keep it, but scene instructions stay chat-owned. */}
          {modeSettingsSurfaces.showSettingsProfiles && (
            <div
              style={{ order: CHAT_SETTINGS_ORDER.settingsPresets }}
              className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-4 py-3"
            >
              <input
                ref={presetFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportFile}
              />
              {/* Dropdown / rename input + help */}
              <div className="flex items-center gap-2">
                {renamingPreset ? (
                  <input
                    value={renamePresetVal}
                    onChange={(e) => setRenamePresetVal(e.target.value)}
                    onBlur={handleCommitRenamePreset}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitRenamePreset();
                      else if (e.key === "Escape") setRenamingPreset(false);
                    }}
                    autoFocus
                    maxLength={120}
                    className="flex-1 min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--primary)]/40"
                  />
                ) : (
                  <select
                    value={chatPresetSelectValue}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    aria-label={localizeUi("chat.settingsProfile.label")}
                    title={localizeUi("chat.settingsProfile.action.apply")}
                    className="mari-preset-native-select flex-1 min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  >
                    {presetList.length === 0 && (
                      <option value="">{localizeUi("ui.panels.ttsconfigcard.loading")}</option>
                    )}
                    {!appliedChatPreset && presetList.length > 0 && (
                      <option value={CHAT_PRESET_UNAPPLIED_SELECT_VALUE}>
                        {appliedPresetId
                          ? localizeUi("chat.settingsProfile.option.missing")
                          : localizeUi("chat.settingsProfile.option.custom")}
                      </option>
                    )}
                    {presetList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isDefault ? localizeUi("ui.noodle.noodlehome.default") : p.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleToggleDefaultPreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isActive || setActiveChatPreset.isPending}
                  title={
                    !selectedChatPreset
                      ? localizeUi("chat.settingsProfile.default.selectFirst")
                      : selectedChatPreset.isActive
                        ? localizeUi("chat.settingsProfile.default.current")
                        : localizeUi("chat.settingsProfile.default.markForMode")
                  }
                  aria-pressed={!!selectedChatPreset?.isActive}
                  aria-label={
                    selectedChatPreset?.isActive
                      ? localizeUi("chat.settingsProfile.default.label")
                      : localizeUi("chat.settingsProfile.action.markDefault")
                  }
                  className={cn(
                    "shrink-0 flex items-center justify-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed",
                    selectedChatPreset?.isActive
                      ? "text-yellow-400 disabled:opacity-100"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-yellow-400 disabled:opacity-40",
                  )}
                >
                  <Star
                    size="0.875rem"
                    fill={selectedChatPreset?.isActive ? "currentColor" : "none"}
                    strokeWidth={selectedChatPreset?.isActive ? 1.5 : 2}
                  />
                </button>
                <HelpTooltip
                  side="left"
                  text={
                    isRoleplayMode
                      ? localizeUi("chat.settingsProfile.description.roleplay")
                      : localizeUi("chat.settingsProfile.description.conversation")
                  }
                />
              </div>
              {/* Single row of all profile actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveIntoPreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={
                    selectedChatPreset?.isDefault
                      ? localizeUi("chat.settingsProfile.default.cannotSave")
                      : localizeUi("chat.settingsProfile.action.saveInto")
                  }
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save size="0.875rem" />
                </button>
                <button
                  onClick={handleStartRenamePreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={
                    selectedChatPreset?.isDefault
                      ? localizeUi("chat.settingsProfile.default.cannotRename")
                      : localizeUi("chat.settingsProfile.action.rename")
                  }
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size="0.875rem" />
                </button>
                <button
                  onClick={handleSaveAsPreset}
                  disabled={!selectedChatPreset}
                  title={localizeUi("chat.settingsProfile.action.saveAs")}
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FilePlus2 size="0.875rem" />
                </button>
                <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />
                <button
                  onClick={handleImportClick}
                  title={localizeUi("chat.settingsProfile.action.import")}
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  <Download size="0.875rem" />
                </button>
                <button
                  onClick={handleExportPreset}
                  disabled={!selectedChatPreset}
                  title={localizeUi("chat.settingsProfile.action.export")}
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Upload size="0.875rem" />
                </button>
                <button
                  onClick={handleDeletePreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={
                    selectedChatPreset?.isDefault
                      ? localizeUi("chat.settingsProfile.default.cannotDelete")
                      : localizeUi("chat.settingsProfile.action.delete")
                  }
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size="0.875rem" />
                </button>
              </div>
            </div>
          )}

          {/* Keep this display tied to the runtime defaults below. */}
          {MODE_INTRO_KEYS[chatMode] && (
            <div
              style={{ order: CHAT_SETTINGS_ORDER.modeIntro }}
              className="border-b border-[var(--border)] px-4 py-2.5"
            >
              <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi(MODE_INTRO_KEYS[chatMode])}
              </p>
            </div>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.chatName }}>
            <ChatNameSection
              chatId={chat.id}
              chatName={chat.name}
              editingName={editingName}
              nameValue={nameVal}
              onBeginEdit={() => {
                setNameVal(chat.name);
                setEditingName(true);
              }}
              onNameValueChange={setNameVal}
              onSaveName={saveName}
            />
          </div>

          <div style={{ order: CHAT_SETTINGS_ORDER.connection }}>
            <ConnectionSection
              connectionId={chat.connectionId ?? null}
              connections={chatGenerationConnectionsList}
              isGame={isGame}
              onConnectionChange={setConnection}
            />
          </div>

          {/* Roleplay prompt preset */}
          {modeSettingsSurfaces.promptSettingsSurface === "roleplay" && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <PromptPresetSection
                promptPresetId={chat.promptPresetId ?? null}
                presets={promptPresetOptions}
                hasVariables={currentPromptPresetHasVariables}
                quickEditor={
                  chat.promptPresetId ? (
                    <Suspense
                      fallback={
                        <div className="mari-editor-empty flex min-h-24 items-center justify-center px-3 py-6 text-xs">
                          {t("chat.settings.promptPreset.quickEdit.loading")}
                        </div>
                      }
                    >
                      <QuickPresetSectionsEditor
                        presetId={chat.promptPresetId}
                        parentChatHasLorebook={activeLorebooks.length > 0}
                        onEditableCopyCreated={assignEditablePresetCopy}
                      />
                    </Suspense>
                  ) : null
                }
                showLorebookMarkerWarning={showLorebookMarkerWarning}
                onEditVariables={() => {
                  if (chat.promptPresetId) setChoiceModalPresetId(chat.promptPresetId);
                }}
                onPromptPresetChange={setPreset}
              />
            </div>
          )}

          {/* Conversation/Game prompt preset */}
          {modeSettingsSurfaces.promptSettingsSurface === "conversation" && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <ConversationPromptSection
                chatId={chat.id}
                customPrompt={(metadata.customSystemPrompt as string) ?? ""}
                promptPresetId={effectiveModePromptPresetId}
                promptPresets={promptPresetOptions}
                selectedPresetPrompt={selectedModePromptPreset?.conversationPrompt ?? ""}
                onCustomPromptChange={(id, customSystemPrompt) => updateMeta.mutate({ id, customSystemPrompt })}
                onPromptPresetChange={handleModePromptPresetChange}
              />
            </div>
          )}

          {modeSettingsSurfaces.promptSettingsSurface === "game" && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <GameExtraPromptSection
                storedValue={(metadata.gameSystemPrompt as string) ?? ""}
                specialInstructionsValue={gameSpecialInstructionsDraft}
                promptPresetId={effectiveModePromptPresetId}
                promptPresets={promptPresetOptions}
                selectedPresetPrompt={selectedModePromptPreset?.gamePrompt ?? ""}
                gmPromptTemplateId={selectedGameGmPromptTemplateId}
                gmPromptTemplates={GAME_GM_BUILT_IN_PROMPT_TEMPLATES}
                onCommit={(gameSystemPrompt) => updateMeta.mutate({ id: chat.id, gameSystemPrompt })}
                onSpecialInstructionsCommit={(gameSpecialInstructions) =>
                  updateMeta.mutate({ id: chat.id, gameSpecialInstructions })
                }
                onSpecialInstructionsChange={setGameSpecialInstructionsDraft}
                onPromptPresetChange={handleModePromptPresetChange}
                onGmPromptTemplateChange={updateGameGmPromptTemplateSelection}
              />
            </div>
          )}

          {/* Combat Style — game mode only */}
          {isGame && (
            <CombatStyleSection
              style={{ order: CHAT_SETTINGS_ORDER.combatStyle }}
              combatStyle={effectiveCombatStyle}
              onCombatStyleChange={(gameCombatStyle) => updateMeta.mutate({ id: chat.id, gameCombatStyle })}
            />
          )}

          {/* Scene System Prompt — shown only for scene-created chats */}
          {metadata.sceneSystemPrompt && (
            <SceneInstructionsSection
              expanded={scenePromptExpanded}
              storedValue={metadata.sceneSystemPrompt as string}
              value={scenePromptDraft}
              onCommit={(sceneSystemPrompt) => updateMeta.mutate({ id: chat.id, sceneSystemPrompt })}
              onExpandedChange={setScenePromptExpanded}
              onValueChange={setScenePromptDraft}
            />
          )}

          {/* Party (game mode) */}
          {isGame && (
            <Section
              id="game-party"
              style={{ order: CHAT_SETTINGS_ORDER.persona }}
              label={localizeUi("ui.chat.chatsettingsdrawer.party")}
              icon={<Users size="0.875rem" />}
              count={chatCharIds.length + (chat.personaId ? 1 : 0)}
              help={localizeUi("ui.chat.chatsettingsdrawer.yourInGamePartyPickAPersonaToPlay")}
            >
              <div className="space-y-1.5">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.cardlibrarydetailcard.persona")}
                </label>
                {chat.personaId ? (
                  <>
                    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2 ring-1 ring-[var(--primary)]/30">
                      {(() => {
                        const p = personas.find((persona) => persona.id === chat.personaId);
                        return p ? (
                          <>
                            <DrawerPersonaAvatar persona={p} size="md" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs">{p.name}</span>
                              {p.comment && (
                                <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                  {p.comment}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.unknownPersona")}
                          </span>
                        );
                      })()}
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleInlineResourceEditor("persona", chat.personaId!)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          title={t("chat.settings.actions.editPersonaCard")}
                          aria-label={t("chat.settings.actions.editPersonaCard")}
                        >
                          <Pencil size="0.6875rem" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                          className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                          data-chat-settings-remove-resource="persona"
                          title={localizeUi("ui.chat.chatsettingsdrawer.removePersona")}
                        >
                          <X size="0.75rem" />
                        </button>
                      </div>
                    </div>
                    {renderInlineCardEditor(
                      "persona",
                      chat.personaId,
                      personas.find((persona) => persona.id === chat.personaId)?.name ?? "Unknown persona",
                    )}
                  </>
                ) : (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.noPersonaSelected")}
                  </p>
                )}

                {!showPersonaPicker ? (
                  <button
                    onClick={() => {
                      setShowPersonaPicker(true);
                      setPersonaSearch("");
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Plus size="0.75rem" />{" "}
                    {chat.personaId
                      ? localizeUi("ui.chat.chatsettingsdrawer.change")
                      : localizeUi("ui.chat.chatsettingsdrawer.choose")}{" "}
                    {localizeUi("ui.characters.cardlibrarydetailcard.persona")}
                  </button>
                ) : (
                  <PickerDropdown
                    search={personaSearch}
                    onSearchChange={setPersonaSearch}
                    onClose={() => setShowPersonaPicker(false)}
                    placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchPersonas")}
                  >
                    <button
                      onClick={() => {
                        updateChat.mutate({ id: chat.id, personaId: null });
                        setShowPersonaPicker(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                        !chat.personaId && "bg-[var(--primary)]/10",
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
                        <X size="0.625rem" />
                      </div>
                      <span className="flex-1 truncate text-xs">{localizeUi("ui.game.gamesurfacecomponent.none")}</span>
                      {!chat.personaId && <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
                    </button>
                    {personas
                      .filter(
                        (p) =>
                          includesTextForMatch(p.name, personaSearch) ||
                          includesTextForMatch(p.comment ?? "", personaSearch),
                      )
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            updateChat.mutate({ id: chat.id, personaId: p.id });
                            setShowPersonaPicker(false);
                          }}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                            chat.personaId === p.id && "bg-[var(--primary)]/10",
                          )}
                        >
                          <DrawerPersonaAvatar persona={p} />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{p.name}</span>
                            {p.comment && (
                              <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                {p.comment}
                              </span>
                            )}
                          </div>
                          {chat.personaId === p.id && (
                            <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />
                          )}
                        </button>
                      ))}
                    {personas.filter(
                      (p) =>
                        includesTextForMatch(p.name, personaSearch) ||
                        includesTextForMatch(p.comment ?? "", personaSearch),
                    ).length === 0 && (
                      <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                        {personas.length === 0
                          ? localizeUi("ui.chat.chatsettingsdrawer.noPersonasCreatedYet")
                          : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                      </p>
                    )}
                  </PickerDropdown>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.partyCharacters")}
                </label>
                {chatCharIds.length === 0 ? (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.noCharactersInPartyYet")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {chatCharIds.map((cid) => {
                      const c = characters.find((ch) => ch.id === cid);
                      if (!c) return null;
                      const name = charName(c);
                      const title = charTitle(c);
                      return (
                        <Fragment key={c.id}>
                          <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                            <button
                              onClick={() => {
                                onClose();
                                useUIStore.getState().openCharacterDetail(c.id, { initialTab: "card" });
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                              title={localizeUi("ui.chat.chatsettingsdrawer.openCharacterCard")}
                            >
                              {c.avatarPath ? (
                                <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full">
                                  <img
                                    src={c.avatarPath}
                                    alt={name}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                    style={getAvatarCropStyle(getCharacterInfo(c).avatarCrop)}
                                  />
                                </span>
                              ) : (
                                <div className="mari-avatar-placeholder mari-avatar-placeholder--character flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold">
                                  {name[0]}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs">{name}</span>
                                {title && (
                                  <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                    {title}
                                  </span>
                                )}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleInlineResourceEditor("character", c.id)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                              title={t("chat.settings.actions.editCharacterCard")}
                              aria-label={t("chat.settings.actions.editCharacterCard")}
                            >
                              <Pencil size="0.6875rem" />
                            </button>
                            <button
                              onClick={() => toggleCharacter(c.id)}
                              className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                              data-chat-settings-remove-resource="character"
                              title={localizeUi("ui.chat.chatsettingsdrawer.removeFromParty")}
                            >
                              <Trash2 size="0.6875rem" />
                            </button>
                          </div>
                          {renderInlineCardEditor("character", c.id, name)}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {!showCharPicker ? (
                <button
                  onClick={() => {
                    setShowCharPicker(true);
                    setCharSearch("");
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.addCharacterToParty")}
                </button>
              ) : (
                <PickerDropdown
                  search={charSearch}
                  onSearchChange={setCharSearch}
                  onClose={() => setShowCharPicker(false)}
                  placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchCharacters")}
                >
                  {selectableCharacters
                    .filter((c) => !chatCharIds.includes(c.id))
                    .filter((c) => characterMatchesSearch(getCharacterInfo(c), charSearch))
                    .map((c) => {
                      const name = charName(c);
                      const title = charTitle(c);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            toggleCharacter(c.id);
                            setShowCharPicker(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{name}</span>
                            {title && (
                              <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                {title}
                              </span>
                            )}
                          </div>
                          <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                        </button>
                      );
                    })}
                </PickerDropdown>
              )}
            </Section>
          )}

          {/* Persona */}
          {!isGame && (
            <Section
              id={`${chatMode}-persona`}
              style={{ order: CHAT_SETTINGS_ORDER.persona }}
              label={localizeUi("ui.characters.cardlibrarydetailcard.persona")}
              icon={<VenetianMask size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.yourPersonaDefinesWhoYouAreInThisChat")}
            >
              {/* Currently selected persona */}
              {chat.personaId ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2">
                    {(() => {
                      const p = personas.find((p) => p.id === chat.personaId);
                      return p ? (
                        <>
                          <DrawerPersonaAvatar persona={p} size="md" />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{p.name}</span>
                            {p.comment && (
                              <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                {p.comment}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.unknownPersona")}
                        </span>
                      );
                    })()}
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleInlineResourceEditor("persona", chat.personaId!)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title={t("chat.settings.actions.editPersonaCard")}
                        aria-label={t("chat.settings.actions.editPersonaCard")}
                      >
                        <Pencil size="0.6875rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                        className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                        data-chat-settings-remove-resource="persona"
                        title={localizeUi("ui.chat.chatsettingsdrawer.removePersona")}
                      >
                        <X size="0.75rem" />
                      </button>
                    </div>
                  </div>
                  {renderInlineCardEditor(
                    "persona",
                    chat.personaId,
                    personas.find((persona) => persona.id === chat.personaId)?.name ?? "Unknown persona",
                  )}
                </>
              ) : (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.noPersonaSelected")}
                </p>
              )}

              {/* Persona picker */}
              {!showPersonaPicker ? (
                <button
                  onClick={() => {
                    setShowPersonaPicker(true);
                    setPersonaSearch("");
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" />{" "}
                  {chat.personaId
                    ? localizeUi("ui.chat.chatsettingsdrawer.change")
                    : localizeUi("ui.chat.chatsettingsdrawer.choose")}{" "}
                  {localizeUi("ui.characters.cardlibrarydetailcard.persona")}
                </button>
              ) : (
                <PickerDropdown
                  search={personaSearch}
                  onSearchChange={setPersonaSearch}
                  onClose={() => setShowPersonaPicker(false)}
                  placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchPersonas")}
                >
                  {/* None option */}
                  <button
                    onClick={() => {
                      updateChat.mutate({ id: chat.id, personaId: null });
                      setShowPersonaPicker(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                      !chat.personaId && "bg-[var(--primary)]/10",
                    )}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
                      <X size="0.625rem" />
                    </div>
                    <span className="flex-1 truncate text-xs">{localizeUi("ui.game.gamesurfacecomponent.none")}</span>
                    {!chat.personaId && <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
                  </button>
                  {personas
                    .filter(
                      (p) =>
                        includesTextForMatch(p.name, personaSearch) ||
                        includesTextForMatch(p.comment ?? "", personaSearch),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          updateChat.mutate({ id: chat.id, personaId: p.id });
                          setShowPersonaPicker(false);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                          chat.personaId === p.id && "bg-[var(--primary)]/10",
                        )}
                      >
                        <DrawerPersonaAvatar persona={p} />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{p.name}</span>
                          {p.comment && (
                            <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                              {p.comment}
                            </span>
                          )}
                        </div>
                        {chat.personaId === p.id && (
                          <Check size="0.625rem" className="ml-auto shrink-0 text-[var(--primary)]" />
                        )}
                      </button>
                    ))}
                  {personas.filter(
                    (p) =>
                      includesTextForMatch(p.name, personaSearch) ||
                      includesTextForMatch(p.comment ?? "", personaSearch),
                  ).length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {personas.length === 0
                        ? localizeUi("ui.chat.chatsettingsdrawer.noPersonasCreatedYet")
                        : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                    </p>
                  )}
                </PickerDropdown>
              )}
            </Section>
          )}

          {/* Characters — only show added ones + add button */}
          {!isGame && (
            <Section
              id={`${chatMode}-characters`}
              style={{ order: CHAT_SETTINGS_ORDER.characters }}
              label={localizeUi("navigation.topbar.characters")}
              icon={<Users size="0.875rem" />}
              count={chatCharIds.length}
              help={localizeUi("ui.chat.chatsettingsdrawer.charactersInThisChatEachCharacterHasTheirOwn")}
            >
              {/* Active characters */}
              {chatCharIds.length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.noCharactersAddedToThisChat")}
                </p>
              ) : (
                <div
                  data-chat-settings-character-root
                  className="flex flex-col gap-1"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropIdx(chatCharIds.length);
                  }}
                  onDrop={handleCharDrop}
                >
                  {chatCharIds.map((cid, i) => {
                    const c = characters.find((ch) => ch.id === cid);
                    if (!c) return null;
                    const name = charName(c);
                    const title = charTitle(c);
                    return (
                      <div key={c.id}>
                        {dropIdx === i && dragIdx !== null && dragIdx !== i && (
                          <div className="h-0.5 rounded-full bg-[var(--primary)] mx-2 mb-1" />
                        )}
                        <div
                          data-touch-reorder-item="chat-settings-character"
                          data-touch-reorder-index={i}
                          draggable
                          onDragStart={(e) => handleCharDragStart(i, e)}
                          onDragOver={(e) => {
                            e.stopPropagation();
                            handleCharDragOver(i, e);
                          }}
                          onDragEnd={handleCharDragEnd}
                          className={cn(
                            "flex items-center gap-2 rounded-lg bg-[var(--primary)]/10 px-2 py-2 ring-1 ring-[var(--primary)]/30 transition-opacity",
                            dragIdx === i && "opacity-40",
                            inactiveCharacterIds.includes(c.id) &&
                              "bg-[var(--secondary)] opacity-70 ring-[var(--border)]",
                          )}
                        >
                          <div
                            className="cursor-grab text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors active:cursor-grabbing"
                            title={localizeUi("ui.lorebooks.lorebookentryrow.dragToReorder")}
                            onTouchStart={(event) => {
                              event.stopPropagation();
                              startCharacterReorderTouchDrag(event, c.id, {
                                allowInteractiveTarget: true,
                                sourceElement: event.currentTarget.closest<HTMLElement>(
                                  '[data-touch-reorder-item="chat-settings-character"]',
                                ),
                              });
                            }}
                          >
                            <GripVertical size="0.75rem" />
                          </div>
                          <button
                            onClick={() => {
                              onClose();
                              useUIStore.getState().openCharacterDetail(c.id, { initialTab: "card" });
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left transition-colors hover:opacity-80"
                            title={localizeUi("ui.chat.chatsettingsdrawer.openCharacterCard")}
                          >
                            {c.avatarPath ? (
                              <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full">
                                <img
                                  src={c.avatarPath}
                                  alt={name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                  style={getAvatarCropStyle(getCharacterInfo(c).avatarCrop)}
                                />
                              </span>
                            ) : (
                              <div className="mari-avatar-placeholder mari-avatar-placeholder--character flex h-7 w-7 items-center justify-center rounded-full text-[0.625rem] font-bold">
                                {name[0]}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs">{name}</span>
                              {title && (
                                <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                  {title}
                                </span>
                              )}
                            </div>
                          </button>
                          {supportsCharacterActivityToggle && (
                            <button
                              onClick={() => toggleCharacterActivity(c.id)}
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                                !inactiveCharacterIds.includes(c.id) && "text-[var(--primary)]",
                              )}
                              title={
                                inactiveCharacterIds.includes(c.id)
                                  ? localizeUi("ui.chat.chatsettingsdrawer.enableInChat")
                                  : localizeUi("ui.chat.chatsettingsdrawer.disableInChat")
                              }
                            >
                              {inactiveCharacterIds.includes(c.id) ? (
                                <EyeOff size="0.6875rem" />
                              ) : (
                                <Eye size="0.6875rem" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleInlineResourceEditor("character", c.id)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                            title={t("chat.settings.actions.editCharacterCard")}
                            aria-label={t("chat.settings.actions.editCharacterCard")}
                          >
                            <Pencil size="0.6875rem" />
                          </button>
                          <button
                            onClick={() => toggleCharacter(c.id)}
                            className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                            data-chat-settings-remove-resource="character"
                            title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                          >
                            <Trash2 size="0.6875rem" />
                          </button>
                        </div>
                        {renderInlineCardEditor("character", c.id, name)}
                      </div>
                    );
                  })}
                  {dropIdx === chatCharIds.length && dragIdx !== null && (
                    <div className="h-0.5 rounded-full bg-[var(--primary)] mx-2 mt-1" />
                  )}
                </div>
              )}

              {/* Add character picker */}
              {!showCharPicker ? (
                <button
                  onClick={() => {
                    setShowCharPicker(true);
                    setCharSearch("");
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.addCharacter")}
                </button>
              ) : (
                <PickerDropdown
                  search={charSearch}
                  onSearchChange={setCharSearch}
                  onClose={() => setShowCharPicker(false)}
                  placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchCharacters")}
                >
                  {selectableCharacters
                    .filter((c) => !chatCharIds.includes(c.id))
                    .filter((c) => characterMatchesSearch(getCharacterInfo(c), charSearch))
                    .map((c) => {
                      const name = charName(c);
                      const title = charTitle(c);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            toggleCharacter(c.id);
                            setShowCharPicker(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                        >
                          {c.avatarPath ? (
                            <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full">
                              <img
                                src={c.avatarPath}
                                alt={name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                style={getAvatarCropStyle(getCharacterInfo(c).avatarCrop)}
                              />
                            </span>
                          ) : (
                            <div className="mari-avatar-placeholder mari-avatar-placeholder--character flex h-6 w-6 items-center justify-center rounded-full text-[0.5625rem] font-bold">
                              {name[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{name}</span>
                            {title && (
                              <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                {title}
                              </span>
                            )}
                          </div>
                          <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                        </button>
                      );
                    })}
                  {selectableCharacters
                    .filter((c) => !chatCharIds.includes(c.id))
                    .filter((c) => characterMatchesSearch(getCharacterInfo(c), charSearch)).length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {selectableCharacters.filter((c) => !chatCharIds.includes(c.id)).length === 0
                        ? localizeUi("ui.chat.chatsettingsdrawer.allCharactersAlreadyAdded")
                        : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                    </p>
                  )}
                </PickerDropdown>
              )}

              {/* Add from Folder picker */}
              {((characterGroups ?? []) as CharacterGroup[]).length > 0 &&
                (!showGroupPicker ? (
                  <button
                    onClick={() => setShowGroupPicker(true)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Users size="0.75rem" /> {localizeUi("ui.noodle.noodlehome.addFromFolder")}
                  </button>
                ) : (
                  <PickerDropdown
                    search=""
                    onSearchChange={() => {}}
                    onClose={() => setShowGroupPicker(false)}
                    placeholder={localizeUi("ui.chat.chatsettingsdrawer.selectAFolder")}
                  >
                    {((characterGroups ?? []) as CharacterGroup[]).map((group) => {
                      const rawIds = group.characterIds ?? [];
                      const groupCharIds: string[] = Array.isArray(rawIds)
                        ? rawIds
                        : typeof rawIds === "string"
                          ? JSON.parse(rawIds)
                          : [];
                      const newIds = groupCharIds.filter((id) => !chatCharIds.includes(id));
                      return (
                        <button
                          key={group.id}
                          onClick={() => {
                            if (newIds.length > 0) {
                              updateChat.mutate({ id: chat.id, characterIds: [...chatCharIds, ...newIds] });
                            }
                            setShowGroupPicker(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                        >
                          {group.avatarPath ? (
                            <img
                              src={group.avatarPath}
                              alt={group.name}
                              loading="lazy"
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold">
                              {group.name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="block truncate text-xs">{group.name}</span>
                            <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                              {groupCharIds.length} {localizeUi("ui.noodle.noodlehome.characters")}
                              {newIds.length > 0
                                ? localizeUi("ui.chat.chatsettingsdrawer.value1New", { value1: newIds.length })
                                : localizeUi("ui.chat.chatsettingsdrawer.allAdded")}
                            </span>
                          </div>
                          {newIds.length > 0 && <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />}
                        </button>
                      );
                    })}
                  </PickerDropdown>
                ))}
            </Section>
          )}

          {/* Card Theming — only shown when an active character ships creator-notes CSS */}
          {activeCardsHaveCss && (
            <Section
              id={`${chatMode}-card-theming`}
              style={{ order: CHAT_SETTINGS_ORDER.cardTheming }}
              label={localizeUi("ui.chat.chatsettingsdrawer.cardTheming")}
              icon={<Paintbrush size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.applyCssEmbeddedInACharacterSCreatorNotes")}
            >
              <div className="space-y-2">
                <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "disabled" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                      cardCssMode === "disabled"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.agents.agenteditor.disabled")}
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "exclusive" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                      cardCssMode === "exclusive"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.chat.chatsettingsdrawer.exclusive")}
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "chat" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                      cardCssMode === "chat"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.chat.chatsettingsdrawer.chat")}
                  </button>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {cardCssMode === "disabled"
                    ? localizeUi("ui.chat.chatsettingsdrawer.cardCssIsOffNoCharacterStylingIsApplied")
                    : cardCssMode === "exclusive"
                      ? localizeUi("ui.chat.chatsettingsdrawer.eachCharacterSCssOnlyAffectsTheirOwnMessages")
                      : localizeUi("ui.chat.chatsettingsdrawer.allCardCssAffectsTheEntireChatAreaIncluding")}
                </p>
              </div>
            </Section>
          )}

          {/* Scoped Regex Scripts — only shown when a chat character has scoped scripts */}
          {chatScopedRegexGroups.length > 0 && (
            <Section
              id={`${chatMode}-scoped-regex`}
              style={{ order: CHAT_SETTINGS_ORDER.scopedRegex }}
              label={localizeUi("ui.chat.chatsettingsdrawer.scopedRegexScripts")}
              icon={<Regex size="0.875rem" />}
              count={scopedRegexCount}
              help={localizeUi(
                "ui.chat.chatsettingsdrawer.applyCharacterScopedRegexScriptsToDisplayedMessagesExclusive",
              )}
            >
              <div className="space-y-2">
                <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "disabled" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                      scopedRegexMode === "disabled"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.agents.agenteditor.disabled")}
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "exclusive" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                      scopedRegexMode === "exclusive"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.chat.chatsettingsdrawer.exclusive")}
                  </button>
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "chat" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                      scopedRegexMode === "chat"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.chat.chatsettingsdrawer.chat")}
                  </button>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {scopedRegexMode === "disabled"
                    ? localizeUi("ui.chat.chatsettingsdrawer.characterScopedRegexIsOffOnlyGlobalScriptsRun")
                    : scopedRegexMode === "exclusive"
                      ? localizeUi("ui.chat.chatsettingsdrawer.eachScopedScriptOnlyTransformsItsOwnCharacterS")
                      : localizeUi("ui.chat.chatsettingsdrawer.allScopedScriptsTransformEveryMessage")}
                </p>
                {chatScopedRegexGroups.map((group) => (
                  <div key={group.characterId} className="rounded-lg ring-1 ring-[var(--border)]">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-medium text-[var(--foreground)]">
                        {group.name}
                      </span>
                      <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                        {group.scripts.length} {localizeUi("ui.chat.chatsettingsdrawer.script")}
                        {group.scripts.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
                      </span>
                    </div>
                    <div className="max-h-48 space-y-0.5 overflow-y-auto border-t border-[var(--border)] px-2 py-1.5">
                      {group.scripts.map((script) => {
                        const enabled = script.enabled === "true";
                        return (
                          <button
                            key={script.id}
                            type="button"
                            onClick={() => updateRegexScript.mutate({ id: script.id, enabled: !enabled })}
                            title={
                              enabled
                                ? localizeUi("ui.chat.chatsettingsdrawer.enabledClickToDisable")
                                : localizeUi("ui.chat.chatsettingsdrawer.disabledClickToEnable")
                            }
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[0.6875rem] transition-colors hover:bg-[var(--accent)]"
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/40",
                              )}
                            />
                            <span
                              className={cn(
                                "min-w-0 truncate",
                                enabled ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                              )}
                            >
                              {script.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Every existing and new multi-character chat gets this section. Missing mode metadata means Grouped. */}
          {chatCharIds.length > 1 && modeSettingsSurfaces.showGroupChatControls && (
            <Section
              id={`${chatMode}-group-chat`}
              style={{ order: CHAT_SETTINGS_ORDER.groupChat }}
              label={localizeUi("ui.chat.chatsettingsdrawer.groupChat")}
              icon={<Users size="0.875rem" />}
              help={
                isConversation
                  ? localizeUi("ui.chat.chatsettingsdrawer.chooseOneGroupedResponseOrSeparateCharacterTurnsIndividual")
                  : localizeUi("ui.chat.chatsettingsdrawer.configureHowMultipleCharactersInteractMergedModeCombinesAll")
              }
            >
              {/* Mode selector */}
              <div className="space-y-2">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.mode")}
                </label>
                <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, groupChatMode: "merged" })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                      (metadata.groupChatMode ?? "merged") === "merged"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {isConversation
                      ? localizeUi("ui.chat.chatsettingsdrawer.grouped")
                      : localizeUi("ui.chat.chatsettingsdrawer.mergedNarrator")}
                  </button>
                  <button
                    onClick={() => {
                      if (metadata.groupChatMode === "individual") return;
                      updateMeta.mutate({
                        id: chat.id,
                        groupChatMode: "individual",
                        ...(isConversation && metadata.groupResponseOrder === "manual"
                          ? { groupResponseOrder: "sequential" as const }
                          : {}),
                      });
                      if (isConversation) {
                        toast.warning(localizeUi("ui.chat.chatsettingsdrawer.individualRepliesCanUseManyTokens"), {
                          description: localizeUi(
                            "ui.chat.chatsettingsdrawer.eachRespondingCharacterUsesASeparateModelRequestLarge",
                          ),
                          duration: 12_000,
                        });
                      }
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                      metadata.groupChatMode === "individual"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {localizeUi("ui.chat.chatsettingsdrawer.individual")}
                  </button>
                </div>
              </div>

              {/* Merged mode: speaker color option */}
              {!isConversation && (metadata.groupChatMode ?? "merged") === "merged" && (
                <div className="mt-2">
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.colorDialogues")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.colorCharacterDialoguesDifferentlyUsingTheSpecialTagsThe",
                    )}
                    checked={Boolean(metadata.groupSpeakerColors)}
                    onChange={(checked) => updateMeta.mutate({ id: chat.id, groupSpeakerColors: checked })}
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-md px-3 py-2.5 text-left",
                      metadata.groupSpeakerColors
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                    labelClassName="text-[0.6875rem] font-medium"
                  />
                </div>
              )}

              {/* Individual mode: response order */}
              {metadata.groupChatMode === "individual" && (
                <div className="mt-2 space-y-2">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.responseOrder")}
                  </label>
                  <div className="flex rounded-lg ring-1 ring-[var(--border)]">
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "sequential" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                        (metadata.groupResponseOrder ?? "sequential") === "sequential"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      {localizeUi("ui.chat.chatsettingsdrawer.sequential")}
                    </button>
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "smart" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                        metadata.groupResponseOrder === "smart"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      {localizeUi("ui.chat.chatsettingsdrawer.smart")}
                    </button>
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "manual" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                        metadata.groupResponseOrder === "manual"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      {localizeUi("ui.chat.chatsettingsdrawer.manual")}
                    </button>
                  </div>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {metadata.groupResponseOrder === "manual"
                      ? isConversation
                        ? localizeUi("ui.chat.chatsettingsdrawer.noAutomaticResponsesMentionOneOrMoreCharactersTo")
                        : localizeUi("ui.chat.chatsettingsdrawer.noAutomaticResponsesUseTheCharacterPickerInThe")
                      : metadata.groupResponseOrder === "smart"
                        ? isConversation
                          ? localizeUi("ui.chat.chatsettingsdrawer.smartChoosesOneOrMoreAvailableCharactersUsingThe")
                          : localizeUi("ui.chat.chatsettingsdrawer.anAiAgentDecidesWhichCharactersShouldRespondBased")
                        : isConversation
                          ? localizeUi("ui.chat.chatsettingsdrawer.availableCharactersRespondOneByOneInTheirListed")
                          : localizeUi("ui.chat.chatsettingsdrawer.charactersRespondOneByOneInTheirListedOrder")}
                  </p>
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.addTurnToPrompt")}
                    description={
                      metadata.groupTurnPromptEnabled !== false
                        ? localizeUi(
                            "ui.chat.chatsettingsdrawer.eachIndividualTurnIncludesAShortRespondingCharacterInstruction",
                          )
                        : localizeUi("ui.chat.chatsettingsdrawer.individualTurnsRelyOnContextWithoutAddingATurn")
                    }
                    checked={metadata.groupTurnPromptEnabled !== false}
                    onChange={(checked) =>
                      updateMeta.mutate({
                        id: chat.id,
                        groupTurnPromptEnabled: checked,
                      })
                    }
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-md px-3 py-2.5 text-left",
                      metadata.groupTurnPromptEnabled !== false
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                    labelClassName="text-[0.6875rem] font-medium"
                  />
                  {!isConversation && (
                    <SettingsSwitch
                      label={localizeUi("ui.chat.chatsettingsdrawer.namePrefixHistory")}
                      description={
                        metadata.groupSpeakerNamesInHistory === true
                          ? localizeUi("ui.chat.chatsettingsdrawer.historyTurnsAreSentAsNameMessageBeforeMerged")
                          : localizeUi("ui.chat.chatsettingsdrawer.historyTurnsKeepTheirStoredTextBeforeRoleMerging")
                      }
                      checked={metadata.groupSpeakerNamesInHistory === true}
                      onChange={(checked) => updateMeta.mutate({ id: chat.id, groupSpeakerNamesInHistory: checked })}
                      labelPosition="start"
                      className={cn(
                        "justify-between rounded-md px-3 py-2.5 text-left",
                        metadata.groupSpeakerNamesInHistory === true
                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                      )}
                      labelClassName="text-[0.6875rem] font-medium"
                    />
                  )}
                </div>
              )}

              {/* Scenario Override */}
              {!isConversation && (
                <div className="mt-2 space-y-1.5">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.scenarioOverride")}
                  </label>
                  <MacroTextarea
                    title={localizeUi("ui.chat.chatsettingsdrawer.groupScenarioOverride")}
                    value={groupScenarioDraft}
                    onChange={setGroupScenarioDraft}
                    onBlur={() => {
                      if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                        updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
                      }
                    }}
                    onExpandedClose={() => {
                      if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                        updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
                      }
                    }}
                    placeholder={localizeUi(
                      "ui.chat.chatsettingsdrawer.replaceIndividualCharacterScenariosWithASharedScenarioFor",
                    )}
                    rows={4}
                    className="mari-chrome-field min-h-[6rem] !rounded-md px-3 py-2 pr-8 text-xs leading-relaxed"
                  />
                </div>
              )}
            </Section>
          )}

          {/* Autonomous Messaging — conversation mode only */}
          {isConversation && (
            <Section
              id="conversation-autonomous-messaging"
              label={localizeUi("ui.chat.chatsettingsdrawer.autonomousMessaging")}
              icon={<Bot size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.charactersCanMessageYouUnpromptedBasedOnTheirPersonality")}
              initialOpen={initialSection === "autonomous"}
            >
              <div className="space-y-2">
                {/* Enable autonomous messages toggle */}
                <div className="overflow-hidden rounded-md">
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.autonomousMessages")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.charactersMessageYouWhenYouReInactiveEvenWithout",
                    )}
                    checked={Boolean(metadata.autonomousMessages)}
                    onChange={(autonomousMessages) => updateMeta.mutate({ id: chat.id, autonomousMessages })}
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-md px-3 py-2.5 text-left",
                      metadata.autonomousMessages
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                    labelClassName="text-xs font-medium"
                  />

                  {metadata.autonomousMessages && (
                    <div className="border-t border-[var(--border)]/50 px-3 pb-2.5 pt-2">
                      <div className="space-y-1.5">
                        <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.chatCheckInCap")}
                        </span>
                        <select
                          aria-label={localizeUi("ui.chat.chatsettingsdrawer.chatCheckInCapMode")}
                          value={autonomousDailyCapOverride === null ? "default" : "numeric"}
                          onChange={(e) =>
                            updateMeta.mutate({
                              id: chat.id,
                              autonomousDailyCapOverride:
                                e.target.value === "numeric" ? (autonomousDailyCapOverride ?? 8) : null,
                            })
                          }
                          className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                        >
                          <option value="default">
                            {localizeUi("ui.chat.chatsettingsdrawer.defaultChatCeilingTalkativenessBased")}
                          </option>
                          <option value="numeric">{localizeUi("ui.chat.chatsettingsdrawer.numericValue")}</option>
                        </select>
                        {autonomousDailyCapOverride !== null && (
                          <label className="flex items-center justify-between gap-3 rounded-md bg-[var(--background)]/35 px-2.5 py-2">
                            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.checkInsPerDay")}
                            </span>
                            <DraftNumberInput
                              value={autonomousDailyCapOverride}
                              min={1}
                              onCommit={(value) =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  autonomousDailyCapOverride: value,
                                })
                              }
                              ariaLabel="Numeric chat check-in ceiling"
                              className="mari-chrome-field w-24 !rounded-md px-2 py-1.5 text-right text-xs"
                            />
                          </label>
                        )}
                        <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.setsTheChatWideCeilingCharacterCapsCanOnly")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Character exchanges toggle (group chats only) */}
                {chatCharIds.length > 1 && (
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.characterExchanges")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.charactersChatWithEachOtherInGroupChats")}
                    checked={Boolean(metadata.characterExchanges)}
                    onChange={(characterExchanges) => updateMeta.mutate({ id: chat.id, characterExchanges })}
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-md px-3 py-2.5 text-left",
                      metadata.characterExchanges
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                    labelClassName="text-xs font-medium"
                  />
                )}

                {/* Conversation schedules toggle */}
                <SettingsSwitch
                  label={localizeUi("ui.chat.chatsettingsdrawer.schedules")}
                  description={localizeUi(
                    "ui.chat.chatsettingsdrawer.optionalCharacterRoutinesForAvailabilityAndDelays",
                  )}
                  checked={conversationSchedulesEnabled}
                  onChange={(nextEnabled) => {
                    if (nextEnabled && !hasGeneratedConversationSchedules) {
                      if (chatCharIds.length === 0) {
                        updateMeta.mutate({ id: chat.id, conversationSchedulesEnabled: nextEnabled });
                        return;
                      }
                      void generateConversationSchedules(false);
                      return;
                    }
                    updateMeta.mutate({ id: chat.id, conversationSchedulesEnabled: nextEnabled });
                  }}
                  labelPosition="start"
                  className={cn(
                    "justify-between rounded-md px-3 py-2.5 text-left",
                    conversationSchedulesEnabled
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                  labelClassName="text-xs font-medium"
                />

                <div ref={scheduleControlsRef} className="scroll-mt-2 space-y-2">
                  {/* Schedule status */}
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                        {!conversationSchedulesEnabled
                          ? localizeUi(
                              "ui.chat.chatsettingsdrawer.schedulesAreOffAutonomyUsesTalkativenessAndYourStatus",
                            )
                          : hasGeneratedConversationSchedules
                            ? localizeUi(
                                "ui.chat.chatsettingsdrawer.schedulesGeneratedStatusIsDerivedFromCharacterRoutines",
                              )
                            : localizeUi("ui.chat.chatsettingsdrawer.schedulesEnabledGenerateRoutinesWhenYouReReady")}
                      </span>
                      <p className="text-[0.59375rem] mt-0.5 text-[var(--muted-foreground)]/60">
                        {conversationSchedulesEnabled
                          ? localizeUi("ui.chat.chatsettingsdrawer.schedulesRefreshOnlyAfterYouEnableOrRegenerateThem")
                          : localizeUi("ui.chat.chatsettingsdrawer.turnSchedulesOnIfYouWantAvailabilityAndBusy")}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await generateConversationSchedules(true);
                      }}
                      disabled={isRegeneratingSchedules || chatCharIds.length === 0}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors",
                        isRegeneratingSchedules || chatCharIds.length === 0
                          ? "cursor-not-allowed text-[var(--muted-foreground)]/60"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                      title={
                        isRegeneratingSchedules
                          ? localizeUi("ui.chat.chatsettingsdrawer.regeneratingSchedules")
                          : localizeUi("ui.chat.chatsettingsdrawer.generateSchedules")
                      }
                    >
                      <RefreshCw size="0.6875rem" className={cn(isRegeneratingSchedules && "animate-spin")} />
                      {isRegeneratingSchedules
                        ? localizeUi("ui.chat.chatsettingsdrawer.regenerating")
                        : hasGeneratedConversationSchedules
                          ? localizeUi("ui.agents.secretplotpanel.regenerate")
                          : localizeUi("ui.characters.characterclipcard.generate")}
                    </button>
                  </div>

                  <div className="rounded-lg bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)]/80">
                    <ConversationTimeZoneSelect compact />
                  </div>

                  {hasGeneratedConversationSchedules && onOpenScheduleEditor && (
                    <div className="mt-2 space-y-1.5">
                      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.editSchedules")}
                      </span>
                      {chatCharIds.map((charId) => {
                        const schedule = (metadata.characterSchedules as Record<string, WeekSchedule> | undefined)?.[
                          charId
                        ];
                        const scheduledDayCount = schedule?.days
                          ? Object.values(schedule.days).filter((blocks) => Array.isArray(blocks) && blocks.length > 0)
                              .length
                          : 0;
                        return (
                          <button
                            key={charId}
                            type="button"
                            onClick={() => onOpenScheduleEditor(charId)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]/50"
                          >
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">
                              {charNameMap.get(charId) ?? "Unknown"}
                            </span>
                            <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                              {schedule
                                ? localizeUi("ui.chat.chatsettingsdrawer.value1DayValue2Scheduled", {
                                    value1: scheduledDayCount,
                                    value2: scheduledDayCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                                  })
                                : localizeUi("ui.chat.chatsettingsdrawer.createSchedule")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Conversation feature packages expose commands and settings as soon as they are installed. */}
          {modeSettingsSurfaces.agentSettingsSurface === "conversation" && (
            <Section
              id="conversation-agents"
              style={{ order: CHAT_SETTINGS_ORDER.agents }}
              label={localizeUi("navigation.topbar.agents")}
              icon={<Sparkles size="0.875rem" />}
              help={localizeUi(
                "ui.chat.chatsettingsdrawer.configureConversationCommandsCustomAgentsAndSettingsSuppliedBy",
              )}
            >
              <div className="space-y-3">
                {hasConversationCommands && (
                  <div className="space-y-3">
                    <AgentSettingsCard
                      id={getAgentSettingsMenuId(chat.id, "conversation-commands")}
                      icon={<Puzzle size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                      title={localizeUi("ui.chat.chatsettingsdrawer.commands")}
                      description={localizeUi(
                        "ui.chat.chatsettingsdrawer.allowModelsToInteractWithYouThroughInstalledCommands",
                      )}
                      initialOpen={false}
                    >
                      <SettingsSwitch
                        label={localizeUi("ui.chat.chatsettingsdrawer.commands")}
                        description={localizeUi(
                          "ui.chat.chatsettingsdrawer.allowModelsToInteractWithYouThroughInstalledCommands",
                        )}
                        checked={conversationCommandsEnabled}
                        onChange={(enabled) => updateMeta.mutate({ id: chat.id, characterCommands: enabled })}
                        labelPosition="start"
                        className={cn(
                          "justify-between rounded-lg px-3 py-2.5 text-left",
                          conversationCommandsEnabled
                            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                            : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                        )}
                        labelClassName="text-xs font-medium"
                      />

                      {conversationCommandsEnabled && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {availableConversationCommandOptions.map((command) => {
                            const enabled = isConversationCommandToggleEnabled(conversationCommandToggles, command.id);
                            return (
                              <SettingsSwitch
                                key={command.id}
                                label={command.label}
                                description={command.description}
                                checked={enabled}
                                onChange={(nextEnabled) =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    conversationCommandToggles: {
                                      ...conversationCommandToggles,
                                      [command.id]: nextEnabled,
                                    },
                                  })
                                }
                                labelPosition="start"
                                className={cn(
                                  "h-full min-h-[4.125rem] items-center justify-between rounded-lg px-3 py-2.5 text-left",
                                  enabled
                                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                    : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                                )}
                                labelClassName="text-[0.6875rem] font-medium"
                              />
                            );
                          })}
                        </div>
                      )}
                    </AgentSettingsCard>

                    {illustratorInstalled && (
                      <AgentSettingsCard
                        id={getAgentSettingsMenuId(chat.id, "illustrator")}
                        icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                        title={localizeUi("ui.chat.chatsettingsdrawer.illustratorSettings")}
                        description={localizeUi(
                          "ui.chat.chatsettingsdrawer.configureIllustratorSSelfieCommandImageConnectionPromptModel",
                        )}
                        initialOpen={false}
                      >
                        <GenerationSettingsLink
                          onClick={openGenerationSettings}
                          title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                          label={localizeUi("ui.chat.chatsettingsdrawer.imageGenerationSettings")}
                          description={localizeUi(
                            "ui.chat.chatsettingsdrawer.adjustGenerationBehaviorImageSizesAndStylesInSettings",
                          )}
                        />

                        <AgentSettingsToggle
                          label={localizeUi("ui.chat.chatsettingsdrawer.generatedSelfies")}
                          description={localizeUi(
                            "ui.chat.chatsettingsdrawer.enableIllustratorSSelfiesCommandForThisConversation",
                          )}
                          enabled={selfieFeatureEnabled}
                          onToggle={toggleConversationSelfies}
                        />

                        {selfieSettingsOpen ? (
                          <div className="space-y-2 border-t border-[var(--border)]/60 pt-3">
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.selfieConnection")}
                              </span>
                              <select
                                value={selfieConnectionId}
                                onChange={(e) =>
                                  updateMeta.mutate({ id: chat.id, imageGenConnectionId: e.target.value || null })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                              >
                                <option value="">{localizeUi("ui.chat.chatsettingsdrawer.noneSelfiesDisabled")}</option>
                                {imageConnectionsList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.provider})
                                  </option>
                                ))}
                              </select>
                            </label>
                            {renderIllustratorPromptConnectionSelect()}
                            {renderIllustratorImageStyleSelect()}
                            {renderIllustratorImagesPerGeneration()}
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.sendTheMatchingCharacterAvatarOrSpriteAsA",
                              )}
                              enabled={selfieUseAvatarReferences}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  selfieUseAvatarReferences: !selfieUseAvatarReferences,
                                })
                              }
                            />
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.appendTheMatchingCharacterCardAppearanceTextToGenerated",
                              )}
                              enabled={selfieIncludeCharacterAppearance}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  selfieIncludeCharacterAppearance: !selfieIncludeCharacterAppearance,
                                })
                              }
                            />
                            <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.usedForCharacterSelfiesWhenCommandsAreEnabledThe",
                              )}
                            </p>

                            {selfieConnectionId ? (
                              <div className="mt-2 space-y-1">
                                <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                                  {localizeUi("ui.connections.videogenerationdefaultspanel.resolution")}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    { label: "512x512", w: 512, h: 512 },
                                    { label: "512x768", w: 512, h: 768 },
                                    { label: "768x768", w: 768, h: 768 },
                                    { label: "768x1024", w: 768, h: 1024 },
                                    { label: "896x1152", w: 896, h: 1152 },
                                    { label: "1024x1024", w: 1024, h: 1024 },
                                  ].map((opt) => {
                                    const current =
                                      (metadata.selfieResolution as string) ??
                                      `${imageSelfieWidth}x${imageSelfieHeight}`;
                                    const val = `${opt.w}x${opt.h}`;
                                    const active = current === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => updateMeta.mutate({ id: chat.id, selfieResolution: val })}
                                        className={cn(
                                          "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors",
                                          active
                                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                            : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                        )}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                                {localizeUi(
                                  "ui.chat.chatsettingsdrawer.chooseASelfieConnectionToLetCharactersGenerateSelfie",
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.turnOnSelfiesToRevealConnectionPromptModelImage")}
                          </p>
                        )}
                      </AgentSettingsCard>
                    )}

                    {callsPackage ? (
                      <CapabilityElement
                        packageId={callsPackage.id}
                        view="settings"
                        capabilityProps={{
                          chatId: chat.id,
                          metadata,
                          connections: textConnectionsList,
                          expanded: callsSettingsOpen,
                          onExpandedChange: (expanded: boolean) =>
                            setChatSettingsSectionExpanded(callsSettingsMenuId, expanded),
                          updateMetadata: (patch: Record<string, unknown>) =>
                            updateMeta.mutate({ id: chat.id, ...patch }),
                        }}
                        className="block"
                      />
                    ) : null}

                    {ltmPackage ? (
                      <AgentSettingsCard
                        icon={<Archive size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                        title={localizeUi("ui.chat.chatsettingsdrawer.longTermMemory")}
                        description={localizeUi("ui.chat.chatsettingsdrawer.enableLongTermMemoryForThisConversation")}
                      >
                        <SettingsSwitch
                          label={localizeUi("ui.chat.chatsettingsdrawer.longTermMemory")}
                          description={localizeUi("ui.chat.chatsettingsdrawer.enableLongTermMemoryForThisConversation")}
                          checked={metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)}
                          onChange={(enabled) => {
                            void setLtmEnabledForChat(enabled).catch((error) => {
                              void showAlertDialog({
                                title: localizeUi("ui.chat.chatsettingsdrawer.longTermMemory"),
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : localizeUi("ui.chat.chatsettingsdrawer.failedToUpdateLongTermMemory"),
                              });
                            });
                          }}
                          labelPosition="start"
                          className={cn(
                            "justify-between rounded-lg px-3 py-2.5 text-left",
                            metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                          )}
                          labelClassName="text-xs font-medium"
                        />
                        <CapabilityElement
                          packageId={ltmPackage.id}
                          view="settings"
                          capabilityProps={{
                            chatId: chat.id,
                            enabledForChat: metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id),
                            chatSettings: {
                              longTermMemoryRecallStyle: metadata.longTermMemoryRecallStyle,
                              longTermMemoryBudgetTokens: metadata.longTermMemoryBudgetTokens,
                              longTermMemoryMaxChunks: metadata.longTermMemoryMaxChunks,
                            },
                            onEnabledForChatChange: setLtmEnabledForChat,
                            onChatSettingsChange: async (patch: Record<string, unknown>) => {
                              await updateMeta.mutateAsync({ id: chat.id, ...patch });
                            },
                            onOpenAgentSettings: () => {
                              void requestClose().then((closed) => {
                                if (closed) useUIStore.getState().openAgentDetail("long-term-memory");
                              });
                            },
                            onDirtyChange: setEditorDirty,
                          }}
                          className="block overflow-hidden rounded-lg"
                        />
                      </AgentSettingsCard>
                    ) : null}

                    {/* Schedule generation preferences — free-form authorial guidance */}
                    <label className="flex flex-col gap-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {localizeUi("ui.chat.chatsettingsdrawer.scheduleGenerationPreferences")}
                        <HelpTooltip
                          text={localizeUi(
                            "ui.chat.chatsettingsdrawer.freeFormGuidanceThatSteersHowCharacterSchedulesAre",
                          )}
                        />
                      </span>
                      <textarea
                        value={scheduleGenerationPreferences}
                        onChange={(e) => setScheduleGenerationPreferences(e.target.value)}
                        placeholder={localizeUi("ui.chat.chatsettingsdrawer.eGMakeEveryoneGoToSleepBeforeMidnight")}
                        className="min-h-[5rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 placeholder:text-[var(--muted-foreground)]/40"
                      />
                      <p className="text-[0.59375rem] text-[var(--muted-foreground)]/70">
                        {localizeUi("ui.chat.chatsettingsdrawer.globalSettingAppliesToEveryConversationChatSNext")}
                      </p>
                    </label>

                    {/* Active schedule-generation preference indicator */}
                    {scheduleGenerationPreferences.trim() && (
                      <div
                        className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2.5"
                        title={scheduleGenerationPreferences.trim()}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-[0.6875rem] font-medium leading-snug text-[var(--foreground)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.scheduleGenerationPreferenceActive")}
                          </span>
                          <p className="mt-0.5 truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                            "{scheduleGenerationPreferences.trim()}"
                          </p>
                          <p className="mt-1 text-[0.59375rem] text-[var(--muted-foreground)]/70">
                            {localizeUi("ui.chat.chatsettingsdrawer.willBeAppliedTheNextTimeSchedulesAreRegenerated")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {renderCustomAgentPicker()}
                {renderActiveCustomAgentSettingsCard()}
                {renderHapticSettingsCard()}
              </div>
            </Section>
          )}

          {/* Connected Roleplay — conversation mode: link to a roleplay or game chat */}
          {isConversation && (
            <Section
              id="conversation-connected-chats"
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
              icon={<ArrowRightLeft size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.controlAwarenessOfSiblingChatsOrLinkThisConversation")}
            >
              <div className="space-y-2">
                <SettingsSwitch
                  label={localizeUi("ui.chat.chatsettingsdrawer.crossChatAwareness")}
                  description={localizeUi("ui.chat.chatsettingsdrawer.charactersKnowWhatHappensInTheirOtherChats")}
                  checked={metadata.crossChatAwareness !== false}
                  onChange={(crossChatAwareness) => updateMeta.mutate({ id: chat.id, crossChatAwareness })}
                  labelPosition="start"
                  className={cn(
                    "justify-between rounded-md px-3 py-2.5 text-left",
                    metadata.crossChatAwareness !== false
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                  labelClassName="text-xs font-medium"
                />
                {chat.connectedChatId ? (
                  (() => {
                    const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                    const linkedMode =
                      linked?.mode === "conversation" || linked?.mode === "roleplay" || linked?.mode === "game"
                        ? linked.mode
                        : "roleplay";
                    return (
                      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                        {linked ? (
                          <ChatModeIcon mode={linkedMode} size="0.875rem" className="text-[var(--primary)]" />
                        ) : (
                          <ArrowRightLeft size="0.875rem" className="text-[var(--primary)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-xs font-medium">
                            {linked
                              ? getConnectedChatDisplayName(linked)
                              : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                          </span>
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {linked
                              ? linkedMode === "roleplay"
                                ? localizeUi("settings.modes.roleplay")
                                : linkedMode
                              : localizeUi("ui.chat.chatsettingsdrawer.deleted")}
                          </p>
                        </div>
                        <button
                          onClick={() => disconnectChat.mutate(chat.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title={localizeUi("ui.agents.agenteditor.disconnect")}
                        >
                          <Unlink size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })()
                ) : !showConnectionPicker ? (
                  <button
                    onClick={() => {
                      setShowConnectionPicker(true);
                      setConnectionSearch("");
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.linkToRoleplayOrGame")}
                  </button>
                ) : (
                  <PickerDropdown
                    search={connectionSearch}
                    onSearchChange={setConnectionSearch}
                    onClose={() => setShowConnectionPicker(false)}
                    placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchRoleplayOrGameChats")}
                  >
                    {((allChats ?? []) as Chat[])
                      .filter(
                        (c) =>
                          c.id !== chat.id &&
                          (c.mode === "roleplay" || c.mode === "game") &&
                          !c.connectedChatId &&
                          includesTextForMatch(getConnectedChatDisplayName(c), connectionSearch),
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            connectChat.mutate({ chatId: chat.id, targetChatId: c.id });
                            setShowConnectionPicker(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                        >
                          <ChatModeIcon
                            mode={c.mode}
                            size="0.75rem"
                            className="shrink-0 text-[var(--muted-foreground)]"
                          />
                          <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                        </button>
                      ))}
                  </PickerDropdown>
                )}
                {renderNoodleTimelineContextToggle()}
                <DiscordMirrorControls
                  webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                  onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
                />
              </div>
            </Section>
          )}

          {/* Connected Conversation — roleplay mode: linked OOC chat + optional in-world DM command */}
          {isRoleplayMode && (
            <Section
              id="roleplay-connected-chats"
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
              icon={<ArrowRightLeft size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.linkToAnOocConversationAndOptionallyLetRoleplay")}
            >
              <div className="space-y-2">
                {chat.connectedChatId ? (
                  (() => {
                    const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                    return (
                      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                        <ChatModeIcon mode="conversation" size="0.875rem" className="text-[var(--primary)]" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate text-xs font-medium">
                            {linked
                              ? getConnectedChatDisplayName(linked)
                              : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                          </span>
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {localizeUi("settings.modes.conversation")}
                          </p>
                        </div>
                        <button
                          onClick={() => disconnectChat.mutate(chat.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title={localizeUi("ui.agents.agenteditor.disconnect")}
                        >
                          <Unlink size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.noOocConversationIsLinkedDirectMessageCommandsCan")}
                  </p>
                )}

                {renderNoodleTimelineContextToggle()}

                <SettingsSwitch
                  label={localizeUi("ui.chat.chatsettingsdrawer.allowCharacterDms")}
                  description={localizeUi("ui.chat.chatsettingsdrawer.addsAShortHiddenCommandReminderSoCharactersCan")}
                  checked={metadata.roleplayDmCommandsEnabled === true}
                  onChange={(checked) => updateMeta.mutate({ id: chat.id, roleplayDmCommandsEnabled: checked })}
                  labelPosition="start"
                  className={cn(
                    "justify-between rounded-md px-3 py-2.5 text-left",
                    metadata.roleplayDmCommandsEnabled === true
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                  labelClassName="text-[0.6875rem] font-medium"
                />
                <DiscordMirrorControls
                  className="space-y-2"
                  webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                  onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
                />
              </div>
            </Section>
          )}

          {/* Connected Conversation — game mode: show linked OOC chat */}
          {isGame && chat.connectedChatId && (
            <Section
              id="game-connected-chats"
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
              icon={<ArrowRightLeft size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.linkedToAConversationInfluenceTagsFromTheConversation")}
            >
              <div className="space-y-2">
                {(() => {
                  const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                  return (
                    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                      <ChatModeIcon mode="conversation" size="0.875rem" className="text-[var(--primary)]" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-xs font-medium">
                          {linked
                            ? getConnectedChatDisplayName(linked)
                            : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                        </span>
                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          {localizeUi("settings.modes.conversation")}
                        </p>
                      </div>
                      <button
                        onClick={() => disconnectChat.mutate(chat.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title={localizeUi("ui.agents.agenteditor.disconnect")}
                      >
                        <Unlink size="0.6875rem" />
                      </button>
                    </div>
                  );
                })()}
                {renderNoodleTimelineContextToggle()}
                <DiscordMirrorControls
                  webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                  onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
                />
              </div>
            </Section>
          )}

          {/* Notes from Conversation — durable notes saved by the connected conversation's character */}
          {!isConversation && chat.connectedChatId && (
            <div style={{ order: CHAT_SETTINGS_ORDER.connectedNotes }}>
              <ConversationNotesSection chatId={chat.id} />
            </div>
          )}

          {/* Connect to Conversation — game mode without existing link */}
          {chatMode === "game" && !chat.connectedChatId && (
            <Section
              id="game-connected-chats"
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
              icon={<ArrowRightLeft size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.linkThisGameToAnOocConversationTheConversation")}
            >
              <div className="space-y-2">
                {!showConnectionPicker ? (
                  <button
                    onClick={() => {
                      setShowConnectionPicker(true);
                      setConnectionSearch("");
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.linkToConversation")}
                  </button>
                ) : (
                  <PickerDropdown
                    search={connectionSearch}
                    onSearchChange={setConnectionSearch}
                    onClose={() => setShowConnectionPicker(false)}
                    placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchConversationChats")}
                  >
                    {((allChats ?? []) as Chat[])
                      .filter(
                        (c) =>
                          c.id !== chat.id &&
                          c.mode === "conversation" &&
                          !c.connectedChatId &&
                          includesTextForMatch(getConnectedChatDisplayName(c), connectionSearch),
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            connectChat.mutate({ chatId: chat.id, targetChatId: c.id });
                            setShowConnectionPicker(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                        >
                          <ChatModeIcon
                            mode="conversation"
                            size="0.75rem"
                            className="shrink-0 text-[var(--muted-foreground)]"
                          />
                          <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                        </button>
                      ))}
                  </PickerDropdown>
                )}
                {renderNoodleTimelineContextToggle()}
                <DiscordMirrorControls
                  webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                  onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
                />
              </div>
            </Section>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.lorebooks }}>
            <LorebooksSection
              chatId={chat.id}
              activeLorebooks={activeLorebooks}
              lorebooks={(lorebooks ?? []) as Lorebook[]}
              lorebookSearch={lbSearch}
              lorebookTokenBudget={lorebookTokenBudget}
              showLorebookPicker={showLbPicker}
              onLorebookSearchChange={setLbSearch}
              onLorebookTokenBudgetChange={(lorebookTokenBudget) =>
                updateMeta.mutate({ id: chat.id, lorebookTokenBudget })
              }
              onShowLorebookPickerChange={setShowLbPicker}
              onEditLorebook={(lorebookId) => toggleInlineResourceEditor("lorebook", lorebookId)}
              editingLorebookId={inlineResourceEditor?.kind === "lorebook" ? inlineResourceEditor.id : null}
              inlineLorebookEditor={
                inlineResourceEditor?.kind === "lorebook" ? (
                  <Suspense
                    fallback={
                      <div className="mari-chat-settings-inline-editor mt-2 space-y-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5">
                        <div className="shimmer h-8 rounded-lg" />
                        <div className="shimmer h-9 rounded-lg" />
                        <div className="shimmer h-9 rounded-lg" />
                      </div>
                    }
                  >
                    <InlineLorebookEntriesEditor
                      key={inlineResourceEditor.id}
                      lorebookId={inlineResourceEditor.id}
                      lorebookName={
                        activeLorebooks.find((lorebook) => lorebook.id === inlineResourceEditor.id)?.name ?? "Lorebook"
                      }
                      characterRows={characters}
                      onClose={() => setInlineResourceEditor(null)}
                    />
                  </Suspense>
                ) : null
              }
              onToggleLorebook={toggleLorebook}
              onSetLorebookExcluded={setLorebookExcluded}
            />
          </div>

          {/* Agents */}
          {modeSettingsSurfaces.agentSettingsSurface === "generation" && (
            <Section
              id={`${chatMode}-agents`}
              style={{ order: CHAT_SETTINGS_ORDER.agents }}
              label={localizeUi("navigation.topbar.agents")}
              icon={<Sparkles size="0.875rem" />}
              count={isGame ? gameAgentFeatureCount : visibleActiveAgentIds.length}
              help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledAiAgentsRunAutomaticallyDuringGenerationTo")}
            >
              {availableAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-5 text-center">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.noAgentsDownloadedYet")}
                  </p>
                  <p className="mx-auto mt-1 max-w-[32rem] text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.downloadOptionalAgentsToAddTrackersWritersMapsAnd")}{" "}
                    {isGame
                      ? localizeUi("ui.chat.chatsettingsdrawer.game")
                      : localizeUi("ui.chat.chatsettingsdrawer.roleplay")}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={openDownloadAgents}
                    className="mari-chrome-control mari-chrome-control--primary mx-auto mt-3 px-4 py-2 text-xs"
                  >
                    <Sparkles size="0.8125rem" />
                    {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {isGame && metadata.enableAgents && (
                    <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.toggleSceneAnalysisAndCustomAgentsForThisGame")}
                    </p>
                  )}
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.enableAgents")}
                    description={
                      <>
                        <span className="block">
                          {isGame
                            ? localizeUi("ui.chat.chatsettingsdrawer.runSceneAnalysisAndAnyAttachedCustomAgentsDuring")
                            : localizeUi(
                                "ui.chat.chatsettingsdrawer.runAiAgentsDuringGenerationWorldStateExpressionsEtc",
                              )}
                        </span>
                        {isGame &&
                          metadata.enableAgents &&
                          (() => {
                            const setupCfg = metadata.gameSetupConfig as Record<string, unknown> | undefined;
                            const sceneConnId =
                              (metadata.gameSceneConnectionId as string) ||
                              (setupCfg?.sceneConnectionId as string) ||
                              null;
                            const sceneConn = sceneConnId
                              ? ((connections ?? []) as Array<{ id: string; name: string; model?: string }>).find(
                                  (connection) => connection.id === sceneConnId,
                                )
                              : null;
                            const connectionLabel = sceneConn
                              ? `${sceneConn.name}${sceneConn.model ? ` — ${sceneConn.model}` : ""}`
                              : "Local sidecar (Gemma)";
                            return <span className="mt-0.5 block text-[var(--primary)]/70">{connectionLabel}</span>;
                          })()}
                      </>
                    }
                    checked={metadata.enableAgents === true}
                    onChange={(enabled) => updateMeta.mutate({ id: chat.id, enableAgents: enabled })}
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-lg px-3 py-2.5 text-left",
                      metadata.enableAgents
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                    labelClassName="text-xs font-medium"
                  />
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.reviewAgentOutputs")}
                    description={
                      agentWriteApprovalRequired
                        ? localizeUi(
                            "ui.chat.chatsettingsdrawer.lorebookSummaryCharacterCardUpdatesAndReviewableWriterAgent",
                          )
                        : localizeUi(
                            "ui.chat.chatsettingsdrawer.lorebookAndSummaryUpdatesCanBeCommittedAutomaticallyCharacter",
                          )
                    }
                    enabled={agentWriteApprovalRequired}
                    surface="secondary"
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        agentWriteApprovalRequired: !agentWriteApprovalRequired,
                      })
                    }
                  />
                  {/* Manual trackers run only in roleplay-style chats. */}
                  {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                    <>
                      <AgentSettingsToggle
                        label={localizeUi("ui.chat.chatsettingsdrawer.manualTrackers")}
                        description={
                          metadata.manualTrackers
                            ? localizeUi("ui.chat.chatsettingsdrawer.trackersWonTRunAutomaticallyUseTheButtonIn")
                            : localizeUi("ui.chat.chatsettingsdrawer.trackersRunAutomaticallyAfterEveryGeneration")
                        }
                        enabled={metadata.manualTrackers === true}
                        surface="secondary"
                        onToggle={() => updateMeta.mutate({ id: chat.id, manualTrackers: !metadata.manualTrackers })}
                      />
                      <AgentSettingsToggle
                        label={localizeUi("ui.chat.chatsettingsdrawer.attachLorebooksToTrackers")}
                        description={localizeUi("ui.chat.chatsettingsdrawer.attachLorebooksToTrackersDescription")}
                        enabled={metadata.attachLorebooksToTrackers === true}
                        surface="secondary"
                        onToggle={() =>
                          updateMeta.mutate({
                            id: chat.id,
                            attachLorebooksToTrackers: !metadata.attachLorebooksToTrackers,
                          })
                        }
                      />
                    </>
                  )}
                  {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                    <div className="space-y-1.5 rounded-lg bg-[var(--background)]/45 p-2 ring-1 ring-[var(--border)]">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.individualTrackerSchedule")}
                        </span>
                        {metadata.manualTrackers === true && (
                          <span className="text-[0.5625rem] text-[var(--primary)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.allManual")}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {activeTrackerAgents.map((agent) => {
                          const manuallyTriggered = activeManualTrackerTypes.has(agent.id);
                          const globallyManual = metadata.manualTrackers === true;
                          return (
                            <SettingsSwitch
                              key={agent.id}
                              label={
                                <span className="flex min-w-0 items-center gap-2">
                                  <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-[0.625rem] font-medium">{agent.name}</span>
                                    <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                                      {globallyManual
                                        ? localizeUi("ui.chat.chatsettingsdrawer.controlledByManualTrackers")
                                        : manuallyTriggered
                                          ? localizeUi("ui.chat.chatsettingsdrawer.runsOnlyFromHudControls")
                                          : localizeUi("ui.chat.chatsettingsdrawer.runsAutomatically")}
                                    </span>
                                  </span>
                                </span>
                              }
                              checked={manuallyTriggered}
                              onChange={() => toggleManualTrackerAgent(agent.id)}
                              disabled={globallyManual}
                              labelPosition="start"
                              className={cn(
                                "justify-between rounded-md px-2 py-1.5 text-left",
                                manuallyTriggered
                                  ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/25"
                                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                              )}
                              labelClassName="min-w-0"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isRoleplayMode && (activeGeneration || stoppingGeneration) && (
                    <button
                      type="button"
                      onClick={() => void handleStopActiveGeneration()}
                      disabled={stoppingGeneration}
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[0.6875rem] font-medium">
                          {stoppingGeneration
                            ? localizeUi("ui.chat.chatsettingsdrawer.stoppingGeneration")
                            : localizeUi("ui.chat.chatsettingsdrawer.stopActiveGeneration")}
                        </span>
                        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.stopActiveGenerationDescription")}
                        </p>
                      </div>
                      {stoppingGeneration ? (
                        <Loader2 size="0.8125rem" className="shrink-0 animate-spin text-[var(--muted-foreground)]" />
                      ) : (
                        <X size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAgentSuiteModal(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.6875rem] font-medium">
                        {localizeUi("ui.chat.agentsuitemodal.agentSuite")}
                      </span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.viewAndEditEverythingAgentsHaveStoredInThis")}
                      </p>
                    </div>
                    <div className="flex h-5 w-9 shrink-0 items-center justify-center text-[var(--muted-foreground)]">
                      <Wrench size="0.75rem" />
                    </div>
                  </button>
                  {roleplayAgentMenuLinks.length > 0 && (
                    <div className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        <ChevronRight size="0.6875rem" className="shrink-0" />
                        <span>{localizeUi("ui.chat.chatsettingsdrawer.agentMenus")}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleplayAgentMenuLinks.map((link) => (
                          <button
                            key={link.id}
                            type="button"
                            onClick={() => scrollToAgentMenu(link.targetId)}
                            className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/60"
                            title={localizeUi("ui.chat.chatsettingsdrawer.jumpToValue1", { value1: link.label })}
                          >
                            {renderRoleplayAgentMenuIcon(link.id, "chip")}
                            <span className="min-w-0 truncate">{link.label}</span>
                            {link.count != null && (
                              <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)]">
                                {link.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isGame && metadata.enableAgents && (
                    <div className="mt-1.5 px-3">
                      <select
                        value={(metadata.gameSceneConnectionId as string) ?? ""}
                        onChange={(e) =>
                          updateMeta.mutate({ id: chat.id, gameSceneConnectionId: e.target.value || null })
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                      >
                        {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                          <option value="">{localizeUi("ui.chat.chatsettingsdrawer.localSidecarGemma")}</option>
                        )}
                        {(textConnectionsList as Array<{ id: string; name: string; model?: string }>).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.model ? localizeUi("ui.chat.datablock.value1", { value1: c.model }) : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isGame && (
                    <AgentSettingsCard
                      icon={<BookOpen size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                      title={lorebookKeeperAgentMeta.name}
                      description={lorebookKeeperAgentMeta.description}
                    >
                      <AgentSettingsToggle
                        label={localizeUi("ui.chat.chatsettingsdrawer.gameSessionKeeper")}
                        description={localizeUi("ui.chat.chatsettingsdrawer.gameModeRunsThisAfterASessionEndsWith")}
                        enabled={gameLorebookKeeperEnabled}
                        onToggle={toggleGameLorebookKeeper}
                      />
                      {gameLorebookKeeperLorebook && (
                        <p className="truncate rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.target")}{" "}
                          <span className="font-medium text-[var(--foreground)]">
                            {gameLorebookKeeperLorebook.name}
                          </span>
                        </p>
                      )}
                    </AgentSettingsCard>
                  )}

                  {isGame && (
                    <AgentSettingsCard
                      icon={<Music2 size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                      title={musicDjAgentMeta.name}
                      description={musicDjAgentMeta.description}
                    >
                      <AgentSettingsToggle
                        label={localizeUi("ui.chat.chatsettingsdrawer.musicDj")}
                        description={localizeUi("ui.chat.chatsettingsdrawer.activePlayerValue1", {
                          value1: getMusicProviderLabel(musicPlayerSource),
                        })}
                        enabled={gameMusicDjEnabled}
                        onToggle={() => void toggleGameMusicDj()}
                      />

                      <AgentSettingsSegmentedControl<MusicProvider>
                        value={musicPlayerSource}
                        columns={3}
                        options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                          id: provider,
                          label: getMusicProviderLabel(provider),
                        }))}
                        onChange={(provider) => void changeMusicDjProvider(provider)}
                      />

                      {gameMusicDjEnabled && musicPlayerSource === "spotify" && (
                        <div className="space-y-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.spotifySource")}
                            </span>
                            <select
                              value={gameSpotifySourceType}
                              onChange={(event) => {
                                const next = normalizeSpotifySourceType(event.target.value);
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameSpotifySourceType: next,
                                  gameSpotifyPlaylistId: next === "playlist" ? gameSpotifyPlaylistId || null : null,
                                  gameSpotifyPlaylistName:
                                    next === "playlist" ? (metadata.gameSpotifyPlaylistName as string) || null : null,
                                  gameSpotifyArtist: next === "artist" ? gameSpotifyArtistDraft.trim() || null : null,
                                });
                              }}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                            >
                              {SPOTIFY_SOURCE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                              {SPOTIFY_SOURCE_OPTIONS.find((option) => option.id === gameSpotifySourceType)
                                ?.description ?? ""}
                            </span>
                          </label>

                          {gameSpotifySourceType === "playlist" && (
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.musicdjsetupfields.playlist")}
                              </span>
                              {spotifyPlaylistsQuery.data?.playlists.length ? (
                                <select
                                  value={gameSpotifyPlaylistId}
                                  onChange={(event) => {
                                    const playlist = spotifyPlaylistsQuery.data?.playlists.find(
                                      (entry) => entry.id === event.target.value,
                                    );
                                    updateMeta.mutate({
                                      id: chat.id,
                                      gameSpotifyPlaylistId: event.target.value || null,
                                      gameSpotifyPlaylistName: playlist?.name ?? null,
                                    });
                                  }}
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                                >
                                  <option value="">{localizeUi("ui.chat.musicdjsetupfields.choosePlaylist")}</option>
                                  {spotifyPlaylistsQuery.data.playlists.map((playlist) => {
                                    const suffix =
                                      typeof playlist.trackCount === "number"
                                        ? ` (${playlist.trackCount})`
                                        : playlist.owned === false
                                          ? " (followed — unavailable)"
                                          : "";
                                    return (
                                      <option key={playlist.id} value={playlist.id}>
                                        {playlist.name}
                                        {suffix}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : (
                                <input
                                  key={`${chat.id}-${gameSpotifyPlaylistId}`}
                                  defaultValue={gameSpotifyPlaylistId}
                                  onBlur={(event) =>
                                    updateMeta.mutate({
                                      id: chat.id,
                                      gameSpotifyPlaylistId: event.target.value.trim() || null,
                                      gameSpotifyPlaylistName: null,
                                    })
                                  }
                                  placeholder={
                                    spotifyPlaylistsQuery.isFetching
                                      ? localizeUi("ui.chat.musicdjsetupfields.loadingPlaylists")
                                      : localizeUi("ui.chat.musicdjsetupfields.pastePlaylistId")
                                  }
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                />
                              )}
                              {spotifyPlaylistsQuery.isError && (
                                <span className="text-[0.5625rem] text-amber-400/90">
                                  {localizeUi("ui.chat.musicdjsetupfields.connectSpotifyInTheMusicDjAgentToLoad")}
                                </span>
                              )}
                            </label>
                          )}

                          {gameSpotifySourceType === "artist" && (
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.musicdjsetupfields.artist")}
                              </span>
                              <input
                                value={gameSpotifyArtistDraft}
                                onChange={(event) => setGameSpotifyArtistDraft(event.target.value)}
                                onBlur={() =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    gameSpotifyArtist: gameSpotifyArtistDraft.trim() || null,
                                  })
                                }
                                placeholder={localizeUi("ui.chat.musicdjsetupfields.hoyoMix")}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {gameMusicDjEnabled && musicPlayerSource === "custom" && renderCustomMusicLibrarySettings("game")}
                    </AgentSettingsCard>
                  )}

                  {!isGame && (
                    <div className="flex flex-col gap-2">
                      {metadata.enableAgents && !isGame && lorebookKeeperActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "lorebook-keeper")}
                          icon={renderRoleplayAgentMenuIcon("lorebook-keeper")}
                          title={lorebookKeeperAgentMeta.name}
                          description={lorebookKeeperAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("lorebook-keeper")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("lorebook-keeper", lorebookKeeperAgentMeta.name)}
                        >
                          <div className="flex flex-col items-stretch gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
                            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.chatLorebookKeeperRunsAfterAssistantRepliesGameMode",
                              )}
                            </p>
                            <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
                              <AgentSettingsActionButton
                                onClick={() => {
                                  onClose();
                                  useUIStore.getState().openAgentDetail("lorebook-keeper");
                                }}
                                className="!h-8 !min-h-8 w-full whitespace-nowrap !py-0 sm:w-auto"
                              >
                                <Settings2 size="0.75rem" />
                                <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
                              </AgentSettingsActionButton>
                              <AgentSettingsActionButton
                                onClick={handleLorebookKeeperBackfill}
                                disabled={agentProcessing}
                                className="!h-8 !min-h-8 w-full whitespace-nowrap !py-0 sm:w-auto"
                                variant="primary"
                              >
                                <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
                                <span>{localizeUi("ui.chat.chatsettingsdrawer.backfillUnprocessed")}</span>
                              </AgentSettingsActionButton>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
                              <span className="font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.agentaddsetupfields.targetLorebook")}
                              </span>
                              <select
                                value={lorebookKeeperTargetLorebookId}
                                onChange={(e) =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    lorebookKeeperTargetLorebookId: e.target.value || null,
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                              >
                                <option value="">
                                  {localizeUi("ui.chat.agentaddsetupfields.autoSelectFirstWritableLorebook")}
                                </option>
                                {((lorebooks ?? []) as Array<{ id: string; name: string }>).map((lorebook) => (
                                  <option key={lorebook.id} value={lorebook.id}>
                                    {lorebook.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
                              <span className="font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.agentaddsetupfields.readBehind")}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={lorebookKeeperReadBehindMessages}
                                onChange={(e) => {
                                  const nextValue = e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10);
                                  updateMeta.mutate({
                                    id: chat.id,
                                    lorebookKeeperReadBehindMessages: Number.isFinite(nextValue)
                                      ? Math.max(0, Math.min(100, nextValue))
                                      : 0,
                                  });
                                }}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                              />
                            </label>
                          </div>

                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.readBehindUsesAssistantMessages0MeansTheNewest")}
                          </p>
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && !isGame && cardEvolutionAuditorActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "card-evolution-auditor")}
                          icon={renderRoleplayAgentMenuIcon("card-evolution-auditor")}
                          title={cardEvolutionAuditorAgentMeta.name}
                          description={cardEvolutionAuditorAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("card-evolution-auditor")}
                          onRemove={getRoleplayAgentMenuRemoveHandler(
                            "card-evolution-auditor",
                            cardEvolutionAuditorAgentMeta.name,
                          )}
                        >
                          <div className="space-y-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                            <p className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.thisAgentNeverEditsCardsDirectlyItProposesExact")}
                            </p>
                            <AgentSettingsActionButton
                              onClick={() => {
                                onClose();
                                useUIStore.getState().openAgentDetail("card-evolution-auditor");
                              }}
                              variant="primary"
                            >
                              <Settings2 size="0.75rem" />
                              <span>{localizeUi("ui.chat.chatsettingsdrawer.openAuditorSetup")}</span>
                            </AgentSettingsActionButton>
                          </div>
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && !isGame && proseGuardianActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "prose-guardian")}
                          icon={renderRoleplayAgentMenuIcon("prose-guardian")}
                          title={proseGuardianAgentMeta.name}
                          description={proseGuardianAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("prose-guardian")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("prose-guardian", proseGuardianAgentMeta.name)}
                        >
                          <AgentSettingsTextarea
                            label={localizeUi("ui.agents.agenteditor.bannedWords")}
                            value={proseGuardianBannedDraft}
                            placeholder={DEFAULT_PROSE_GUARDIAN_BANNED_WORDS}
                            rows={2}
                            onChange={setProseGuardianBannedDraft}
                            onBlur={() => {
                              if (proseGuardianBannedDraft !== proseGuardianBannedWords) {
                                commitProseGuardianSettings({
                                  proseGuardianBannedWords: proseGuardianBannedDraft.trim(),
                                });
                              }
                            }}
                          />
                          <AgentSettingsTextarea
                            label={localizeUi("ui.agents.agenteditor.removeFromWriting")}
                            value={proseGuardianAvoidDraft}
                            placeholder={DEFAULT_PROSE_GUARDIAN_AVOID}
                            rows={3}
                            onChange={setProseGuardianAvoidDraft}
                            onBlur={() => {
                              if (proseGuardianAvoidDraft !== proseGuardianAvoidInstructions) {
                                commitProseGuardianSettings({
                                  proseGuardianAvoidInstructions: proseGuardianAvoidDraft.trim(),
                                });
                              }
                            }}
                          />
                          <AgentSettingsTextarea
                            label={localizeUi("ui.agents.agenteditor.preferInWriting")}
                            value={proseGuardianStyleDraft}
                            placeholder={localizeUi(
                              "ui.agents.agenteditor.optionalStyleNotesPhrasesOrAuthorialPreferences",
                            )}
                            rows={3}
                            onChange={setProseGuardianStyleDraft}
                            onBlur={() => {
                              if (proseGuardianStyleDraft !== proseGuardianStyleInstructions) {
                                commitProseGuardianSettings({
                                  proseGuardianStyleInstructions: proseGuardianStyleDraft.trim(),
                                });
                              }
                            }}
                          />
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.holdMessageUntilRewrite")}
                            description={
                              proseGuardianHoldForRewrite
                                ? localizeUi(
                                    "ui.chat.agentaddsetupfields.showTheRewriteWorkingIndicatorThenRevealTheEdited",
                                  )
                                : localizeUi(
                                    "ui.chat.chatsettingsdrawer.streamTheOriginalMessageNormallyThenReplaceItWhen",
                                  )
                            }
                            enabled={proseGuardianHoldForRewrite}
                            onToggle={() =>
                              commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                            }
                          />
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && !isGame && directorActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "director")}
                          icon={renderRoleplayAgentMenuIcon("director")}
                          title={directorAgentMeta.name}
                          description={directorAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("director")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("director", directorAgentMeta.name)}
                        >
                          <p className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                            {localizeUi("ui.chat.agentaddsetupfields.chooseBetweenANaturalOrRandomPushEachTime")}
                          </p>
                          {supportsNarrativeDirectorSecretPlot && (
                            <div className="mt-2 space-y-2">
                              <AgentSettingsToggle
                                label={localizeUi("ui.agents.agenteditor.secretPlot")}
                                description={localizeUi(
                                  "ui.chat.chatsettingsdrawer.maintainAHiddenLongTermArcForThisRoleplay",
                                )}
                                enabled={narrativeDirectorSecretPlotEnabled}
                                onToggle={() =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    narrativeDirectorSecretPlotEnabled: !narrativeDirectorSecretPlotEnabled,
                                  })
                                }
                              />
                              {narrativeDirectorSecretPlotEnabled && (
                                <>
                                  <label className="block rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]">
                                    <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                      {localizeUi("ui.agents.agenteditor.runInterval")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <DraftNumberInput
                                        value={narrativeDirectorSecretPlotRunInterval}
                                        min={1}
                                        max={100}
                                        onCommit={(value) =>
                                          updateMeta.mutate({
                                            id: chat.id,
                                            narrativeDirectorSecretPlotRunInterval: value,
                                          })
                                        }
                                        className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                                      />
                                      <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                                        {localizeUi("ui.agents.agenteditor.assistantMessages")}
                                      </span>
                                    </div>
                                  </label>
                                  <SecretPlotPanel
                                    chatId={chat.id}
                                    messages={secretPlotMessages}
                                    isAgentProcessing={agentProcessing}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && !isGame && continuityActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "continuity")}
                          icon={renderRoleplayAgentMenuIcon("continuity")}
                          title={continuityAgentMeta.name}
                          description={continuityAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("continuity")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("continuity", continuityAgentMeta.name)}
                        >
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.holdMessageUntilRewrite")}
                            description={
                              proseGuardianHoldForRewrite
                                ? localizeUi(
                                    "ui.chat.agentaddsetupfields.showTheRewriteWorkingIndicatorThenRevealTheEdited",
                                  )
                                : localizeUi(
                                    "ui.chat.chatsettingsdrawer.streamTheOriginalMessageNormallyThenReplaceItWhen",
                                  )
                            }
                            enabled={proseGuardianHoldForRewrite}
                            onToggle={() =>
                              commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                            }
                          />
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && !isGame && htmlActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "html")}
                          icon={renderRoleplayAgentMenuIcon("html")}
                          title={htmlAgentMeta.name}
                          description={htmlAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("html")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("html", htmlAgentMeta.name)}
                        >
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.holdMessageUntilRewrite")}
                            description={
                              proseGuardianHoldForRewrite
                                ? localizeUi(
                                    "ui.chat.agentaddsetupfields.showTheRewriteWorkingIndicatorThenRevealTheEdited",
                                  )
                                : localizeUi(
                                    "ui.chat.chatsettingsdrawer.streamTheOriginalMessageNormallyThenReplaceItWhen",
                                  )
                            }
                            enabled={proseGuardianHoldForRewrite}
                            onToggle={() =>
                              commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                            }
                          />
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && isRoleplayMode && knowledgeRetrievalActive && (
                        <KnowledgeAgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "knowledge-retrieval")}
                          agentType="knowledge-retrieval"
                          title={knowledgeRetrievalAgentMeta.name}
                          description={knowledgeRetrievalAgentMeta.description}
                          lorebooks={(lorebooks ?? []) as Lorebook[]}
                          settings={getKnowledgeAgentSourceSettings("knowledge-retrieval")}
                          order={getRoleplayAgentSettingsOrder("knowledge-retrieval")}
                          onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-retrieval", patch)}
                          onRemove={getRoleplayAgentMenuRemoveHandler(
                            "knowledge-retrieval",
                            knowledgeRetrievalAgentMeta.name,
                          )}
                        />
                      )}

                      {metadata.enableAgents && isRoleplayMode && knowledgeRouterActive && (
                        <KnowledgeAgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "knowledge-router")}
                          agentType="knowledge-router"
                          title={knowledgeRouterAgentMeta.name}
                          description={knowledgeRouterAgentMeta.description}
                          lorebooks={(lorebooks ?? []) as Lorebook[]}
                          settings={getKnowledgeAgentSourceSettings("knowledge-router")}
                          order={getRoleplayAgentSettingsOrder("knowledge-router")}
                          onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-router", patch)}
                          onRemove={getRoleplayAgentMenuRemoveHandler(
                            "knowledge-router",
                            knowledgeRouterAgentMeta.name,
                          )}
                        />
                      )}

                      {standaloneRoleplayAgents.map(renderStandaloneRoleplayAgentSettingsCard)}

                      {metadata.enableAgents && !isGame && expressionActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "expression")}
                          icon={renderRoleplayAgentMenuIcon("expression")}
                          title={expressionAgentMeta.name}
                          description={expressionAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("expression")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("expression", expressionAgentMeta.name)}
                          badge={
                            spriteCharacterIds.length > 0 ? (
                              <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
                                {spriteCharacterIds.length} {localizeUi("ui.chat.chatsettingsdrawer.enabled")}
                              </span>
                            ) : null
                          }
                        >
                          <ExpressionSpriteSettings
                            chatId={chat.id}
                            displayModes={spriteDisplayModes}
                            onToggleDisplayMode={toggleSpriteDisplayMode}
                            expressionAvatarsEnabled={expressionAvatarsEnabled}
                            onToggleExpressionAvatars={() => {
                              const nextEnabled = !expressionAvatarsEnabled;
                              if (onSpriteVisualSettingsChange) {
                                onSpriteVisualSettingsChange({ expressionAvatarsEnabled: nextEnabled });
                                return;
                              }
                              updateMeta.mutate({ id: chat.id, expressionAvatarsEnabled: nextEnabled });
                            }}
                            ownerCount={chatSpriteSubjects.length}
                            ownersLoading={chatSpriteSubjectsLoading}
                            choicesLoading={chatSpriteChoicesLoading}
                            owners={chatSpriteSubjectsWithSprites.map((subject) => {
                              const isPersona = subject.kind === "persona";
                              return {
                                id: subject.id,
                                kind: subject.kind,
                                name: isPersona ? subject.persona.name : charName(subject.character),
                                title: isPersona ? subject.persona.comment || "Persona" : charTitle(subject.character),
                                avatarPath: isPersona ? subject.persona.avatarPath : subject.character.avatarPath,
                                avatarCrop: isPersona
                                  ? (subject.persona.avatarCrop ?? null)
                                  : (getCharacterInfo(subject.character).avatarCrop ?? null),
                                active: spriteCharacterIds.includes(subject.id),
                              };
                            })}
                            onOpenOwner={(kind, id) => {
                              onClose();
                              if (kind === "persona") {
                                useUIStore.getState().openPersonaDetail(id);
                              } else {
                                useUIStore.getState().openCharacterDetail(id);
                              }
                            }}
                            onToggleOwner={toggleSprite}
                            enabledOwnerCount={spriteCharacterIds.length}
                            layoutSubjects={spriteLayoutSubjects}
                            selectedLayoutSubjectId={selectedSpriteLayoutCharacterId}
                            onSelectLayoutSubject={setSelectedSpriteLayoutCharacterId}
                            selectedLayoutSubjectHasOverride={Boolean(selectedSpriteCharacterVisualSettings)}
                            onResetSelectedLayoutSubject={resetSelectedSpriteCharacterVisualSettings}
                            spriteArrangeMode={spriteArrangeMode}
                            onToggleSpriteArrange={onToggleSpriteArrange}
                            hasCustomSpritePlacements={hasCustomSpritePlacements}
                            onResetSpritePlacements={resetSpritePlacements}
                            spritePosition={editedSpritePosition}
                            onSpritePositionChange={setSpriteSide}
                            expressionSpriteScalePercent={expressionSpriteScalePercent}
                            fullBodySpriteScalePercent={fullBodySpriteScalePercent}
                            expressionSpriteOpacityPercent={expressionSpriteOpacityPercent}
                            fullBodySpriteOpacityPercent={fullBodySpriteOpacityPercent}
                            onExpressionSpriteScaleChange={setExpressionSpriteScale}
                            onFullBodySpriteScaleChange={setFullBodySpriteScale}
                            onExpressionSpriteOpacityChange={setExpressionSpriteOpacity}
                            onFullBodySpriteOpacityChange={setFullBodySpriteOpacity}
                          />
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && isRoleplayMode && echoChamberActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "echo-chamber")}
                          icon={renderRoleplayAgentMenuIcon("echo-chamber")}
                          title={echoChamberAgentMeta.name}
                          description={echoChamberAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("echo-chamber")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("echo-chamber", echoChamberAgentMeta.name)}
                        >
                          <AgentPromptTemplateSelect
                            options={getPromptOptionsForAgent("echo-chamber")}
                            selectedId={
                              agentPromptTemplateSelections["echo-chamber"] ??
                              getDefaultPromptTemplateIdForAgent("echo-chamber")
                            }
                            overridden={typeof agentPromptTemplateSelections["echo-chamber"] === "string"}
                            onChange={(promptTemplateId) =>
                              updateAgentPromptTemplateSelection("echo-chamber", promptTemplateId)
                            }
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.promptModeControlsTheFictionalAudienceStyleUsedFor",
                              )}
                            </p>
                            <AgentSettingsActionButton
                              onClick={() => {
                                onClose();
                                useUIStore.getState().openAgentDetail("echo-chamber");
                              }}
                              className="shrink-0"
                            >
                              <Settings2 size="0.75rem" />
                              <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
                            </AgentSettingsActionButton>
                          </div>
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && isRoleplayMode && illustratorActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "illustrator")}
                          icon={renderRoleplayAgentMenuIcon("illustrator")}
                          title={illustratorAgentMeta.name}
                          description={illustratorAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("illustrator")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("illustrator", illustratorAgentMeta.name)}
                        >
                          <AgentPromptTemplateSelect
                            options={getPromptOptionsForAgent("illustrator")}
                            selectedId={
                              agentPromptTemplateSelections["illustrator"] ??
                              getDefaultPromptTemplateIdForAgent("illustrator")
                            }
                            overridden={typeof agentPromptTemplateSelections["illustrator"] === "string"}
                            onChange={(promptTemplateId) =>
                              updateAgentPromptTemplateSelection("illustrator", promptTemplateId)
                            }
                          />
                          {renderIllustratorPromptConnectionSelect()}
                          {renderIllustratorImageConnectionSelect()}
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.chatsettingsdrawer.generateSceneBackgrounds")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.whenTheStoryEntersANewLocationLetIllustrator",
                            )}
                            enabled={illustratorAutoBackgroundsEnabled}
                            onToggle={toggleIllustratorAutoBackgrounds}
                          />
                          {renderIllustratorImageStyleSelect({
                            description:
                              "Shared by Illustrator scenes and generated backgrounds so both keep the same visual language.",
                          })}
                          {renderIllustratorImagesPerGeneration()}
                          <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi(
                              "ui.chat.chatsettingsdrawer.usesTheBackgroundResolutionFromSettingsGenerationsTrackerLocations",
                            )}
                          </p>
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                            description={localizeUi(
                              "ui.chat.agentaddsetupfields.appendMatchedCharacterAppearanceLinesToImagePromptsUsing",
                            )}
                            enabled={illustratorIncludeCharacterAppearance}
                            onToggle={toggleIllustratorCharacterAppearance}
                            overridden={typeof metadata.illustratorIncludeCharacterAppearance === "boolean"}
                            onReset={resetIllustratorCharacterAppearance}
                          />
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                            description={localizeUi(
                              "ui.chat.agentaddsetupfields.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                            )}
                            enabled={illustratorUseAvatarReferences}
                            onToggle={toggleIllustratorAvatarReferences}
                            overridden={typeof metadata.illustratorUseAvatarReferences === "boolean"}
                            onReset={resetIllustratorAvatarReferences}
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.promptModeControlsHowIllustratorWritesImagePromptsFor",
                              )}
                            </p>
                            <AgentSettingsActionButton
                              onClick={() => {
                                onClose();
                                useUIStore.getState().openAgentDetail("illustrator");
                              }}
                              className="shrink-0"
                            >
                              <Settings2 size="0.75rem" />
                              <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
                            </AgentSettingsActionButton>
                          </div>
                          {illustratorInstalled && (
                            <AgentSettingsSubsection
                              id="scene-videos"
                              title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.generateManualMp4SceneVideosFromGalleryImages",
                              )}
                            >
                              <label className="flex flex-col gap-1">
                                <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                                </span>
                                <select
                                  value={(metadata.sceneVideoConnectionId as string) ?? ""}
                                  onChange={(e) =>
                                    updateMeta.mutate({ id: chat.id, sceneVideoConnectionId: e.target.value || null })
                                  }
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                                >
                                  <option value="">
                                    {localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}
                                  </option>
                                  {(videoConnectionsList ?? []).map(
                                    (c: { id: string; name: string; model?: string }) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                        {c.model
                                          ? localizeUi("ui.chat.chatsettingsdrawer.value1", { value1: c.model })
                                          : ""}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              {videoConnectionsList.length === 0 && (
                                <p className="text-[0.625rem] text-amber-700 dark:text-amber-400/80">
                                  {localizeUi(
                                    "ui.chat.chatsettingsdrawer.noVideoGenerationConnectionsFoundAddOneInSettings",
                                  )}
                                </p>
                              )}
                              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                                {localizeUi(
                                  "ui.chat.chatsettingsdrawer.galleryVideoAndImageAnimateUseThisConnectionWith",
                                )}
                              </p>
                            </AgentSettingsSubsection>
                          )}
                        </AgentSettingsCard>
                      )}

                      {metadata.enableAgents && isRoleplayMode && spotifyActive && (
                        <AgentSettingsCard
                          id={getAgentSettingsMenuId(chat.id, "spotify")}
                          icon={renderRoleplayAgentMenuIcon("spotify")}
                          title={musicDjAgentMeta.name}
                          description={musicDjAgentMeta.description}
                          order={getRoleplayAgentSettingsOrder("spotify")}
                          onRemove={getRoleplayAgentMenuRemoveHandler("spotify", musicDjAgentMeta.name)}
                        >
                          <p className="text-[0.55rem] text-[var(--muted-foreground)]/80">
                            {localizeUi("ui.chat.musicdjsetupfields.activePlayer")}{" "}
                            {getMusicProviderLabel(musicPlayerSource)}.
                          </p>

                          <AgentSettingsSegmentedControl<MusicProvider>
                            value={musicPlayerSource}
                            columns={3}
                            options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                              id: provider,
                              label: getMusicProviderLabel(provider),
                            }))}
                            onChange={(provider) => void changeMusicDjProvider(provider)}
                          />

                          {musicPlayerSource === "spotify" && (
                            <>
                              <label className="flex flex-col gap-1">
                                <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.spotifySource")}
                                </span>
                                <select
                                  value={spotifySourceType}
                                  onChange={(event) => {
                                    const next = normalizeSpotifySourceType(event.target.value);
                                    updateMeta.mutate({
                                      id: chat.id,
                                      spotifySourceType: next,
                                      spotifyPlaylistId: next === "playlist" ? spotifyPlaylistId || null : null,
                                      spotifyPlaylistName:
                                        next === "playlist" ? (metadata.spotifyPlaylistName as string) || null : null,
                                      spotifyArtist: next === "artist" ? spotifyArtistDraft.trim() || null : null,
                                    });
                                  }}
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                                >
                                  {SPOTIFY_SOURCE_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                                  {SPOTIFY_SOURCE_OPTIONS.find((option) => option.id === spotifySourceType)
                                    ?.description ?? ""}
                                </span>
                              </label>

                              {spotifySourceType === "playlist" && (
                                <label className="flex flex-col gap-1">
                                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                    {localizeUi("ui.chat.musicdjsetupfields.playlist")}
                                  </span>
                                  {spotifyPlaylistsQuery.data?.playlists.length ? (
                                    <select
                                      value={spotifyPlaylistId}
                                      onChange={(event) => {
                                        const playlist = spotifyPlaylistsQuery.data?.playlists.find(
                                          (entry) => entry.id === event.target.value,
                                        );
                                        updateMeta.mutate({
                                          id: chat.id,
                                          spotifyPlaylistId: event.target.value || null,
                                          spotifyPlaylistName: playlist?.name ?? null,
                                        });
                                      }}
                                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                                    >
                                      <option value="">
                                        {localizeUi("ui.chat.musicdjsetupfields.choosePlaylist")}
                                      </option>
                                      {spotifyPlaylistsQuery.data.playlists.map((playlist) => {
                                        const suffix =
                                          typeof playlist.trackCount === "number"
                                            ? ` (${playlist.trackCount})`
                                            : playlist.owned === false
                                              ? " (followed, unavailable)"
                                              : "";
                                        return (
                                          <option key={playlist.id} value={playlist.id}>
                                            {playlist.name}
                                            {suffix}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : (
                                    <input
                                      key={`${chat.id}-${spotifyPlaylistId}`}
                                      defaultValue={spotifyPlaylistId}
                                      onBlur={(event) =>
                                        updateMeta.mutate({
                                          id: chat.id,
                                          spotifyPlaylistId: event.target.value.trim() || null,
                                          spotifyPlaylistName: null,
                                        })
                                      }
                                      placeholder={
                                        spotifyPlaylistsQuery.isFetching
                                          ? localizeUi("ui.chat.musicdjsetupfields.loadingPlaylists")
                                          : localizeUi("ui.chat.musicdjsetupfields.pastePlaylistId")
                                      }
                                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                    />
                                  )}
                                  {spotifyPlaylistsQuery.isError && (
                                    <span className="text-[0.5625rem] text-amber-400/90">
                                      {localizeUi("ui.chat.musicdjsetupfields.connectSpotifyInTheMusicDjAgentToLoad")}
                                    </span>
                                  )}
                                </label>
                              )}

                              {spotifySourceType === "artist" && (
                                <label className="flex flex-col gap-1">
                                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                    {localizeUi("ui.chat.musicdjsetupfields.artist")}
                                  </span>
                                  <input
                                    value={spotifyArtistDraft}
                                    onChange={(event) => setSpotifyArtistDraft(event.target.value)}
                                    onBlur={() =>
                                      updateMeta.mutate({
                                        id: chat.id,
                                        spotifyArtist: spotifyArtistDraft.trim() || null,
                                      })
                                    }
                                    placeholder={localizeUi("ui.chat.musicdjsetupfields.hoyoMix")}
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                  />
                                </label>
                              )}
                            </>
                          )}

                          {musicPlayerSource === "custom" && renderCustomMusicLibrarySettings("roleplay")}

                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {musicPlayerSource === "spotify"
                              ? localizeUi(
                                  "ui.chat.chatsettingsdrawer.roleplayDjQueuesSeveralFittingTracksWhenItChanges",
                                )
                              : musicPlayerSource === "youtube"
                                ? localizeUi("ui.chat.chatsettingsdrawer.youtubeModeUsesTheMusicDjAgentSYoutube")
                                : customMusicSource === "folder"
                                  ? localizeUi(
                                      "ui.chat.chatsettingsdrawer.customModePicksFromTheSelectedDeviceFolderAnd",
                                    )
                                  : localizeUi("ui.chat.chatsettingsdrawer.customModePicksFromLocalGameAssetsMusicAnd")}
                          </p>
                        </AgentSettingsCard>
                      )}

                      {renderActiveCustomAgentSettingsCard()}
                    </div>
                  )}

                  {/* Haptic Feedback */}
                  {renderHapticSettingsCard()}

                  {/* Illustrator — game mode only */}
                  {isGame && (
                    <AgentSettingsCard
                      id={getAgentSettingsMenuId(chat.id, "illustrator")}
                      icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                      title={localizeUi("ui.chat.chatsettingsdrawer.illustrator")}
                      description={localizeUi(
                        "ui.chat.chatsettingsdrawer.autoGenerateSceneIllustrationsNpcPortraitsAndLocationBackgrounds",
                      )}
                    >
                      <GenerationSettingsLink
                        onClick={openGenerationSettings}
                        title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                        label={localizeUi("ui.chat.chatsettingsdrawer.imageGenerationSettings")}
                        description={localizeUi(
                          "ui.chat.chatsettingsdrawer.adjustGenerationBehaviorImageSizesAndStylesInSettings",
                        )}
                      />
                      <AgentSettingsToggle
                        label={localizeUi("ui.chat.chatsettingsdrawer.gameIllustrator")}
                        description={
                          metadata.enableSpriteGeneration
                            ? localizeUi("ui.chat.chatsettingsdrawer.illustratorIsEnabledForThisGame")
                            : localizeUi("ui.chat.chatsettingsdrawer.allowTheGameToRequestSceneImagesPortraitsAnd")
                        }
                        enabled={!!metadata.enableSpriteGeneration}
                        onToggle={() =>
                          updateMeta.mutate({ id: chat.id, enableSpriteGeneration: !metadata.enableSpriteGeneration })
                        }
                      />
                      {metadata.enableSpriteGeneration && (
                        <div className="space-y-2">
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.chatsettingsdrawer.automaticVisuals")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.letGameModeAutomaticallyRequestBackgroundsNpcPortraitsAnd",
                            )}
                            enabled={gameImageAutoGenerationEnabled}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameImageAutoGenerationEnabled: !gameImageAutoGenerationEnabled,
                              })
                            }
                          />
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.chatsettingsdrawer.dynamicLlmPromptGenerationForGmModeAssets")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.askThePromptModelToRewriteGameNpcPortrait",
                            )}
                            enabled={gameImageDynamicPromptEnabled}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameImageDynamicPromptEnabled: !gameImageDynamicPromptEnabled,
                              })
                            }
                          />
                          {renderIllustratorPromptConnectionSelect()}
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                            </span>
                            <select
                              value={(metadata.gameImageConnectionId as string) ?? ""}
                              onChange={(e) =>
                                updateMeta.mutate({ id: chat.id, gameImageConnectionId: e.target.value || null })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                            >
                              <option value="">{localizeUi("ui.chat.chatsettingsdrawer.selectImageConnection")}</option>
                              {(imageConnectionsList ?? []).map((c: { id: string; name: string; model?: string }) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.model ? localizeUi("ui.chat.datablock.value1", { value1: c.model }) : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {renderIllustratorImageStyleSelect({
                            emptyOptionLabel: "Use global or connection default",
                          })}
                          {renderIllustratorImagesPerGeneration()}
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.chatsettingsdrawer.useCampaignArtStyle")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.addThisGameSSetupGeneratedArtDirectionAs",
                            )}
                            enabled={useCampaignArtStyle}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameSetupConfig: {
                                  ...gameSetupConfig,
                                  useCampaignArtStyle: !useCampaignArtStyle,
                                },
                              })
                            }
                          />
                          {useCampaignArtStyle && (
                            <label className="flex flex-col gap-1">
                              <span className="flex items-center justify-between gap-2 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                <span>{localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}</span>
                                {generatedCampaignArtStyle &&
                                  generatedCampaignArtStyle !== campaignArtStyleDraft.trim() && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCampaignArtStyleDraft(generatedCampaignArtStyle);
                                        updateMeta.mutate({
                                          id: chat.id,
                                          gameSetupConfig: {
                                            ...gameSetupConfig,
                                            artStylePrompt: generatedCampaignArtStyle,
                                          },
                                        });
                                      }}
                                      className="rounded px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                                    >
                                      {localizeUi("ui.chat.chatsettingsdrawer.restoreSetupStyle")}
                                    </button>
                                  )}
                              </span>
                              <MacroTextarea
                                value={campaignArtStyleDraft}
                                onChange={setCampaignArtStyleDraft}
                                onBlur={commitCampaignArtStyle}
                                onExpandedClose={commitCampaignArtStyle}
                                title={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                                ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                                placeholder={localizeUi(
                                  "ui.chat.chatsettingsdrawer.leaveBlankToUseOnlyTheSelectedImageStyle",
                                )}
                                rows={3}
                                maxLength={500}
                                className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                              />
                              <span className="text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.generatedDuringGameSetupEditOrClearItHere")}
                              </span>
                            </label>
                          )}
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                            </span>
                            <MacroTextarea
                              value={gameImagePromptInstructionsDraft}
                              onChange={setGameImagePromptInstructionsDraft}
                              onBlur={commitGameImagePromptInstructions}
                              onExpandedClose={commitGameImagePromptInstructions}
                              title={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                              ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                              placeholder={localizeUi(
                                "ui.chat.chatsettingsdrawer.eGDottoreSMaskCompletelyCoversHisEyes",
                              )}
                              rows={3}
                              maxLength={1200}
                              className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                            />
                          </label>
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.appendMatchedCharacterAppearanceDetailsToTheFinalScene",
                            )}
                            enabled={gameImageIncludeCharacterAppearance}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameImageIncludeCharacterAppearance: !gameImageIncludeCharacterAppearance,
                              })
                            }
                          />
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                            )}
                            enabled={gameImageUseAvatarReferences}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameImageUseAvatarReferences: !gameImageUseAvatarReferences,
                              })
                            }
                          />
                        </div>
                      )}
                      {illustratorInstalled && (
                        <div
                          data-agent-settings-feature-toggles="illustrator"
                          className="space-y-2 border-t border-[var(--border)] pt-3"
                        >
                          <AgentSettingsToggle
                            label={localizeUi("ui.chat.chatsettingsdrawer.enableSceneVideos")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.showSceneVideoControlsAndAllowManualVideoGeneration",
                            )}
                            enabled={gameSceneVideosEnabled}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                gameSceneVideosEnabled: !gameSceneVideosEnabled,
                              })
                            }
                          />
                        </div>
                      )}
                      {illustratorInstalled && gameSceneVideosEnabled && (
                        <AgentSettingsSubsection
                          id="scene-videos"
                          title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                          description={localizeUi(
                            "ui.chat.chatsettingsdrawer.generateMp4SceneVideosFromGameIllustrations",
                          )}
                        >
                          <GenerationSettingsLink
                            onClick={openGenerationSettings}
                            title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                            label={localizeUi("ui.chat.chatsettingsdrawer.videoGenerationSettings")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.adjustVideoModelsSizesAndPromptOverridesInSettings",
                            )}
                          />
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                              {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                            </span>
                            <select
                              value={(metadata.gameVideoConnectionId as string) ?? ""}
                              onChange={(e) =>
                                updateMeta.mutate({ id: chat.id, gameVideoConnectionId: e.target.value || null })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                            >
                              <option value="">{localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}</option>
                              {(videoConnectionsList ?? []).map((c: { id: string; name: string; model?: string }) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.model ? localizeUi("ui.chat.chatsettingsdrawer.value1", { value1: c.model }) : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {videoConnectionsList.length === 0 && (
                            <p className="text-[0.625rem] text-amber-700 dark:text-amber-400/80">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.noVideoGenerationConnectionsFoundAddOneInSettings",
                              )}
                            </p>
                          )}
                          <GamePromptTemplateSelect
                            label={localizeUi("ui.chat.chatsettingsdrawer.gameVideoPrompt")}
                            description={localizeUi("ui.chat.chatsettingsdrawer.usedForGameSceneVideos")}
                            options={gameVideoPromptOptions}
                            selectedId={selectedGameVideoPromptTemplateId}
                            fallbackId={GAME_VIDEO_PROMPT_TEMPLATE_ID}
                            onChange={updateGameVideoPromptSelection}
                          />
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {localizeUi(
                              "ui.chat.chatsettingsdrawer.sceneVideosUseTheLatestGeneratedSceneIllustrationAs",
                            )}
                          </p>
                        </AgentSettingsSubsection>
                      )}
                    </AgentSettingsCard>
                  )}

                  {/* Categorized agent sub-sections */}
                  {metadata.enableAgents && (
                    <>
                      {isGame ? (
                        <div className="space-y-1.5">
                          {gameAgentPool.length > 0 && (
                            <div className="space-y-1">
                              {gameAgentPool.map((agent) => {
                                const active = activeAgentIds.includes(agent.id);
                                const knowledgeAgentType = isKnowledgeAgentType(agent.id) ? agent.id : null;
                                if (active && agent.id === "hierarchical-maps" && mapsPackage) {
                                  return (
                                    <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                      <AgentSettingsCard
                                        icon={<MapIcon size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                        title={agent.name}
                                        description={worldMapsSettingsDescription}
                                      >
                                        <CapabilityElement
                                          packageId={mapsPackage.id}
                                          view="settings"
                                          capabilityProps={{
                                            chatId: chat.id,
                                            chatName: chat.name,
                                            chatMode,
                                            debugMode,
                                            enabledForChat: mapsPackageEnabledForChat,
                                            onEnabledForChatChange: setMapsEnabledForChat,
                                            confirmAction: showConfirmDialog,
                                            onDirtyChange: setEditorDirty,
                                            onOpenLorebook: openLorebookFromSettings,
                                            onLorebooksChanged: refreshLorebooks,
                                          }}
                                          className="block overflow-hidden rounded-lg"
                                        />
                                      </AgentSettingsCard>
                                    </div>
                                  );
                                }
                                if (active && agent.id === "long-term-memory" && ltmPackage) {
                                  return (
                                    <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                      <AgentSettingsCard
                                        icon={<Archive size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                        title={agent.name}
                                        description={getActiveAgentMenuDescription(agent.description)}
                                      >
                                        <CapabilityElement
                                          packageId={ltmPackage.id}
                                          view="settings"
                                          capabilityProps={{
                                            chatId: chat.id,
                                            enabledForChat:
                                              metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id),
                                            chatSettings: {
                                              longTermMemoryRecallStyle: metadata.longTermMemoryRecallStyle,
                                              longTermMemoryBudgetTokens: metadata.longTermMemoryBudgetTokens,
                                              longTermMemoryMaxChunks: metadata.longTermMemoryMaxChunks,
                                            },
                                            onEnabledForChatChange: setLtmEnabledForChat,
                                            onChatSettingsChange: async (patch: Record<string, unknown>) => {
                                              await updateMeta.mutateAsync({ id: chat.id, ...patch });
                                            },
                                            onOpenAgentSettings: () => {
                                              void requestClose().then((closed) => {
                                                if (closed) {
                                                  useUIStore.getState().openAgentDetail("long-term-memory");
                                                }
                                              });
                                            },
                                            onDirtyChange: setEditorDirty,
                                          }}
                                          className="block overflow-hidden rounded-lg"
                                        />
                                      </AgentSettingsCard>
                                    </div>
                                  );
                                }
                                if (active && agent.id === STORYBOARD_AGENT_ID) {
                                  return (
                                    <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                      <AgentSettingsCard
                                        icon={renderRoleplayAgentMenuIcon(agent.id)}
                                        title={agent.name}
                                        description={getActiveAgentMenuDescription(agent.description)}
                                      >
                                        <Suspense fallback={null}>
                                          <StoryboardChatSettingsPanel
                                            chatId={chat.id}
                                            metadata={metadata as Record<string, unknown>}
                                            onClose={onClose}
                                            ownerMode="game"
                                          />
                                        </Suspense>
                                      </AgentSettingsCard>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                    <SettingsSwitch
                                      label={agent.name}
                                      description={getActiveAgentMenuDescription(agent.description) || undefined}
                                      checked={active}
                                      onChange={(nextActive) => {
                                        const latestActiveAgentIds = readLatestActiveAgentIds();
                                        if (!nextActive) {
                                          updateMeta.mutate({
                                            id: chat.id,
                                            activeAgentIds: latestActiveAgentIds.filter((id) => id !== agent.id),
                                          });
                                        } else {
                                          updateMeta.mutate({
                                            id: chat.id,
                                            enableAgents: true,
                                            activeAgentIds: Array.from(new Set([...latestActiveAgentIds, agent.id])),
                                          });
                                        }
                                      }}
                                      labelPosition="start"
                                      className={cn(
                                        "justify-between rounded-md px-3 py-2.5 text-left",
                                        active
                                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                                      )}
                                      labelClassName="min-w-0 text-xs font-medium [&>span>label]:block [&>span>label]:truncate"
                                    />
                                    {active && knowledgeAgentType && (
                                      <KnowledgeAgentSettingsCard
                                        agentType={knowledgeAgentType}
                                        title={agent.name}
                                        description={getActiveAgentMenuDescription(agent.description)}
                                        lorebooks={(lorebooks ?? []) as Lorebook[]}
                                        settings={getKnowledgeAgentSourceSettings(knowledgeAgentType)}
                                        onChange={(patch) =>
                                          updateKnowledgeAgentSourceSettings(knowledgeAgentType, patch)
                                        }
                                      />
                                    )}
                                    {active && agent.id !== "illustrator" && (
                                      <AgentPromptTemplateSelect
                                        options={getPromptOptionsForAgent(agent.id)}
                                        selectedId={
                                          agentPromptTemplateSelections[agent.id] ??
                                          getDefaultPromptTemplateIdForAgent(agent.id)
                                        }
                                        overridden={typeof agentPromptTemplateSelections[agent.id] === "string"}
                                        onChange={(promptTemplateId) =>
                                          updateAgentPromptTemplateSelection(agent.id, promptTemplateId)
                                        }
                                      />
                                    )}
                                    {active && agent.id === "illustrator" && (
                                      <AgentSettingsCard
                                        icon={<Paintbrush size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                        title={agent.name}
                                        description={getActiveAgentMenuDescription(agent.description)}
                                      >
                                        <AgentPromptTemplateSelect
                                          options={getPromptOptionsForAgent(agent.id)}
                                          selectedId={
                                            agentPromptTemplateSelections[agent.id] ??
                                            getDefaultPromptTemplateIdForAgent(agent.id)
                                          }
                                          overridden={typeof agentPromptTemplateSelections[agent.id] === "string"}
                                          onChange={(promptTemplateId) =>
                                            updateAgentPromptTemplateSelection(agent.id, promptTemplateId)
                                          }
                                        />
                                        {renderIllustratorPromptConnectionSelect()}
                                        {renderIllustratorImagesPerGeneration()}
                                        <AgentSettingsToggle
                                          label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                                          description={localizeUi(
                                            "ui.chat.agentaddsetupfields.appendMatchedCharacterAppearanceLinesToImagePromptsUsing",
                                          )}
                                          enabled={illustratorIncludeCharacterAppearance}
                                          onToggle={toggleIllustratorCharacterAppearance}
                                          overridden={
                                            typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
                                          }
                                          onReset={resetIllustratorCharacterAppearance}
                                        />
                                        <AgentSettingsToggle
                                          label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                                          description={localizeUi(
                                            "ui.chat.agentaddsetupfields.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                                          )}
                                          enabled={illustratorUseAvatarReferences}
                                          onToggle={toggleIllustratorAvatarReferences}
                                          overridden={typeof metadata.illustratorUseAvatarReferences === "boolean"}
                                          onReset={resetIllustratorAvatarReferences}
                                        />
                                      </AgentSettingsCard>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {renderActiveCustomAgentSettingsCard()}
                        </div>
                      ) : (
                        <>
                          {/* Approximate per-turn cost of the active agent loadout. */}
                          <div
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.6875rem] ring-1",
                              agentLoadCost.cost.level === "high"
                                ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30"
                                : "bg-[var(--secondary)]/60 text-[var(--primary)] ring-[var(--border)]",
                            )}
                            title={localizeUi(
                              "ui.chat.chatsettingsdrawer.approximateEachCallAlsoCarriesChatContextRecentMessages",
                              { value1: AGENT_COST_HIGH_CALLS, value2: AGENT_COST_HIGH_TOKENS.toLocaleString() },
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {agentLoadCost.cost.level === "high" && (
                                <AlertTriangle size="0.75rem" className="shrink-0" />
                              )}
                              <span className="truncate">
                                ~{agentLoadCost.cost.instructionTokens.toLocaleString()}{" "}
                                {localizeUi("ui.chat.chatsettingsdrawer.tokensOfAgentInstructions")}
                                {" · "}~{agentLoadCost.cost.extraCalls}{" "}
                                {localizeUi("ui.chat.chatsettingsdrawer.extraCall")}
                                {agentLoadCost.cost.extraCalls === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
                                {localizeUi("ui.chat.chatsettingsdrawer.turn")}
                              </span>
                            </span>
                            <span className="shrink-0 cursor-help text-[0.625rem] opacity-70">ⓘ</span>
                          </div>

                          {visibleActiveAgentIds.length === 0 && (
                            <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                              {localizeUi("ui.chat.chatsettingsdrawer.noAgentsAreActiveForThisChatYetAdd")}
                            </p>
                          )}

                          {/* Agent category sub-sections */}
                          {(
                            [
                              {
                                key: "writer",
                                label: "Writer Agents",
                                icon: <Feather size="0.75rem" />,
                                description:
                                  "Improve prose quality, maintain continuity, and shape the narrative direction of your roleplay.",
                              },
                              {
                                key: "tracker",
                                label: "Tracker Agents",
                                icon: <Activity size="0.75rem" />,
                                description:
                                  "Automatically track world state, character stats, quests, expressions, and other data that changes over time.",
                              },
                              {
                                key: "misc",
                                label: "Misc Agents",
                                icon: <Puzzle size="0.75rem" />,
                                description:
                                  "Specialized utilities — image generation, combat systems, music, summaries, and other extras.",
                              },
                            ] as const
                          ).map((cat) => {
                            const catAgents = availableAgents.filter((a) => a.category === cat.key);
                            const activeInCat = catAgents
                              .filter(
                                (agent) =>
                                  activeAgentIds.includes(agent.id) && !standaloneRoleplayAgentIds.has(agent.id),
                              )
                              .sort(
                                (a, b) => getRoleplayAgentSettingsOrder(a.id) - getRoleplayAgentSettingsOrder(b.id),
                              );
                            const inactiveInCat = catAgents.filter((a) => !activeAgentIds.includes(a.id));
                            if (catAgents.length === 0) return null;
                            return (
                              <AgentCategorySection
                                key={cat.key}
                                label={cat.label}
                                icon={cat.icon}
                                description={cat.description}
                                count={activeInCat.length}
                                openRequest={catAgents.some(
                                  (agent) =>
                                    !standaloneRoleplayAgentIds.has(agent.id) &&
                                    getAgentSettingsMenuId(chat.id, agent.id) === pendingAgentMenuTargetId,
                                )}
                              >
                                {/* Active agents in this category */}
                                {activeInCat.length > 0 && (
                                  <div className="flex flex-col gap-1 mb-1.5">
                                    {activeInCat.map((agent) => {
                                      const tokenEst = agentLoadCost.tokensByType.get(agent.id);
                                      const hasSettingsTarget = chatSettingsPackageByAgentId.has(agent.id);
                                      return (
                                        <div
                                          key={agent.id}
                                          id={hasSettingsTarget ? getAgentSettingsMenuId(chat.id, agent.id) : undefined}
                                          tabIndex={hasSettingsTarget ? -1 : undefined}
                                          data-chat-agent-entry={agent.id}
                                          className="scroll-mt-3 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/60"
                                        >
                                          <div className="flex items-start gap-2.5">
                                            <Sparkles
                                              size="0.875rem"
                                              className="mt-0.5 shrink-0 text-[var(--primary)]"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <div className="flex min-w-0 items-center gap-1.5">
                                                <span className="block min-w-0 truncate text-xs">{agent.name}</span>
                                                {tokenEst != null ? (
                                                  <span
                                                    className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                                                    title={localizeUi(
                                                      "ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated",
                                                      { value1: tokenEst.toLocaleString() },
                                                    )}
                                                  >
                                                    ~{tokenEst.toLocaleString()}
                                                  </span>
                                                ) : null}
                                              </div>
                                              <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                                {agent.id === "hierarchical-maps"
                                                  ? worldMapsSettingsDescription
                                                  : agent.description}
                                              </span>
                                            </div>
                                            <button
                                              onClick={() => {
                                                void toggleAgent(agent.id);
                                              }}
                                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                              title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                                            >
                                              <Trash2 size="0.6875rem" />
                                            </button>
                                          </div>
                                          {cat.key === "tracker" && (
                                            <AgentPromptTemplateSelect
                                              options={getPromptOptionsForAgent(agent.id)}
                                              selectedId={
                                                agentPromptTemplateSelections[agent.id] ??
                                                getDefaultPromptTemplateIdForAgent(agent.id)
                                              }
                                              overridden={typeof agentPromptTemplateSelections[agent.id] === "string"}
                                              onChange={(promptTemplateId) =>
                                                updateAgentPromptTemplateSelection(agent.id, promptTemplateId)
                                              }
                                            />
                                          )}
                                          {renderDownloadedAgentChatSettings(agent)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Available agents to add */}
                                {inactiveInCat.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {inactiveInCat.map((agent) => (
                                      <button
                                        key={agent.id}
                                        onClick={() => openAgentAddModal(agent)}
                                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)] bg-[var(--secondary)]"
                                      >
                                        <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                                        <div className="flex-1 min-w-0">
                                          <span className="block truncate text-xs">{agent.name}</span>
                                          <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                            {agent.description}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
                                    {localizeUi("ui.chat.chatsettingsdrawer.allAgentsInThisCategoryAreActive")}
                                  </p>
                                )}
                              </AgentCategorySection>
                            );
                          })}

                          {/* Custom agents */}
                          {renderCustomAgentPicker()}
                        </>
                      )}
                    </>
                  )}
                  {isGame && renderCustomAgentPicker({ showWhenEmpty: true })}
                </div>
              )}
            </Section>
          )}

          {isGame && (
            <Section
              id="game-widgets"
              style={{ order: CHAT_SETTINGS_ORDER.widgets }}
              label={localizeUi("ui.chat.chatsettingsdrawer.widgets")}
              icon={<Puzzle size="0.875rem" />}
              count={gameWidgetDrafts.length}
              help={localizeUi("ui.chat.chatsettingsdrawer.configureTheVisibleGameModeHudWidgetsTheGm")}
            >
              <div className="space-y-3">
                <GameWidgetSetupEditor
                  widgets={gameWidgetDrafts}
                  onChange={(widgets) => setGameWidgetDrafts(normalizeGameHudWidgets(widgets, { mode: "draft" }))}
                  disabled={updateGameWidgets.isPending}
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <AgentSettingsActionButton
                    type="button"
                    onClick={() => setGameWidgetDrafts(gameWidgetSource)}
                    disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
                  >
                    {localizeUi("ui.characters.charactercliptrimmodal.reset")}
                  </AgentSettingsActionButton>
                  <AgentSettingsActionButton
                    type="button"
                    variant="primary"
                    onClick={() => void saveGameWidgets()}
                    disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
                  >
                    {updateGameWidgets.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
                    <span>
                      {updateGameWidgets.isPending
                        ? localizeUi("ui.noodle.stageprofileform.saving")
                        : localizeUi("ui.chat.chatsettingsdrawer.saveWidgets")}
                    </span>
                  </AgentSettingsActionButton>
                </div>
                <GameWidgetFileControls
                  widgets={gameWidgetDrafts}
                  onImport={(widgets) => setGameWidgetDrafts(normalizeGameHudWidgets(widgets))}
                  disabled={updateGameWidgets.isPending}
                  exportFilename={`${chat.name || "game"}-widgets`}
                  importSuccessMessage={(count) =>
                    `Imported ${count === 1 ? "1 widget" : `${count} widgets`}. Save Widgets to apply them.`
                  }
                />
              </div>
            </Section>
          )}

          {/* Memory Recall — conversation mode: placed before Function Calling by section order */}
          {isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
            <Section
              id="conversation-memory-recall"
              style={{ order: CHAT_SETTINGS_ORDER.memoryRecall }}
              label={localizeUi("ui.chat.chatsettingsdrawer.memoryRecall")}
              icon={<Brain size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledRelevantFragmentsFromThisChatAreAutomatically")}
            >
              {renderMemoryRecallControls(true)}
            </Section>
          )}

          {/* Automatic Summarization — conversation mode only. Opens a modal to edit per-day and per-week summaries. */}
          {isConversation && (
            <Section
              id="conversation-automatic-summarization"
              label={localizeUi("ui.chat.chatsettingsdrawer.automaticSummarization")}
              icon={<CalendarClock size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.toHelpKeepTheRequestContextLowTheConversation")}
            >
              <div className="space-y-2.5">
                <button
                  onClick={() => setShowSummariesModal(true)}
                  className="flex w-full items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] font-medium">
                      {localizeUi("ui.chat.chatsettingsdrawer.editSummaries")}
                    </span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.reviewAndEditWhatCharactersRememberFromThisChat")}
                    </p>
                  </div>
                  <Pencil size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>

                {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                  <SettingsSwitch
                    label={localizeUi("ui.chat.chatsettingsdrawer.semanticSummaryRetrieval")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.keepRecentSummariesInContextAndRetrieveOnlyRelevantOlder",
                    )}
                    checked={metadata.semanticSummaryRetrievalEnabled === true}
                    onChange={(semanticSummaryRetrievalEnabled) =>
                      updateMeta.mutate({ id: chat.id, semanticSummaryRetrievalEnabled })
                    }
                    labelPosition="start"
                    className={cn(
                      "justify-between rounded-lg px-3 py-2.5 text-left",
                      metadata.semanticSummaryRetrievalEnabled === true
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : cn(AGENT_SETTINGS_SURFACE_CLASS, "hover:bg-[var(--accent)]"),
                    )}
                    labelClassName="text-xs font-medium"
                  />
                )}

                <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2.5">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">
                      {localizeUi("ui.chat.summarypopover.summaryConnection_febe5c4")}
                    </span>
                    <select
                      value={conversationSummaryConnectionId}
                      onChange={(event) =>
                        updateMeta.mutate({
                          id: chat.id,
                          summaryConnectionId: event.target.value || null,
                        })
                      }
                      className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                      aria-label={localizeUi("ui.chat.summarypopover.summaryConnection_febe5c4")}
                    >
                      <option value="">{localizeUi("chat.summary.connection.agentDefaultFallback")}</option>
                      {conversationSummaryConnectionMissing && (
                        <option value={conversationSummaryConnectionId}>
                          {localizeUi("chat.summary.connection.missing", {
                            id: conversationSummaryConnectionId,
                          })}
                        </option>
                      )}
                      {chatGenerationConnectionsList.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.name}
                          {connection.model ? localizeUi("ui.chat.datablock.value1", { value1: connection.model }) : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.summarypopover.chooseTheModelConnectionUsedForManualAndAutomatic")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">
                      {localizeUi("ui.chat.summarypopover.maximumOutputSize")}
                    </span>
                    <DraftNumberInput
                      value={
                        typeof metadata.summaryMaxTokens === "number"
                          ? metadata.summaryMaxTokens
                          : CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT
                      }
                      min={CHAT_SUMMARY_OUTPUT_TOKENS.MIN}
                      max={CHAT_SUMMARY_OUTPUT_TOKENS.MAX}
                      onCommit={(value) =>
                        updateMeta.mutate({
                          id: chat.id,
                          summaryMaxTokens: value,
                        })
                      }
                      ariaLabel={localizeUi("ui.chat.summarypopover.summaryMaximumOutputSize")}
                      className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                {/* Day rollover hour */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">
                    {localizeUi("ui.chat.chatsettingsdrawer.dayRolloverHour")}
                  </span>
                  <select
                    value={(metadata.dayRolloverHour as number | undefined) ?? 4}
                    onChange={(e) => {
                      setRolloverTouchedThisSession(true);
                      updateMeta.mutate({ id: chat.id, dayRolloverHour: Number(e.target.value) });
                    }}
                    className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                  >
                    {Array.from({ length: 12 }, (_, h) => {
                      const label = h === 0 ? "12 AM (midnight)" : `${h} AM`;
                      return (
                        <option key={h} value={h}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.messagesSentBeforeThisHourCountAsPartOf")}
                  </p>
                  {rolloverTouchedThisSession &&
                    (((metadata.daySummaries as Record<string, unknown> | undefined) &&
                      Object.keys(metadata.daySummaries as Record<string, unknown>).length > 0) ||
                      ((metadata.weekSummaries as Record<string, unknown> | undefined) &&
                        Object.keys(metadata.weekSummaries as Record<string, unknown>).length > 0)) && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-400/10 px-2 py-1.5 ring-1 ring-amber-400/20">
                        <AlertTriangle size="0.75rem" className="mt-[0.125rem] shrink-0 text-amber-400/80" />
                        <p className="text-[0.625rem] text-amber-400/80 leading-snug">
                          {localizeUi("ui.chat.chatsettingsdrawer.existingSummariesWereBuiltWithThePreviousSettingFor")}{" "}
                          <span className="font-medium">{localizeUi("ui.chat.chatsettingsdrawer.editSummaries")}</span>{" "}
                          {localizeUi("ui.chat.chatsettingsdrawer.above")}
                        </p>
                      </div>
                    )}
                </div>

                {/* Recent message tail */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">
                    {localizeUi("ui.chat.chatsettingsdrawer.recentMessageTail")}
                  </span>
                  <DraftNumberInput
                    value={(metadata.summaryTailMessages as number | undefined) ?? SUMMARY_TAIL_MESSAGES.DEFAULT}
                    min={SUMMARY_TAIL_MESSAGES.MIN}
                    onCommit={(value) =>
                      updateMeta.mutate({
                        id: chat.id,
                        summaryTailMessages: value,
                      })
                    }
                    ariaLabel="Recent message tail"
                    className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                  />
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.howManyRecentMessagesToKeepWordForWord")}{" "}
                    <span className="font-medium">0</span>{" "}
                    {localizeUi("ui.chat.chatsettingsdrawer.toDisableHigherValuesIncreasePromptSizeAndModel")}
                  </p>
                </div>
              </div>
            </Section>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.functionCalling }}>
            <FunctionCallingSection
              enableTools={metadata.enableTools as boolean | undefined}
              forceToolCall={metadata.forceToolCall as boolean | undefined}
              activeToolIds={activeToolIds}
              pendingToolIds={pendingToolIds}
              availableTools={availableTools}
              showToolPicker={showToolPicker}
              toolSearch={toolSearch}
              onEnableToolsChange={(enableTools) => updateMeta.mutate({ id: chat.id, enableTools })}
              onForceToolCallChange={(forceToolCall) => updateMeta.mutate({ id: chat.id, forceToolCall })}
              onToggleTool={toggleTool}
              onShowToolPickerChange={setShowToolPicker}
              onToolSearchChange={setToolSearch}
              onPendingToolIdsChange={(updater) => setPendingToolIds(updater)}
              onAddPendingTools={() => {
                const next = [...activeToolIds, ...pendingToolIds];
                updateMeta.mutate({ id: chat.id, activeToolIds: next });
                setPendingToolIds([]);
                setShowToolPicker(false);
              }}
              onCreateCustomTool={handleCreateCustomTool}
            />
          </div>

          {/* Memory Recall — roleplay/game modes: placed before Function Calling by section order */}
          {!isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
            <Section
              id={`${chatMode}-memory-recall`}
              style={{ order: CHAT_SETTINGS_ORDER.memoryRecall }}
              label={localizeUi("ui.chat.chatsettingsdrawer.memoryRecall")}
              icon={<Brain size="0.875rem" />}
              help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledRelevantFragmentsFromThisChatAreAutomatically")}
            >
              {renderMemoryRecallControls(metadata.sceneStatus === "active")}
            </Section>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.translation }}>
            <TranslationSection
              metadata={metadata}
              textConnections={textConnectionsList}
              onMetadataChange={(patch) => updateMeta.mutate({ id: chat.id, ...patch })}
            />
          </div>

          {/* Advanced Parameters */}
          <div style={{ order: CHAT_SETTINGS_ORDER.advancedParameters }}>
            <AdvancedParametersSection
              metadata={metadata}
              isConversation={isConversation}
              connectionId={chat.connectionId ?? null}
              connections={chatGenerationConnectionsList}
              contextMessageLimit={metadata.contextMessageLimit as number | null | undefined}
              excludePastReasoning={metadata.excludePastReasoning as boolean | undefined}
              imageCaptioningEnabled={metadata.imageCaptioningEnabled as boolean | undefined}
              imageCaptioningConnectionId={
                Object.prototype.hasOwnProperty.call(metadata, "imageCaptioningConnectionId")
                  ? typeof metadata.imageCaptioningConnectionId === "string"
                    ? metadata.imageCaptioningConnectionId
                    : null
                  : undefined
              }
              onChatParametersChange={(chatParameters) => updateMeta.mutate({ id: chat.id, chatParameters })}
              onContextMessageLimitChange={(contextMessageLimit) =>
                updateMeta.mutate({ id: chat.id, contextMessageLimit })
              }
              onExcludePastReasoningChange={(excludePastReasoning) =>
                updateMeta.mutate({ id: chat.id, excludePastReasoning })
              }
              onImageCaptioningChange={(patch) => updateMeta.mutate({ id: chat.id, ...patch })}
            />
          </div>

          {!isConversation && !isGame && (
            <div style={{ order: CHAT_SETTINGS_ORDER.impersonate }}>
              <ImpersonateSection
                presets={(presets ?? []) as Array<{ id: string; name: string }>}
                connections={chatGenerationConnectionsList}
              />
            </div>
          )}
        </div>
      </div>

      {/* Choice selection modal for preset variables */}
      <ChoiceSelectionModal
        open={isRoleplayMode && !!choiceModalPresetId}
        onClose={() => setChoiceModalPresetId(null)}
        presetId={choiceModalPresetId}
        chatId={chat.id}
        existingChoices={metadata.presetChoices ?? {}}
        chatFloatingPanel
      />

      {/* Automatic summarization editor */}
      <SummariesEditorModal chat={chat} open={showSummariesModal} onClose={() => setShowSummariesModal(false)} />

      {/* Agent Suite — stored agent data viewer/editor */}
      <AgentSuiteModal
        chat={chat}
        open={showAgentSuiteModal}
        onClose={() => setShowAgentSuiteModal(false)}
        onCloseGuardChange={handleAgentSuiteCloseGuardChange}
        agents={agentSuiteAgents}
      />

      {/* Memory recall chunk viewer */}
      <MemoryRecallMemoriesModal
        chatId={chat.id}
        open={showMemoriesModal}
        onClose={() => setShowMemoriesModal(false)}
        chatFloatingPanel
      />

      <Modal
        open={!!agentAddPreview}
        onClose={() => {
          if (!addingAgentToChat) {
            setAgentAddPreview(null);
            setAgentSetupQueue([]);
          }
        }}
        title={
          agentAddPreview
            ? localizeUi("ui.chat.chatsettingsdrawer.addValue1", { value1: agentAddPreview.agent.name })
            : localizeUi("ui.chat.chatsettingsdrawer.addAgent")
        }
        width="max-w-lg"
        chatFloatingPanel
      >
        {agentAddPreview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--secondary)]/80 px-4 py-3 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-3">
                <Sparkles size="1rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{agentAddPreview.agent.name}</p>
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.5625rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                      {agentAddPreview.agent.builtIn
                        ? agentAddPreview.agent.category
                        : localizeUi("ui.agents.toolcard.custom")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--muted-foreground)]">
                    {agentAddPreview.agent.description || "No description available."}
                  </p>
                </div>
              </div>
            </div>

            {agentAddIsFeature ? (
              <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {localizeUi("ui.chat.chatsettingsdrawer.thisLetsCharactersInitiateTheDownloadedFeatureInThis")}
              </div>
            ) : agentAddIsRuntimeDisabled ? (
              <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {localizeUi("ui.chat.chatsettingsdrawer.thisAddsItsInstructionsToTheNextRoleplayPrompt")}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.agents.agenteditor.agentBudget")}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.contextSize")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={agentAddPreview.contextSize}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  contextSize: Number.isFinite(value)
                                    ? Math.max(1, Math.min(200, value))
                                    : DEFAULT_AGENT_CONTEXT_SIZE,
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agenteditor.messages")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.maxOutputTokens")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={MIN_AGENT_MAX_TOKENS}
                        value={agentAddPreview.maxTokens}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  maxTokens: normalizeAgentMaxTokensInputValue(
                                    Number.isFinite(value) ? value : undefined,
                                  ),
                                }
                              : current,
                          );
                        }}
                        onBlur={() => {
                          setAgentAddPreview((current) =>
                            current ? { ...current, maxTokens: normalizeAgentMaxTokens(current.maxTokens) } : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-32 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agenteditor.tokens")}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.contextSizeControlsRecentChatMessagesMaxOutputReserves")}
                </p>
              </div>
            )}

            {agentAddIntervalMeta && agentAddPreview.runInterval != null && (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">
                  {agentAddIntervalMeta.label}
                </label>
                <div className="flex items-center gap-3">
                  {agentAddPreview.agent.builtIn ? (
                    <input
                      type="number"
                      min={1}
                      max={agentAddIntervalMeta.max}
                      value={agentAddPreview.runInterval}
                      onChange={(e) => {
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                runInterval: parseCadenceInputValue(
                                  e.target.value,
                                  agentAddIntervalMeta.defaultValue,
                                  agentAddIntervalMeta.max,
                                ),
                              }
                            : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  ) : (
                    <div className="relative w-28">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          agentAddCadenceInputFocused
                            ? String(agentAddPreview.runInterval)
                            : getCadenceInputValue(agentAddPreview.runInterval)
                        }
                        onFocus={(e) => {
                          setAgentAddCadenceInputFocused(true);
                          e.target.select();
                        }}
                        onBlur={() => setAgentAddCadenceInputFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          const delta = e.key === "ArrowUp" ? 1 : -1;
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: stepCadenceValue(
                                    current.runInterval ?? 1,
                                    delta,
                                    agentAddIntervalMeta.max,
                                  ),
                                }
                              : current,
                          );
                        }}
                        onChange={(e) => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: parseCadenceInputValue(
                                    e.target.value,
                                    current.runInterval ?? 1,
                                    agentAddIntervalMeta.max,
                                  ),
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 pr-8 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md">
                        <button
                          type="button"
                          aria-label={localizeUi("ui.agents.agenteditor.increaseTriggerCadence")}
                          disabled={addingAgentToChat}
                          onClick={() => {
                            setAgentAddPreview((current) =>
                              current
                                ? {
                                    ...current,
                                    runInterval: stepCadenceValue(
                                      current.runInterval ?? 1,
                                      1,
                                      agentAddIntervalMeta.max,
                                    ),
                                  }
                                : current,
                            );
                          }}
                          className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronUp size="0.6875rem" />
                        </button>
                        <button
                          type="button"
                          aria-label={localizeUi("ui.agents.agenteditor.decreaseTriggerCadence")}
                          disabled={addingAgentToChat}
                          onClick={() => {
                            setAgentAddPreview((current) =>
                              current
                                ? {
                                    ...current,
                                    runInterval: stepCadenceValue(
                                      current.runInterval ?? 1,
                                      -1,
                                      agentAddIntervalMeta.max,
                                    ),
                                  }
                                : current,
                            );
                          }}
                          className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronDown size="0.6875rem" />
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{agentAddIntervalMeta.unit}</span>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">{agentAddIntervalMeta.help}</p>
              </div>
            )}

            <AgentAddSetupFields
              agentId={agentAddPreview.agent.id}
              value={agentAddPreview.setup}
              disabled={addingAgentToChat}
              lorebooks={(lorebooks ?? []) as Lorebook[]}
              promptOptions={getPromptOptionsForAgent(agentAddPreview.agent.id)}
              spriteSubjects={agentAddSpriteSubjects}
              allowSecretPlotControls={supportsNarrativeDirectorSecretPlot}
              onChange={(patch) =>
                setAgentAddPreview((current) =>
                  current ? { ...current, setup: { ...current.setup, ...patch } } : current,
                )
              }
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setAgentAddPreview(null);
                  setAgentSetupQueue([]);
                }}
                disabled={addingAgentToChat}
                className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localizeUi("chat.delete.dialog.cancel")}
              </button>
              <button
                onClick={confirmAddAgent}
                disabled={addingAgentToChat}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingAgentToChat
                  ? localizeUi("ui.chat.chatsettingsdrawer.adding")
                  : localizeUi("ui.characters.metadatatab.add")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* First message confirmation dialog */}
      {firstMesConfirm && (
        <div
          data-chat-floating-panel
          data-component="ChatSettingsDrawer.GreetingDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-settings-greeting-title"
          aria-describedby="chat-settings-greeting-description"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 max-md:pt-[env(safe-area-inset-top)]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFirstMesConfirm(null);
          }}
        >
          <div
            ref={greetingDialogRef}
            tabIndex={-1}
            className="mari-chrome-token-scope relative mx-4 flex w-full max-w-sm flex-col rounded-xl bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl ring-1 ring-[var(--marinara-chat-chrome-panel-border)]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-component="ChatSettingsDrawer.GreetingDialogHeader"
              className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3"
            >
              <span id="chat-settings-greeting-title" className="mari-chrome-text-strong text-sm font-semibold">
                {localizeUi("ui.chat.chatsettingsdrawer.chooseGreeting")}
              </span>
            </div>
            <div className="min-h-0 px-4 py-3">
              <p id="chat-settings-greeting-description" className="mari-chrome-text text-xs leading-relaxed">
                {localizeUi("ui.chat.chatsettingsdrawer.chooseGreetingForValue1", {
                  value1: firstMesConfirm.charName,
                })}
              </p>
              <div className="mt-3 max-h-[min(50dvh,22rem)] space-y-2 overflow-y-auto pr-1">
                {firstMesConfirm.greetings.map((greeting, index) => {
                  const selected = index === firstMesConfirm.selectedIndex;
                  return (
                    <button
                      key={`${greeting.alternateIndex ?? "first"}:${greeting.text.slice(0, 32)}`}
                      type="button"
                      onClick={() =>
                        setFirstMesConfirm((current) => (current ? { ...current, selectedIndex: index } : current))
                      }
                      aria-pressed={selected}
                      className={cn(
                        "mari-chat-option-field w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected && "mari-chat-option-field--active",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="mari-chrome-text-strong text-[0.6875rem] font-semibold">
                          {greeting.alternateIndex === null
                            ? localizeUi("ui.characters.dialoguetab.firstMessage")
                            : localizeUi("ui.characters.dialoguetab.alternateGreetingValue1", {
                                value1: greeting.alternateIndex,
                              })}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                              : "border-[var(--marinara-chat-chrome-button-border)] text-transparent",
                          )}
                        >
                          {selected && <Check size="0.625rem" />}
                        </span>
                      </span>
                      <RoleplayMessagePreview
                        content={
                          greeting.text.length > 500
                            ? localizeUi("ui.chat.chatsettingsdrawer.value1_30f5501", {
                                value1: greeting.text.slice(0, 500),
                              })
                            : greeting.text
                        }
                        dialogueColor={firstMesConfirm.dialogueColor}
                        className="mt-1 text-[0.6875rem] leading-relaxed"
                        selfCharacterId={firstMesConfirm.charId}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
              <button
                type="button"
                onClick={() => setFirstMesConfirm(null)}
                disabled={createMessage.isPending}
                className="mari-chrome-control mari-chrome-control--small text-xs"
              >
                {localizeUi("onboarding.actions.skip")}
              </button>
              <button
                type="button"
                onClick={handleFirstMesConfirm}
                disabled={createMessage.isPending}
                className="mari-chrome-control mari-chrome-control--small mari-chrome-control--selected text-xs"
              >
                {createMessage.isPending
                  ? localizeUi("ui.chat.chatsettingsdrawer.adding")
                  : localizeUi("ui.chat.chatsettingsdrawer.addSelectedGreeting")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatMemoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function estimateMemoryTokens(memories: ChatMemoryChunk[]): number {
  const text = memories.map((memory) => memory.content).join("\n\n");
  return Math.ceil(text.length / 4);
}

function formatMemoryChunkCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "memory chunk" : "memory chunks"}`;
}

const MEMORY_CONTENT_CLASS =
  "max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--foreground)]";
const MAX_MEMORY_RECALL_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_MEMORY_RECALL_IMPORT_FILE_LABEL = "25 MB";

function MemoryRecallMemoriesModal({
  chatId,
  open,
  onClose,
  chatFloatingPanel = false,
}: {
  chatId: string;
  open: boolean;
  onClose: () => void;
  chatFloatingPanel?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const memoriesQuery = useChatMemories(chatId, open);
  const deleteMemory = useDeleteChatMemory(chatId);
  const clearMemories = useClearChatMemories(chatId);
  const refreshMemories = useRefreshChatMemories(chatId);
  const exportMemories = useExportChatMemories(chatId);
  const importMemories = useImportChatMemories(chatId);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const memories = useMemo(() => memoriesQuery.data ?? [], [memoriesQuery.data]);
  const totalTokens = useMemo(() => estimateMemoryTokens(memories), [memories]);

  const handleExport = async () => {
    if (memories.length === 0) {
      toast.error(localizeUi("ui.chat.memoryrecallmemoriesmodal.thereAreNoRecallMemoriesToExportYet"));
      return;
    }

    try {
      await exportMemories.mutateAsync();
      toast.success(localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryRecallExported"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.exportFailedValue1", { value1: err.message })
          : localizeUi("ui.chat.memoryrecallmemoriesmodal.exportFailed"),
      );
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEMORY_RECALL_IMPORT_FILE_BYTES) {
      toast.error(
        localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryRecallImportFilesMustBeValue1OrSmaller", {
          value1: MAX_MEMORY_RECALL_IMPORT_FILE_LABEL,
        }),
      );
      event.target.value = "";
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isMemoryRecallExportEnvelope(parsed)) {
        toast.error(localizeUi("ui.chat.memoryrecallmemoriesmodal.chooseAMemoryRecallExportFile"));
        return;
      }

      const result = await importMemories.mutateAsync({ envelope: parsed });
      if (result.imported > 0) {
        toast.success(
          localizeUi("ui.chat.memoryrecallmemoriesmodal.importedValue1", {
            value1: formatMemoryChunkCount(result.imported),
          }),
        );
      } else {
        toast.info(localizeUi("ui.chat.memoryrecallmemoriesmodal.noNewRecallMemoriesWereImported"));
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.importFailedValue1", { value1: err.message })
          : localizeUi("chat.branches.importFailed"),
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleDelete = async (memory: ChatMemoryChunk) => {
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.memoryrecallmemoriesmodal.forgetMemory"),
      message: localizeUi("ui.chat.memoryrecallmemoriesmodal.removeThisRecallMemoryFromThisChat"),
      confirmLabel: localizeUi("ui.chat.memoryrecallmemoriesmodal.forget"),
      tone: "destructive",
    });
    if (ok) deleteMemory.mutate(memory.id);
  };

  const handleClear = async () => {
    if (memories.length === 0) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.memoryrecallmemoriesmodal.clearMemories"),
      message: localizeUi("ui.chat.memoryrecallmemoriesmodal.removeAllRecallMemoriesForThisChatThisDoes"),
      confirmLabel: localizeUi("lorebook.editor.batch.clear"),
      tone: "destructive",
    });
    if (ok) clearMemories.mutate();
  };

  const handleRevectorize = async () => {
    if (memories.length > 0) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemories"),
        message: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemoriesDescription"),
        confirmLabel: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAll"),
        tone: "default",
      });
      if (!confirmed) return;
    }

    try {
      const result = await refreshMemories.mutateAsync();
      toast.success(
        localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizedValue1MemoryChunks", {
          value1: result.rebuilt,
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizationFailedValue1", { value1: error.message })
          : localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizationFailed"),
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.chat.memoryrecallmemoriesmodal.memoriesForThisChat")}
      width="max-w-3xl"
      chatFloatingPanel={chatFloatingPanel}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/70 px-3 py-2 ring-1 ring-[var(--border)]">
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{memories.length}</span>{" "}
            {memories.length === 1
              ? localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryChunk")
              : localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryChunks")}
            {memories.length > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="tabular-nums">
                  ~{totalTokens.toLocaleString()} {localizeUi("ui.agents.agenteditor.tokens")}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.marinara"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={memories.length === 0 || exportMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.exportMemories")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.exportMemories")}
            >
              <Upload size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.importMemories")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.importMemories")}
            >
              <Download size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => void handleRevectorize()}
              disabled={memoriesQuery.isFetching || refreshMemories.isPending || importMemories.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]/80 disabled:opacity-50"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemoriesDescription")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemories")}
            >
              <RefreshCw
                size="0.8125rem"
                className={cn((memoriesQuery.isFetching || refreshMemories.isPending) && "animate-spin")}
              />
              <span>{localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAll")}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={memories.length === 0 || clearMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.clearAllMemories")}
            >
              <Trash2 size="0.8125rem" />
            </button>
          </div>
        </div>

        {memoriesQuery.isLoading && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.loadingMemories")}
          </div>
        )}

        {memoriesQuery.error && (
          <div className="rounded-xl bg-[var(--destructive)]/10 px-4 py-3 text-xs text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.failedToLoadMemories")}
          </div>
        )}

        {!memoriesQuery.isLoading && !memoriesQuery.error && memories.length === 0 && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.noRecallMemoriesHaveBeenCreatedForThisChat")}
          </div>
        )}

        {memories.length > 0 && (
          <div className="space-y-2">
            {memories.map((memory) => (
              <article key={memory.id} className="rounded-xl bg-[var(--card)] px-3 py-3 ring-1 ring-[var(--border)]">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-[0.625rem] text-[var(--muted-foreground)]">
                    <div className="font-medium text-[var(--foreground)]">
                      {formatMemoryDate(memory.firstMessageAt)} - {formatMemoryDate(memory.lastMessageAt)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>
                        {memory.messageCount} {localizeUi("ui.agents.agenteditor.messages")}
                      </span>
                      <span>
                        {memory.hasEmbedding
                          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.vectorized")
                          : memory.embeddingStatus === "unavailable"
                            ? localizeUi("ui.chat.memoryrecallmemoriesmodal.embeddingUnavailable")
                            : localizeUi("ui.chat.memoryrecallmemoriesmodal.waitingForVector")}
                      </span>
                      <span>
                        {localizeUi("ui.chat.memoryrecallmemoriesmodal.created")} {formatMemoryDate(memory.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(memory)}
                    disabled={deleteMemory.isPending}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
                    title={localizeUi("ui.chat.memoryrecallmemoriesmodal.forgetThisMemory")}
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                </div>
                <pre className={MEMORY_CONTENT_CLASS}>{memory.content}</pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function KnowledgeAgentSettingsCard({
  id,
  agentType,
  title,
  description,
  lorebooks,
  settings,
  order,
  onChange,
  onRemove,
}: {
  id?: string;
  agentType: KnowledgeAgentType;
  title: string;
  description: string;
  lorebooks: Lorebook[];
  settings: KnowledgeAgentSourceSettings;
  order?: number;
  onChange: (patch: Partial<KnowledgeAgentSourceSettings>) => void;
  onRemove?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeSourcesQuery = useKnowledgeSources();
  const uploadSource = useUploadKnowledgeSource();
  const sourceLorebookIds = settings.sourceLorebookIds ?? [];
  const sourceFileIds = settings.sourceFileIds ?? [];
  const isRetrieval = agentType === "knowledge-retrieval";
  const {
    entries: routerSourceEntries,
    isLoading: routerEntriesLoading,
    isError: routerEntriesError,
  } = useEntriesAcrossLorebooks(agentType === "knowledge-router" ? sourceLorebookIds : []);
  const descriptionCoverage = useMemo(() => {
    if (agentType !== "knowledge-router" || sourceLorebookIds.length === 0 || !routerSourceEntries) return null;
    const total = routerSourceEntries.length;
    const withDescription = routerSourceEntries.filter((entry) => entry.description?.trim().length > 0).length;
    return { total, withDescription, ratio: total > 0 ? withDescription / total : 0 };
  }, [agentType, routerSourceEntries, sourceLorebookIds.length]);

  const toggleLorebook = (lorebookId: string) => {
    onChange({
      sourceLorebookIds: sourceLorebookIds.includes(lorebookId)
        ? sourceLorebookIds.filter((id) => id !== lorebookId)
        : [...sourceLorebookIds, lorebookId],
    });
  };

  const toggleSourceFile = (sourceId: string) => {
    onChange({
      sourceFileIds: sourceFileIds.includes(sourceId)
        ? sourceFileIds.filter((id) => id !== sourceId)
        : [...sourceFileIds, sourceId],
    });
  };

  return (
    <AgentSettingsCard
      id={id}
      icon={renderRoleplayAgentMenuIcon(agentType)}
      title={title}
      description={description}
      order={order}
      onRemove={onRemove}
    >
      <AgentSettingsToggle
        label={localizeUi("ui.chat.knowledgesourcefields.useChatActiveLorebooks")}
        description={
          sourceLorebookIds.length > 0
            ? localizeUi("ui.chat.knowledgesourcefields.fixedSourceLorebooksAreSelectedBelowSoTheyOverride")
            : localizeUi("ui.chat.knowledgesourcefields.useTheLorebooksCurrentlyActiveForThisChatWhen")
        }
        enabled={settings.useChatActiveLorebooks !== false}
        onToggle={() => onChange({ useChatActiveLorebooks: settings.useChatActiveLorebooks === false })}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.knowledgeagentsettingscard.fixedSourceLorebooks")}
          </span>
          {agentType === "knowledge-router" &&
            descriptionCoverage &&
            !routerEntriesLoading &&
            !routerEntriesError &&
            (descriptionCoverage.total === 0 ? (
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.agents.agenteditor.noEntriesYet")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[0.5625rem] text-[var(--muted-foreground)]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    descriptionCoverage.ratio >= 0.75
                      ? "bg-emerald-400"
                      : descriptionCoverage.ratio >= 0.25
                        ? "bg-amber-400"
                        : "bg-red-400",
                  )}
                />
                {Math.round(descriptionCoverage.ratio * 100)}
                {localizeUi("ui.agents.agenteditor.described")}
              </span>
            ))}
        </div>
        {lorebooks.length > 0 ? (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
            {lorebooks.map((lorebook) => {
              const selected = sourceLorebookIds.includes(lorebook.id);
              return (
                <button
                  key={lorebook.id}
                  type="button"
                  onClick={() => toggleLorebook(lorebook.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all",
                    selected
                      ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                      selected
                        ? "border-[var(--primary)]/60 bg-[var(--primary)]/20"
                        : "border-[var(--border)] bg-[var(--background)]",
                    )}
                  >
                    {selected && <Check size="0.625rem" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{lorebook.name}</span>
                    {lorebook.description ? (
                      <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {lorebook.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            {localizeUi("ui.agents.agenteditor.noLorebooksAvailable")}
          </p>
        )}
        {agentType === "knowledge-router" &&
          (sourceLorebookIds.length > 0 || settings.useChatActiveLorebooks !== false) && (
            <p className="text-[0.625rem] italic text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.chat.knowledgeagentsettingscard.entryDescriptionsHelpRouterChoosePreciselyEntriesWithoutDescriptions",
              )}
            </p>
          )}
      </div>

      {isRetrieval && (
        <div className="space-y-1.5">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.knowledgeagentsettingscard.uploadedFiles")}
          </span>
          {knowledgeSourcesQuery.data?.length ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
              {knowledgeSourcesQuery.data.map((source) => {
                const selected = sourceFileIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => toggleSourceFile(source.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all",
                      selected
                        ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                        selected
                          ? "border-[var(--primary)]/60 bg-[var(--primary)]/20"
                          : "border-[var(--border)] bg-[var(--background)]",
                      )}
                    >
                      {selected && <Check size="0.625rem" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{source.originalName}</span>
                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                        {(source.size / 1024).toFixed(1)} {localizeUi("ui.agents.agenteditor.kb")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {localizeUi("ui.chat.knowledgesourcefields.noUploadedKnowledgeFilesYet")}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.tsv,.pdf"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const uploaded = await uploadSource.mutateAsync(file);
                onChange({ sourceFileIds: Array.from(new Set([...sourceFileIds, uploaded.id])) });
              } catch (error) {
                await showAlertDialog({
                  title: "Couldn’t Upload File",
                  message: error instanceof Error ? error.message : "The file could not be uploaded.",
                });
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={uploadSource.isPending}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-all",
              uploadSource.isPending
                ? "cursor-wait border-[var(--border)] text-[var(--muted-foreground)]/60"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {uploadSource.isPending ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                {localizeUi("ui.chat.knowledgesourcefields.uploadFile")}
              </>
            )}
          </button>
        </div>
      )}

      {(sourceLorebookIds.length > 0 || sourceFileIds.length > 0) && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {[
            sourceLorebookIds.length > 0
              ? `${sourceLorebookIds.length} lorebook${sourceLorebookIds.length === 1 ? "" : "s"}`
              : null,
            sourceFileIds.length > 0 ? `${sourceFileIds.length} file${sourceFileIds.length === 1 ? "" : "s"}` : null,
          ]
            .filter(Boolean)
            .join(", ")}{" "}
          {localizeUi("ui.chat.knowledgeagentsettingscard.selectedForThisChat")}
        </p>
      )}
    </AgentSettingsCard>
  );
}

function ConversationNotesSection({ chatId }: { chatId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const notesQuery = useChatNotes(chatId);
  const deleteNote = useDeleteChatNote(chatId);
  const clearNotes = useClearChatNotes(chatId);
  const notes = useMemo<ConversationNote[]>(() => notesQuery.data ?? [], [notesQuery.data]);
  const totalChars = useMemo(() => notes.reduce((acc, n) => acc + n.content.length, 0), [notes]);

  const handleDelete = async (note: ConversationNote) => {
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.conversationnotessection.deleteNote"),
      message: localizeUi("ui.chat.conversationnotessection.removeThisNoteFromTheConnectedRoleplaySPrompt"),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (ok) deleteNote.mutate(note.id);
  };

  const handleClear = async () => {
    if (notes.length === 0) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.conversationnotessection.clearAllNotes_d00f211"),
      message: localizeUi("ui.chat.conversationnotessection.removeEveryDurableNoteFromThisRoleplayThisCannot"),
      confirmLabel: localizeUi("ui.chat.roleplayhudactionsmenu.clearAll"),
      tone: "destructive",
    });
    if (ok) clearNotes.mutate();
  };

  return (
    <Section
      id="conversation-notes"
      label={localizeUi("ui.chat.conversationnotessection.conversationNotes")}
      icon={<StickyNote size="0.875rem" />}
      count={notes.length}
      help={localizeUi("ui.chat.conversationnotessection.durableNotesTheConnectedConversationSCharacterHasSaved")}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
          <span>
            {notesQuery.isLoading
              ? localizeUi("ui.panels.ttsconfigcard.loading")
              : notesQuery.error
                ? localizeUi("ui.chat.conversationnotessection.failedToLoad")
                : notes.length === 0
                  ? localizeUi("ui.chat.conversationnotessection.noNotesSavedYet")
                  : localizeUi("ui.chat.conversationnotessection.value1Value2Value3Chars", {
                      value1: notes.length,
                      value2:
                        notes.length === 1
                          ? localizeUi("ui.chat.conversationnotessection.note")
                          : localizeUi("ui.chat.conversationnotessection.notes"),
                      value3: totalChars.toLocaleString(),
                    })}
          </span>
          {notes.length > 0 && !notesQuery.isLoading && !notesQuery.error && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearNotes.isPending}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title={localizeUi("ui.chat.conversationnotessection.clearAllNotes")}
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
        </div>

        {notesQuery.isLoading ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-center text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.conversationnotessection.loadingNotes")}
          </p>
        ) : notesQuery.error ? (
          <p className="rounded-lg bg-[var(--destructive)]/10 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            {localizeUi("ui.chat.conversationnotessection.failedToLoadNotes")}
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.conversationnotessection.charactersInTheConnectedConversationCanSaveThingsThey")}{" "}
            <code className="rounded bg-[var(--accent)]/60 px-1">{"<note>...</note>"}</code>
            {localizeUi("ui.chat.conversationnotessection.savedNotesWillAppearHere")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2 rounded-lg bg-[var(--card)] px-2.5 py-2 ring-1 ring-[var(--border)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                    {note.content}
                  </p>
                  <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {formatMemoryDate(note.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(note)}
                  disabled={deleteNote.isPending}
                  className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
                  title={localizeUi("ui.chat.conversationnotessection.deleteThisNote")}
                >
                  <Trash2 size="0.6875rem" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
