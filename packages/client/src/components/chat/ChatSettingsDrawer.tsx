// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
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
  MessageSquare,
  Sparkles,
  Image,
  Pencil,
  AlertTriangle,
  GripVertical,
  MessageCircle,
  Bot,
  CalendarClock,
  RefreshCw,
  Settings2,
  Link,
  ArrowRightLeft,
  Unlink,
  Brain,
  Maximize2,
  Vibrate,
  Feather,
  Paintbrush,
  Regex,
  Activity,
  Puzzle,
  Save,
  FilePlus2,
  Upload,
  Download,
  Star,
  StickyNote,
  Eye,
  EyeOff,
  Music2,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  ROLEPLAY_POPOVER_CLOSE_BUTTON,
  ROLEPLAY_POPOVER_CLOSE_ICON_SIZE,
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import { PickerDropdown } from "../../features/chat-settings/PickerDropdown";
import { ChatSettingsSection as Section } from "../../features/chat-settings/ChatSettingsSection";
import { AdvancedParametersSection } from "../../features/chat-settings/sections/AdvancedParametersSection";
import { ChatNameSection } from "../../features/chat-settings/sections/ChatNameSection";
import { ConnectionSection } from "../../features/chat-settings/sections/ConnectionSection";
import { ConversationPromptSection } from "../../features/chat-settings/sections/ConversationPromptSection";
import { DiscordMirrorControls } from "../../features/chat-settings/sections/DiscordMirrorSection";
import { FunctionCallingSection } from "../../features/chat-settings/sections/FunctionCallingSection";
import { GameExtraPromptSection } from "../../features/chat-settings/sections/GameExtraPromptSection";
import { ImpersonateSection } from "../../features/chat-settings/sections/ImpersonateSection";
import { LorebooksSection, type ActiveLorebookView } from "../../features/chat-settings/sections/LorebooksSection";
import { PromptPresetSection } from "../../features/chat-settings/sections/PromptPresetSection";
import { SceneInstructionsSection } from "../../features/chat-settings/sections/SceneInstructionsSection";
import { TranslationSection } from "../../features/chat-settings/sections/TranslationSection";
import { cn, getAvatarCropStyle, type AvatarCrop } from "../../lib/utils";
import { showAlertDialog, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ExpandedTextarea } from "../ui/ExpandedTextarea";
import { Modal } from "../ui/Modal";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { SecretPlotPanel } from "../agents/SecretPlotPanel";
import { SummariesEditorModal } from "./SummariesEditorModal";
import { useCharacters, usePersonas, useCharacterGroups, type SpriteInfo } from "../../hooks/use-characters";
import { useLorebooks, useEntriesAcrossLorebooks } from "../../hooks/use-lorebooks";
import { useDefaultPreset, usePresetFull, usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useKnowledgeSources, useUploadKnowledgeSource } from "../../hooks/use-knowledge-sources";
import { useGenerate } from "../../hooks/use-generate";
import {
  useUpdateChat,
  useUpdateChatMetadata,
  useCreateMessage,
  useChats,
  useConnectChat,
  useDisconnectChat,
  useChatMessages,
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
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { getConnectedChatDisplayName } from "../../lib/chat-display";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";
import {
  getAgentRunIntervalMeta,
  getCadenceInputValue,
  parseCadenceInputValue,
  stepCadenceValue,
} from "../../lib/agent-cadence";
import { getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { extractCreatorNotesCss } from "../../lib/creator-notes-css";
import { isLorebookScopeActiveForChat } from "../../lib/lorebook-scope";
import { useUIStore } from "../../stores/ui.store";
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
} from "@marinara-engine/shared";
import { useAgentConfigs, useCreateAgent, useUpdateAgent, type AgentConfigRow } from "../../hooks/use-agents";
import { useAgentStore } from "../../stores/agent.store";
import {
  BUILT_IN_AGENTS,
  BUILT_IN_TOOLS,
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_PROMPTS,
  getChatModeCapabilities,
  LIMITS,
  MIN_AGENT_MAX_TOKENS,
  PROFESSOR_MARI_ID,
  estimateAgentLoadCost,
  getAgentPromptTemplateOptions,
  includesTextForMatch,
  AGENT_COST_HIGH_CALLS,
  AGENT_COST_HIGH_TOKENS,
  CONVERSATION_COMMAND_KEYS,
  getDefaultBuiltInAgentSettings,
  isAgentAvailableInChatMode,
  isAgentConfigDeleted,
  isAgentHiddenFromChatSettingsPicker,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  mergeBuiltInAgentSettings,
  normalizeAgentPhaseForType,
  normalizeAgentPromptTemplateSelectionMap,
  resolveAgentPromptTemplate,
} from "@marinara-engine/shared";
import type { Chat, CharacterGroup, Lorebook } from "@marinara-engine/shared";
import {
  isCustomToolSelectable,
  useCustomToolCapabilities,
  useCustomTools,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import {
  HAPTIC_INTIFACE_URL_STORAGE_KEY,
  useHapticStatus,
  useHapticConnect,
  useHapticDisconnect,
  useHapticStartScan,
} from "../../hooks/use-haptic";
import { normalizeSpritePlacements } from "./sprite-placement";
import type { LocalSpriteVisualSettings } from "./local-sprite-visual-settings";
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
  hasSpriteDisplayMode,
  normalizeSpriteDisplayModes,
  type SpriteDisplayMode,
} from "./sprite-display-modes";
import {
  AgentAddSetupFields,
  applyAgentAddSetupToAgentSettings,
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
  type AgentAddSetupState,
  type AgentAddSpriteSubject,
  type MusicProvider,
} from "./AgentAddSetupFields";
import { GameWidgetFileControls, GameWidgetSetupEditor, normalizeGameHudWidgets } from "../game/GameWidgetSetupEditor";

interface ChatSettingsDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  anchor?: { right: number; top: number } | null;
  initialSection?: "autonomous" | null;
  spriteArrangeMode?: boolean;
  onToggleSpriteArrange?: () => void;
  onResetSpritePlacements?: () => void;
  onSpriteSideChange?: (side: "left" | "right") => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
}

type SpotifySourceType = "liked" | "playlist" | "artist" | "any";

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
  const normalized = raw.replace(/^\/+/, "").replace(/\/+$/g, "");
  if (!normalized || normalized.includes("..")) return "music";
  return normalized.startsWith("music") ? normalized : `music/${normalized}`;
}

const AUTONOMOUS_DAILY_CAP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const DEFAULT_PROSE_GUARDIAN_BANNED_WORDS = "ozone";
const DEFAULT_PROSE_GUARDIAN_AVOID =
  "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";

const AGENTS_TAB_CATEGORY_ORDER: Record<string, number> = {
  writer: 0,
  tracker: 1,
  misc: 2,
};

const ROLEPLAY_AGENT_SETTINGS_ORDER = new Map<string, number>(
  BUILT_IN_AGENTS.map((agent, manifestIndex) => ({ agent, manifestIndex }))
    .filter(({ agent }) => !agent.libraryHidden)
    .sort((a, b) => {
      const categoryDiff =
        (AGENTS_TAB_CATEGORY_ORDER[a.agent.category] ?? 99) - (AGENTS_TAB_CATEGORY_ORDER[b.agent.category] ?? 99);
      return categoryDiff || a.manifestIndex - b.manifestIndex;
    })
    .map(({ agent }, index) => [agent.id, index]),
);
const CUSTOM_AGENT_SETTINGS_ORDER = ROLEPLAY_AGENT_SETTINGS_ORDER.size + 100;

function getRoleplayAgentSettingsOrder(agentId: string): number {
  return ROLEPLAY_AGENT_SETTINGS_ORDER.get(agentId) ?? CUSTOM_AGENT_SETTINGS_ORDER;
}

function getAgentSettingsMenuId(chatId: string, agentId: string): string {
  return `chat-settings-agent-menu-${chatId}-${agentId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
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
      return <Sparkles size={size} className={className} />;
    case "continuity":
      return <ShieldCheck size={size} className={className} />;
    case "knowledge-retrieval":
      return <Brain size={size} className={className} />;
    case "knowledge-router":
      return <ArrowRightLeft size={size} className={className} />;
    case "expression":
      return <Image size={size} className={className} />;
    case "echo-chamber":
      return <MessageCircle size={size} className={className} />;
    case "illustrator":
      return <Paintbrush size={size} className={className} />;
    case "spotify":
      return <Music2 size={size} className={className} />;
    case "haptic":
      return <Vibrate size={size} className={className} />;
    case "custom-agents":
      return <Bot size={size} className={className} />;
    default:
      return <Puzzle size={size} className={className} />;
  }
}

const HAPTIC_SENSITIVITY_OPTIONS: Array<{
  id: HapticFeedbackSensitivity;
  label: string;
  description: string;
}> = [
  { id: "subtle", label: "Subtle", description: "Lower intensity and shorter feedback." },
  { id: "standard", label: "Standard", description: "Balanced feedback for most scenes." },
  { id: "intense", label: "Intense", description: "Stronger feedback with a higher cap." },
];

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
    id: "uno",
    label: "UNO",
    description: "Let characters start a game of UNO at the table when you agree to play.",
  },
];

function normalizeSpotifySourceType(value: unknown): SpotifySourceType {
  return value === "playlist" || value === "artist" || value === "any" ? value : "liked";
}

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

const MODE_INTROS: Record<ChatMode, string> = {
  conversation:
    "Plain chat — no roleplay or game systems built in; autonomous messaging and other tools are optional below.",
  roleplay:
    "Plain roleplay surface — no built-in dice, combat, or GM pipeline; sprites, world-state tracking, and other helpers are available as optional agents below.",
  visual_novel:
    "Sprite- and background-driven roleplay — expressions, world state, and CYOA choices are available as optional agents below.",
  game: "Full Game Master with built-in dice, combat, encounters, world state, and session/map tracking — the Scene Analysis toggle below adds optional cinematic visuals (backgrounds, music, weather).",
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

const CHAT_PRESET_UNAPPLIED_SELECT_VALUE = "__chat_preset_unapplied__";

type AvailableAgent = {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
};

type DrawerPersona = {
  id: string;
  name: string;
  comment: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop | string | null;
};

type AgentAddPreview = {
  agent: AvailableAgent;
  config: AgentConfigRow | null;
  contextSize: number;
  maxTokens: number;
  runInterval: number | null;
  setup: AgentAddSetupState;
};

type KnowledgeAgentType = "knowledge-retrieval" | "knowledge-router";

function normalizeNarrativeDirectorMode(value: unknown): "natural" | "random" {
  return value === "random" ? "random" : "natural";
}

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

function getChatActiveAgentIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const activeIds =
    metadata && typeof metadata === "object" ? (metadata as { activeAgentIds?: unknown }).activeAgentIds : [];
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

function getChatActiveLorebookIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const activeIds =
    metadata && typeof metadata === "object" ? (metadata as { activeLorebookIds?: unknown }).activeLorebookIds : [];
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

function getChatExcludedLorebookIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const excludedIds =
    metadata && typeof metadata === "object" ? (metadata as { excludedLorebookIds?: unknown }).excludedLorebookIds : [];
  return Array.isArray(excludedIds) ? excludedIds.filter((id): id is string => typeof id === "string") : [];
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
  onSpriteSideChange,
  spriteVisualSettings,
  onSpriteVisualSettingsChange,
}: ChatSettingsDrawerProps) {
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scheduleControlsRef = useRef<HTMLDivElement | null>(null);
  const modePromptDefaultAppliedRef = useRef<string | null>(null);
  const updateChat = useUpdateChat();
  const updateMeta = useUpdateChatMetadata();
  const updateGameWidgets = useUpdateGameWidgets();
  const { data: regexScripts } = useRegexScripts();
  const updateRegexScript = useUpdateRegexScript();
  const updateAgentConfig = useUpdateAgent();
  const createAgent = useCreateAgent();
  const createMessage = useCreateMessage(chat.id);
  const connectChat = useConnectChat();
  const disconnectChat = useDisconnectChat();
  const { retryAgents } = useGenerate();
  const agentProcessing = useAgentStore((s) => s.isProcessing);
  const scheduleGenerationPreferences = useUIStore((s) => s.scheduleGenerationPreferences);
  const setScheduleGenerationPreferences = useUIStore((s) => s.setScheduleGenerationPreferences);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const imageSelfieWidth = useUIStore((s) => s.imageSelfieWidth);
  const imageSelfieHeight = useUIStore((s) => s.imageSelfieHeight);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const musicPlayerSource = useUIStore((s) => s.musicPlayerSource);
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);

  const { data: allCharacters } = useCharacters({ includeBuiltIn: true });
  const { data: characterGroups } = useCharacterGroups();
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: defaultPromptPreset } = useDefaultPreset();
  const chatMode = (chat as unknown as { mode?: ChatMode }).mode ?? "roleplay";
  const isConversation = chatMode === "conversation";
  const isGame = chatMode === "game";
  const isRoleplayMode = chatMode === "roleplay" || chatMode === "visual_novel";
  const supportsNarrativeDirectorSecretPlot = chatMode === "roleplay";
  const modeCapabilities = useMemo(() => getChatModeCapabilities(chatMode), [chatMode]);
  const metadata = useMemo(
    () => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {})),
    [chat.metadata],
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
  const textConnectionsList = useMemo(
    () =>
      filterLanguageGenerationConnections(
        (connections as Array<{ id: string; name: string; model?: string; provider?: string }>) ?? [],
      ),
    [connections],
  );
  const { data: allPersonas } = usePersonas();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: customTools } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const { data: allChats } = useChats();
  const personas = useMemo(() => (allPersonas ?? []) as DrawerPersona[], [allPersonas]);

  const chatCharIds: string[] = useMemo(
    () => (typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? [])),
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
  const activeLorebookIds = useMemo<string[]>(
    () => (Array.isArray(metadata.activeLorebookIds) ? metadata.activeLorebookIds : []),
    [metadata.activeLorebookIds],
  );
  const readLatestActiveLorebookIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    return latestChat ? getChatActiveLorebookIds(latestChat) : [...activeLorebookIds];
  }, [activeLorebookIds, chat.id, qc]);
  const excludedLorebookIds = useMemo<string[]>(
    () => (Array.isArray(metadata.excludedLorebookIds) ? metadata.excludedLorebookIds : []),
    [metadata.excludedLorebookIds],
  );
  const readLatestExcludedLorebookIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    return latestChat ? getChatExcludedLorebookIds(latestChat) : [...excludedLorebookIds];
  }, [chat.id, excludedLorebookIds, qc]);
  const gameLorebookKeeperEnabled = metadata.gameLorebookKeeperEnabled === true;
  const gameLorebookKeeperLorebookId =
    typeof metadata.gameLorebookKeeperLorebookId === "string" ? metadata.gameLorebookKeeperLorebookId : null;
  const activeLorebooks = useMemo<ActiveLorebookView[]>(() => {
    const pinnedIds = new Set(activeLorebookIds);
    const excludedIds = new Set(excludedLorebookIds);
    const lorebookList = (lorebooks ?? []) as Lorebook[];

    return lorebookList.flatMap((lorebook) => {
      if (
        isGame &&
        !gameLorebookKeeperEnabled &&
        (lorebook.id === gameLorebookKeeperLorebookId || lorebook.sourceAgentId === "game-lorebook-keeper")
      ) {
        return [];
      }

      const reasons: ActiveLorebookView["activeReasons"] = [];
      const isPinned = pinnedIds.has(lorebook.id);

      if (lorebook.enabled !== false && isLorebookScopeActiveForChat(lorebook.scope, chat.id)) {
        if (isPinned) reasons.push("Chat");
        if (lorebook.isGlobal) reasons.push("Global");
        if (
          lorebook.characterIds?.some((id) => chatCharIds.includes(id)) ||
          (lorebook.characterId && chatCharIds.includes(lorebook.characterId))
        ) {
          reasons.push("Character");
        }
        if (
          chat.personaId &&
          (lorebook.personaIds?.includes(chat.personaId) || lorebook.personaId === chat.personaId)
        ) {
          reasons.push("Persona");
        }
        if (lorebook.chatId === chat.id && !reasons.includes("Chat")) reasons.push("Chat");
      }

      return reasons.length > 0
        ? [{ ...lorebook, activeReasons: reasons, isPinned, isExcluded: excludedIds.has(lorebook.id) }]
        : [];
    });
  }, [
    activeLorebookIds,
    excludedLorebookIds,
    chat.id,
    chat.personaId,
    chatCharIds,
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
  const deletedBuiltInAgentTypes = useMemo(
    () =>
      new Set(
        ((agentConfigs ?? []) as AgentConfigRow[])
          .filter((config) => BUILT_IN_AGENTS.some((agent) => agent.id === config.type))
          .filter((config) => isAgentConfigDeleted(config.settings))
          .map((config) => config.type),
      ),
    [agentConfigs],
  );
  const activeAgentIds = useMemo<string[]>(
    () =>
      (Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : []).filter(
        (id: unknown): id is string => typeof id === "string" && !deletedBuiltInAgentTypes.has(id),
      ),
    [deletedBuiltInAgentTypes, metadata.activeAgentIds],
  );
  const readLatestActiveAgentIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const ids = latestChat ? getChatActiveAgentIds(latestChat) : [...activeAgentIds];
    return ids.filter((id) => !deletedBuiltInAgentTypes.has(id));
  }, [activeAgentIds, chat.id, deletedBuiltInAgentTypes, qc]);
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
  const gameSpotifySourceType = normalizeSpotifySourceType(metadata.gameSpotifySourceType);
  const gameSpotifyPlaylistId =
    typeof metadata.gameSpotifyPlaylistId === "string" ? metadata.gameSpotifyPlaylistId : "";
  const gameSpotifyArtist = typeof metadata.gameSpotifyArtist === "string" ? metadata.gameSpotifyArtist : "";
  const musicDjSettings = mergeBuiltInAgentSettings("spotify", agentConfigsByType.get("spotify")?.settings);
  const customMusicFolder = normalizeCustomMusicFolder(metadata.customMusicFolder ?? musicDjSettings.customMusicFolder);
  const gameMusicDjEnabled =
    metadata.gameUseMusicDj === true || gameUseSpotifyMusic || activeAgentIds.includes("youtube");
  const spriteCharacterIds: string[] = Array.isArray(metadata.spriteCharacterIds) ? metadata.spriteCharacterIds : [];
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
  const [expressionSpriteScalePercent, setExpressionSpriteScalePercent] = useState(() =>
    Math.round(expressionSpriteScale * 100),
  );
  const [fullBodySpriteScalePercent, setFullBodySpriteScalePercent] = useState(() =>
    Math.round(fullBodySpriteScale * 100),
  );
  const [expressionSpriteOpacityPercent, setExpressionSpriteOpacityPercent] = useState(() =>
    Math.round(expressionSpriteOpacity * 100),
  );
  const [fullBodySpriteOpacityPercent, setFullBodySpriteOpacityPercent] = useState(() =>
    Math.round(fullBodySpriteOpacity * 100),
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
    setExpressionSpriteScalePercent(Math.round(expressionSpriteScale * 100));
  }, [expressionSpriteScale]);

  useEffect(() => {
    setFullBodySpriteScalePercent(Math.round(fullBodySpriteScale * 100));
  }, [fullBodySpriteScale]);

  useEffect(() => {
    setExpressionSpriteOpacityPercent(Math.round(expressionSpriteOpacity * 100));
  }, [expressionSpriteOpacity]);

  useEffect(() => {
    setFullBodySpriteOpacityPercent(Math.round(fullBodySpriteOpacity * 100));
  }, [fullBodySpriteOpacity]);

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
        fallbackPromptTemplate: DEFAULT_AGENT_PROMPTS[agentId] || "",
        settings,
      });
    },
    [agentConfigsByType],
  );
  const conversationCommandsEnabled = metadata.characterCommands !== false;

  // Build the available agent list: built-in + custom agents from DB
  // Mode capabilities decide which built-ins are exposed for each chat mode.
  // Custom agents are user-authored and can be attached to any chat mode.
  const availableAgents = useMemo(() => {
    const agents: AvailableAgent[] = [];
    for (const a of BUILT_IN_AGENTS) {
      if (a.libraryHidden) continue;
      if (!isAgentAvailableInChatMode(chatMode, a.id)) continue;
      if (isAgentHiddenFromChatSettingsPicker(chatMode, a.id)) continue;
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
      });
    }
    // Custom agents from DB
    if (agentConfigs) {
      for (const c of agentConfigs as AgentConfigRow[]) {
        if (isAgentConfigDeleted(c.settings)) continue;
        if (isRetiredBuiltInAgentId(c.type)) continue;
        if (!BUILT_IN_AGENTS.some((b) => b.id === c.type)) {
          agents.push({
            id: c.type,
            name: c.name,
            description: c.description,
            category: "custom",
            phase: normalizeAgentPhaseForType(c.type, c.phase),
            builtIn: false,
            runtimeDisabled: false,
          });
        }
      }
    }
    return agents;
  }, [agentConfigs, agentConfigsByType, chatMode]);
  const visibleActiveAgentIds = useMemo(
    () => activeAgentIds.filter((agentId) => availableAgents.some((agent) => agent.id === agentId)),
    [activeAgentIds, availableAgents],
  );
  const getAgentDisplayMeta = useCallback(
    (agentId: string, fallback: { name: string; description: string }) => {
      const available = availableAgents.find((agent) => agent.id === agentId);
      const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentId);
      const config = agentConfigsByType.get(agentId);
      return {
        name: available?.name ?? builtIn?.name ?? config?.name ?? fallback.name,
        description: available?.description ?? config?.description ?? builtIn?.description ?? fallback.description,
      };
    },
    [agentConfigsByType, availableAgents],
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
    description: "Generates image prompts for key scenes (requires image generation API).",
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
        agentType: id,
        promptTemplate: cfg?.promptTemplate || "",
        fallbackPromptTemplate: DEFAULT_AGENT_PROMPTS[id] || "",
        settings,
        selectedPromptTemplateId: agentPromptTemplateSelections[id] ?? null,
      });
      return [
        {
          type: id,
          phase: meta.phase,
          connectionId: cfg?.connectionId ?? null,
          promptTemplate,
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
  const directorDefaults = useMemo(
    () => mergeBuiltInAgentSettings("director", directorConfig?.settings),
    [directorConfig?.settings],
  );
  const narrativeDirectorMode = normalizeNarrativeDirectorMode(
    metadata.narrativeDirectorMode ?? directorDefaults.directorMode,
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
  const secretPlotMessagesQuery = useChatMessages(
    chat.id,
    100,
    open && directorActive && supportsNarrativeDirectorSecretPlot && narrativeDirectorSecretPlotEnabled,
  );
  const secretPlotMessages = useMemo<Message[]>(
    () => secretPlotMessagesQuery.data?.pages.flat() ?? [],
    [secretPlotMessagesQuery.data?.pages],
  );
  const illustratorIncludeCharacterAppearance =
    typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
      ? metadata.illustratorIncludeCharacterAppearance
      : illustratorDefaults.includeCharacterAppearance === true;
  const illustratorUseAvatarReferences =
    typeof metadata.illustratorUseAvatarReferences === "boolean"
      ? metadata.illustratorUseAvatarReferences
      : illustratorDefaults.useAvatarReferences === true;
  const selfieUseAvatarReferences = metadata.selfieUseAvatarReferences === true;
  const gameImageUseAvatarReferences = metadata.gameImageUseAvatarReferences !== false;
  const gameImageIncludeCharacterAppearance = metadata.gameImageIncludeCharacterAppearance !== false;
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
        (continuityActive && continuityDefaults.holdForRewrite !== false);
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

  const commitProseGuardianSettings = useCallback(
    (patch: Record<string, unknown>) => {
      updateMeta.mutate({ id: chat.id, ...patch });
    },
    [chat.id, updateMeta],
  );
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
    addLink("knowledge-retrieval", knowledgeRetrievalActive, knowledgeRetrievalAgentMeta.name);
    addLink("knowledge-router", knowledgeRouterActive, knowledgeRouterAgentMeta.name);
    addLink("expression", expressionActive, expressionAgentMeta.name);
    addLink("echo-chamber", echoChamberActive, echoChamberAgentMeta.name);
    addLink("illustrator", illustratorActive, illustratorAgentMeta.name);
    addLink("spotify", spotifyActive, musicDjAgentMeta.name);
    addLink("haptic", hapticActive, hapticAgentMeta.name);
    if (activeCustomAgents.length > 0) {
      links.push({
        id: "custom-agents",
        label: activeCustomAgents.length === 1 ? activeCustomAgents[0]!.name : "Custom Agents",
        targetId: getAgentSettingsMenuId(chat.id, "custom-agents"),
        order: CUSTOM_AGENT_SETTINGS_ORDER,
        count: activeCustomAgents.length > 1 ? activeCustomAgents.length : undefined,
      });
    }
    return links.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [
    activeCustomAgents,
    cardEvolutionAuditorActive,
    cardEvolutionAuditorAgentMeta.name,
    chat.id,
    continuityActive,
    continuityAgentMeta.name,
    directorActive,
    directorAgentMeta.name,
    echoChamberActive,
    echoChamberAgentMeta.name,
    expressionActive,
    expressionAgentMeta.name,
    hapticActive,
    hapticAgentMeta.name,
    illustratorActive,
    illustratorAgentMeta.name,
    isGame,
    isRoleplayMode,
    knowledgeRetrievalActive,
    knowledgeRetrievalAgentMeta.name,
    knowledgeRouterActive,
    knowledgeRouterAgentMeta.name,
    lorebookKeeperActive,
    lorebookKeeperAgentMeta.name,
    metadata.enableAgents,
    musicDjAgentMeta.name,
    proseGuardianActive,
    proseGuardianAgentMeta.name,
    spotifyActive,
  ]);
  const scrollToAgentMenu = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }, []);
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
  }, [customToolCapabilities, customTools]);

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

  const chatSpriteSubjectsWithSprites = chatSpriteSubjects.filter((subject, index) => {
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

  const charAvatarCrop = useCallback((c: { data: unknown }) => {
    try {
      const parsed = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
      return (
        ((parsed as { extensions?: { avatarCrop?: AvatarCrop | null } } | null)?.extensions?.avatarCrop as
          | AvatarCrop
          | null
          | undefined) ?? null
      );
    } catch {
      return null;
    }
  }, []);

  // ── First message confirm state ──
  const [firstMesConfirm, setFirstMesConfirm] = useState<{
    charId: string;
    charName: string;
    message: string;
    alternateGreetings: string[];
  } | null>(null);

  const handleFirstMesConfirm = useCallback(async () => {
    if (!firstMesConfirm) return;
    const msg = await createMessage.mutateAsync({
      role: "assistant",
      content: firstMesConfirm.message,
      characterId: firstMesConfirm.charId,
    });
    // Add alternate greetings as swipes on the first message
    if (msg?.id && firstMesConfirm.alternateGreetings.length > 0) {
      for (const greeting of firstMesConfirm.alternateGreetings) {
        if (greeting.trim()) {
          await api.post(`/chats/${chat.id}/messages/${msg.id}/swipes`, { content: greeting, silent: true });
        }
      }
      qc.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
    }
    setFirstMesConfirm(null);
  }, [firstMesConfirm, createMessage, chat.id, qc]);

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
            try {
              const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
              const firstMes = (parsed as { first_mes?: string }).first_mes;
              const altGreetings = (parsed as { alternate_greetings?: string[] }).alternate_greetings ?? [];
              if (firstMes) {
                setFirstMesConfirm({
                  charId,
                  charName: charName(char),
                  message: firstMes,
                  alternateGreetings: altGreetings,
                });
              }
            } catch {
              /* ignore parse errors */
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
      if (current.length >= 3) return; // max 3
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

  const setSpriteSide = useCallback(
    (nextSide: "left" | "right") => {
      if (nextSide === spritePosition) return;
      if (onSpriteSideChange) {
        onSpriteSideChange(nextSide);
        return;
      }
      updateMeta.mutate({ id: chat.id, spritePosition: nextSide });
    },
    [chat.id, onSpriteSideChange, spritePosition, updateMeta],
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
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
  );

  const setFullBodySpriteScale = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_SCALE_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteScalePercent(clampedPercent);
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteScale: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteScale: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
  );

  const setExpressionSpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setExpressionSpriteOpacityPercent(clampedPercent);
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
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
  );

  const setFullBodySpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteOpacityPercent(clampedPercent);
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteOpacity: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteOpacity: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
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
          title: "Remove Narrative Director",
          message: warningMessage,
          confirmLabel: "Remove Agent",
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
    try {
      await updateMeta.mutateAsync(
        {
          id: chat.id,
          activeAgentIds: current,
          ...(nextPromptTemplateSelections ? { agentPromptTemplateIds: nextPromptTemplateSelections } : {}),
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
    } catch (error) {
      if (metadataSaved && isRemoving && agentId === "director") {
        const rollbackIds = Array.from(new Set([...readLatestActiveAgentIds(), agentId]));
        await updateMeta.mutateAsync({ id: chat.id, activeAgentIds: rollbackIds }).catch(() => undefined);
      }
      await showAlertDialog({
        title: isRemoving ? "Couldn't Remove Agent" : "Couldn't Add Agent",
        message: error instanceof Error ? error.message : "The agent list could not be updated. Please try again.",
      });
    }
  };

  const removeAgentFromMenu = async (agentId: string, agentName: string) => {
    const warningMessage = agentId === "director" ? await getNarrativeDirectorRemovalWarning() : null;
    const ok = await showConfirmDialog({
      title: `Remove ${agentName}?`,
      message: warningMessage ?? `Are you sure you want to remove ${agentName} from this chat?`,
      confirmLabel: "Remove Agent",
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

  const updateAgentPromptTemplateSelection = useCallback(
    (agentId: string, promptTemplateId: string) => {
      const next = { ...readLatestAgentPromptTemplateSelections() };
      if (!promptTemplateId || promptTemplateId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
        delete next[agentId];
      } else {
        next[agentId] = promptTemplateId;
      }
      updateMeta.mutate({ id: chat.id, agentPromptTemplateIds: next });
    },
    [chat.id, readLatestAgentPromptTemplateSelections, updateMeta],
  );

  const handleLorebookKeeperBackfill = useCallback(async () => {
    await retryAgents(chat.id, ["lorebook-keeper"], { lorebookKeeperBackfill: true });
  }, [chat.id, retryAgents]);

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
            if (!presetId) {
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
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
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
        const result = await api.post<ScheduleGenerationResponse>("/conversation/schedule/generate", {
          chatId: chat.id,
          characterIds: chatCharIds,
          forceRefresh,
          scheduleGenerationPreferences,
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
              `${summary} (${generatedCount} generated, ${sharedCount} reused, ${freshCount} already fresh).`,
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
          toast.success(`Schedules ready: ${parts.join(", ")}.`);
          return;
        }

        if (freshCount > 0) {
          toast.info(`Schedules are already up to date${freshCount > 1 ? ` for ${freshCount} characters` : ""}.`);
          return;
        }

        if (skippedCount > 0) {
          toast.info("No schedules were needed for the selected characters.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to generate schedules.");
      } finally {
        isRegeneratingSchedulesRef.current = false;
        setIsRegeneratingSchedules(false);
      }
    },
    [chat.id, chatCharIds, qc],
  );
  const [scenePromptExpanded, setScenePromptExpanded] = useState(false);
  const [scenePromptDraft, setScenePromptDraft] = useState(metadata.sceneSystemPrompt ?? "");
  const [groupScenarioDraft, setGroupScenarioDraft] = useState((metadata.groupScenarioText as string) ?? "");
  const [groupScenarioExpanded, setGroupScenarioExpanded] = useState(false);
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
  const [gamePromptDraft, setGamePromptDraft] = useState((metadata.gameSystemPrompt as string) ?? "");
  const [gamePromptExpanded, setGamePromptExpanded] = useState(false);
  const [gameSpecialInstructionsDraft, setGameSpecialInstructionsDraft] = useState(
    (metadata.gameSpecialInstructions as string) ?? "",
  );
  const [gameImagePromptInstructionsDraft, setGameImagePromptInstructionsDraft] = useState(
    (metadata.gameImagePromptInstructions as string) ?? "",
  );
  const [spotifyArtistDraft, setSpotifyArtistDraft] = useState(spotifyArtist);
  const [gameSpotifyArtistDraft, setGameSpotifyArtistDraft] = useState(gameSpotifyArtist);

  // ── Chat Settings Presets ──
  const presetMode = (chatMode === "visual_novel" ? "roleplay" : chatMode) as ChatMode;
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
    setGamePromptDraft((metadata.gameSystemPrompt as string) ?? "");
  }, [chat.id, metadata.gameSystemPrompt]);

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
        setGamePromptDraft("");
        updateMeta.mutate({ id: chat.id, gameSystemPrompt: null });
      }
    },
    [chat.id, fallbackPromptPreset?.id, isConversation, isGame, setPreset, updateMeta],
  );

  const openSelectedModePromptPreset = useCallback(() => {
    if (!effectiveModePromptPresetId) return;
    onClose();
    openPresetDetail(effectiveModePromptPresetId);
  }, [effectiveModePromptPresetId, onClose, openPresetDetail]);

  const openAgentAddModal = (agent: AvailableAgent) => {
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
  };

  const confirmAddAgent = async () => {
    if (!agentAddPreview) return;

    const { agent, config, contextSize, maxTokens, runInterval, setup } = agentAddPreview;
    const normalizedMaxTokens = normalizeAgentMaxTokens(maxTokens);
    const builtInMeta = BUILT_IN_AGENTS.find((entry) => entry.id === agent.id) ?? null;
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
      if (config) {
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
        }),
      });
      toast.success(`Added ${agent.name}! You can access its settings in Agents section in Chat Settings!`);
      setAgentAddPreview(null);
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
      const builtInMeta = BUILT_IN_AGENTS.find((entry) => entry.id === "spotify");
      if (!builtInMeta) throw new Error("Music DJ agent metadata is missing.");
      const config = agentConfigsByType.get("spotify") ?? null;
      const nextSettings: Record<string, unknown> = {
        ...mergeBuiltInAgentSettings("spotify", config?.settings),
        musicProvider: provider,
        musicPlayerSource: provider,
        customMusicFolder,
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
    [agentConfigsByType, createAgent, customMusicFolder, updateAgentConfig],
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
      toast.success("Game widgets updated.");
    } catch {
      toast.error("Failed to update game widgets.");
    }
  }, [chat.id, gameWidgetDrafts, updateGameWidgets]);

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
      title: "Duplicate Preset",
      message: "Name for the new preset:",
      defaultValue: `${selectedChatPreset.name} Copy`,
      confirmLabel: "Create",
    });
    if (!baseName?.trim()) return;
    const trimmed = baseName.trim().slice(0, 120);
    duplicateChatPreset.mutate(
      { id: selectedChatPreset.id, name: trimmed },
      {
        onSuccess: (created) => {
          if (!created) return;
          // Save the current chat settings into the new preset, then apply it
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
      title: "Delete Preset",
      message: `Delete preset "${selectedChatPreset.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    const wasApplied = selectedChatPreset.id === appliedPresetId;
    const defaultPreset = presetList.find((p) => p.isDefault);
    deleteChatPreset.mutate(selectedChatPreset.id, {
      onSuccess: () => {
        // If the chat was using the preset we just deleted, fall back to the
        // Default preset's settings — without this, the chat would visually
        // show "Default" but keep the deleted preset's actual values.
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
      `${selectedChatPreset.name}.marinara-chat-preset.json`,
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
      if (created?.id) applyChatPreset.mutate({ presetId: created.id, chatId: chat.id });
    } catch (err) {
      await showAlertDialog({
        title: "Import Failed",
        message: `Failed to import preset: ${err instanceof Error ? err.message : "Invalid file"}`,
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
        <button
          onClick={() => {
            updateMeta.mutate({ id: chat.id, enableMemoryRecall: !effectiveValue });
          }}
          className={cn(
            "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            effectiveValue && "mari-chat-option-field--active",
          )}
        >
          <div className="flex-1 min-w-0">
            <span className="text-[0.6875rem] font-medium">Enable Memory Recall</span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Recall relevant fragments from earlier in this chat and inject them as context.
            </p>
          </div>
          <div
            className={cn(
              "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
              effectiveValue && "mari-chat-option-switch--active",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                effectiveValue && "translate-x-3.5",
              )}
            />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setShowMemoriesModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
        >
          <Brain size="0.75rem" />
          Access memories for this chat
        </button>
      </div>
    );
  };

  const renderCustomAgentPicker = ({ showWhenEmpty = false }: { showWhenEmpty?: boolean } = {}) => {
    if (customAgents.length === 0 && !showWhenEmpty) return null;
    return (
      <AgentCategorySection
        label="Custom Agents"
        icon={<Settings2 size="0.75rem" />}
        description="Add your custom-created agents to this chat."
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
              No custom agents are available yet. Create one in the Agents panel, then attach it to this game here.
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
              Create Custom Agent
            </button>
          </div>
        ) : (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {isGame && !metadata.enableAgents
              ? "All custom agents are already attached. Enable Agents to configure or run them."
              : "All custom agents are active. Configure them below the other agent menus."}
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
        title="Custom Agents"
        description="Configure custom agents currently attached to this chat."
        order={CUSTOM_AGENT_SETTINGS_ORDER}
      >
        <div className="space-y-1.5">
          {activeCustomAgents.map((agent) => {
            const tokenEst = agentLoadCost.tokensByType.get(agent.id);
            const promptOptions = getPromptOptionsForAgent(agent.id);
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
                          title={`~${tokenEst.toLocaleString()} tokens of agent instructions (estimated)`}
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
                      void toggleAgent(agent.id);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    title="Remove from chat"
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
                <AgentPromptTemplateSelect
                  options={promptOptions}
                  selectedId={agentPromptTemplateSelections[agent.id] ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
                  onChange={(promptTemplateId) => updateAgentPromptTemplateSelection(agent.id, promptTemplateId)}
                />
              </div>
            );
          })}
        </div>
      </AgentSettingsCard>
    );
  };

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-chat-floating-panel]")) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onClose, open]);

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
      : { right: `${anchor.right}px`, top: `${anchor.top}px` }
    : undefined;

  return (
    <>
      {/* Floating panel */}
      <div
        ref={panelRef}
        data-chat-floating-panel
        className={cn(
          ROLEPLAY_POPOVER_SHELL,
          "mari-chat-settings-popover",
          "mari-chat-settings-drawer",
          "fixed bottom-3 z-[70] flex min-h-0 w-[min(34rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
        )}
        style={panelStyle}
      >
        {/* Header */}
        <div className={cn(ROLEPLAY_POPOVER_HEADER, "flex shrink-0 items-center justify-between")}>
          <h3 className={ROLEPLAY_POPOVER_TITLE}>
            <Settings2 size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            Chat Settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat settings"
            className={ROLEPLAY_POPOVER_CLOSE_BUTTON}
          >
            <X size={ROLEPLAY_POPOVER_CLOSE_ICON_SIZE} />
          </button>
        </div>

        <div
          className={cn(
            ROLEPLAY_POPOVER_SCROLL_AREA,
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]",
          )}
        >
          {/* Chat Settings Preset bar — hidden in Game Mode. Scene chats keep it, but scene instructions stay chat-owned. */}
          {modeCapabilities.supportsChatSettingsPresets && (
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
                    title="Apply a chat-settings preset to this chat"
                    className="flex-1 min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  >
                    {presetList.length === 0 && <option value="">Loading…</option>}
                    {!appliedChatPreset && presetList.length > 0 && (
                      <option value={CHAT_PRESET_UNAPPLIED_SELECT_VALUE}>
                        {appliedPresetId ? "Missing preset - choose a preset" : "Custom settings - choose a preset"}
                      </option>
                    )}
                    {presetList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isDefault ? "Default" : p.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleToggleDefaultPreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isActive || setActiveChatPreset.isPending}
                  title={
                    !selectedChatPreset
                      ? "Select a preset to mark it as default"
                      : selectedChatPreset.isActive
                        ? "This preset is the default for new chats in this mode"
                        : "Mark this preset as default for new chats in this mode"
                  }
                  aria-pressed={!!selectedChatPreset?.isActive}
                  aria-label={selectedChatPreset?.isActive ? "Default preset" : "Mark as default preset"}
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
                      ? "Presets bundle this chat's connection, prompt preset, agents, tools, translation, memory recall, advanced parameters, and other settings. They never touch your characters, persona, lorebooks, sprites, summary, tags, or scene prompt. Star a preset to use it as the default for new chats in this mode."
                      : "Presets bundle this chat's connection, prompt source, agents, tools, translation, memory recall, advanced parameters, and other settings. Characters, persona, lorebooks, sprites, summary, tags, and scene prompt stay tied to the chat. Star a preset to use it as the default for new chats in this mode."
                  }
                />
              </div>
              {/* Single row of all preset actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveIntoPreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={
                    selectedChatPreset?.isDefault
                      ? "Cannot save into the Default preset"
                      : "Save current chat settings into this preset"
                  }
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save size="0.875rem" />
                </button>
                <button
                  onClick={handleStartRenamePreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={selectedChatPreset?.isDefault ? "Cannot rename the Default preset" : "Rename preset"}
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size="0.875rem" />
                </button>
                <button
                  onClick={handleSaveAsPreset}
                  disabled={!selectedChatPreset}
                  title="Save current chat settings as a new preset"
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FilePlus2 size="0.875rem" />
                </button>
                <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />
                <button
                  onClick={handleImportClick}
                  title="Import preset (.json)"
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  <Download size="0.875rem" />
                </button>
                <button
                  onClick={handleExportPreset}
                  disabled={!selectedChatPreset}
                  title="Export preset (.json)"
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Upload size="0.875rem" />
                </button>
                <button
                  onClick={handleDeletePreset}
                  disabled={!selectedChatPreset || selectedChatPreset.isDefault}
                  title={selectedChatPreset?.isDefault ? "Cannot delete the Default preset" : "Delete preset"}
                  className="flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size="0.875rem" />
                </button>
              </div>
            </div>
          )}

          {/* Hardcoded — CHAT_MODES.defaultAgents looks like the source of truth but is currently
              unused, and wouldn't cover non-agent built-ins (GM pipeline, autonomous messaging, etc.) anyway. */}
          {MODE_INTROS[chatMode as ChatMode] && (
            <div
              style={{ order: CHAT_SETTINGS_ORDER.modeIntro }}
              className="border-b border-[var(--border)] px-4 py-2.5"
            >
              <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {MODE_INTROS[chatMode as ChatMode]}
              </p>
            </div>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.chatName }}>
            <ChatNameSection
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
              connections={textConnectionsList}
              isGame={isGame}
              onConnectionChange={setConnection}
            />
          </div>

          {/* Roleplay prompt preset */}
          {modeCapabilities.supportsPromptPresets && isRoleplayMode && !metadata.sceneSystemPrompt && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <PromptPresetSection
                promptPresetId={chat.promptPresetId ?? null}
                presets={promptPresetOptions}
                hasVariables={currentPromptPresetHasVariables}
                showLorebookMarkerWarning={showLorebookMarkerWarning}
                onEditVariables={() => {
                  if (chat.promptPresetId) setChoiceModalPresetId(chat.promptPresetId);
                }}
                onPromptPresetChange={setPreset}
              />
            </div>
          )}

          {/* Conversation/Game prompt preset */}
          {isConversation && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <ConversationPromptSection
                chatId={chat.id}
                customPrompt={(metadata.customSystemPrompt as string) ?? ""}
                promptPresetId={effectiveModePromptPresetId}
                promptPresets={promptPresetOptions}
                selectedPresetName={selectedModePromptPreset?.name ?? null}
                selectedPresetPrompt={selectedModePromptPreset?.conversationPrompt ?? ""}
                onCustomPromptChange={(id, customSystemPrompt) => updateMeta.mutate({ id, customSystemPrompt })}
                onPromptPresetChange={handleModePromptPresetChange}
                onOpenPromptPreset={openSelectedModePromptPreset}
              />
            </div>
          )}

          {isGame && (
            <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
              <GameExtraPromptSection
                expanded={gamePromptExpanded}
                storedValue={(metadata.gameSystemPrompt as string) ?? ""}
                value={gamePromptDraft}
                specialInstructionsValue={gameSpecialInstructionsDraft}
                promptPresetId={effectiveModePromptPresetId}
                promptPresets={promptPresetOptions}
                selectedPresetName={selectedModePromptPreset?.name ?? null}
                selectedPresetPrompt={selectedModePromptPreset?.gamePrompt ?? ""}
                onCommit={(gameSystemPrompt) => updateMeta.mutate({ id: chat.id, gameSystemPrompt })}
                onSpecialInstructionsCommit={(gameSpecialInstructions) =>
                  updateMeta.mutate({ id: chat.id, gameSpecialInstructions })
                }
                onExpandedChange={setGamePromptExpanded}
                onValueChange={setGamePromptDraft}
                onSpecialInstructionsChange={setGameSpecialInstructionsDraft}
                onPromptPresetChange={handleModePromptPresetChange}
                onOpenPromptPreset={openSelectedModePromptPreset}
              />
            </div>
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
              style={{ order: CHAT_SETTINGS_ORDER.persona }}
              label="Party"
              icon={<Users size="0.875rem" />}
              count={chatCharIds.length + (chat.personaId ? 1 : 0)}
              help="Your in-game party. Pick a persona to play as and manage which characters join the adventure."
            >
              <div className="space-y-1.5">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Persona</label>
                {chat.personaId ? (
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2 ring-1 ring-[var(--primary)]/30">
                    {(() => {
                      const p = personas.find((persona) => persona.id === chat.personaId);
                      return p ? (
                        <>
                          {p.avatarPath ? (
                            <img
                              src={p.avatarPath}
                              alt={p.name}
                              loading="lazy"
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="mari-avatar-placeholder mari-avatar-placeholder--persona flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                              <User size="0.75rem" />
                            </div>
                          )}
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
                        <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">Unknown persona</span>
                      );
                    })()}
                    <button
                      onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                      className="ml-auto shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                      title="Remove persona"
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No persona selected.</p>
                )}

                {!showPersonaPicker ? (
                  <button
                    onClick={() => {
                      setShowPersonaPicker(true);
                      setPersonaSearch("");
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Plus size="0.75rem" /> {chat.personaId ? "Change" : "Choose"} Persona
                  </button>
                ) : (
                  <PickerDropdown
                    search={personaSearch}
                    onSearchChange={setPersonaSearch}
                    onClose={() => setShowPersonaPicker(false)}
                    placeholder="Search personas..."
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
                      <span className="flex-1 truncate text-xs">None</span>
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
                          {p.avatarPath ? (
                            <img
                              src={p.avatarPath}
                              alt={p.name}
                              loading="lazy"
                              className="h-6 w-6 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="mari-avatar-placeholder mari-avatar-placeholder--persona flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                              <User size="0.625rem" />
                            </div>
                          )}
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
                        {personas.length === 0 ? "No personas created yet." : "No matches."}
                      </p>
                    )}
                  </PickerDropdown>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Party Characters</label>
                {chatCharIds.length === 0 ? (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No characters in party yet.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {chatCharIds.map((cid) => {
                      const c = characters.find((ch) => ch.id === cid);
                      if (!c) return null;
                      const name = charName(c);
                      const title = charTitle(c);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                        >
                          <button
                            onClick={() => {
                              onClose();
                              useUIStore.getState().openCharacterDetail(c.id);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                            title="Open character card"
                          >
                            {c.avatarPath ? (
                              <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full">
                                <img
                                  src={c.avatarPath}
                                  alt={name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                  style={getAvatarCropStyle(charAvatarCrop(c))}
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
                            onClick={() => toggleCharacter(c.id)}
                            className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                            title="Remove from party"
                          >
                            <Trash2 size="0.6875rem" />
                          </button>
                        </div>
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
                  <Plus size="0.75rem" /> Add Character to Party
                </button>
              ) : (
                <PickerDropdown
                  search={charSearch}
                  onSearchChange={setCharSearch}
                  onClose={() => setShowCharPicker(false)}
                  placeholder="Search characters…"
                >
                  {selectableCharacters
                    .filter((c) => !chatCharIds.includes(c.id))
                    .filter(
                      (c) =>
                        includesTextForMatch(charName(c), charSearch) ||
                        includesTextForMatch(charTitle(c) ?? "", charSearch),
                    )
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
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
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
              style={{ order: CHAT_SETTINGS_ORDER.persona }}
              label="Persona"
              icon={<User size="0.875rem" />}
              help="Your persona defines who you are in this chat. The AI will address you by this persona's name and use its details for context."
            >
              {/* Currently selected persona */}
              {chat.personaId ? (
                <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2">
                  {(() => {
                    const p = personas.find((p) => p.id === chat.personaId);
                    return p ? (
                      <>
                        {p.avatarPath ? (
                          <img
                            src={p.avatarPath}
                            alt={p.name}
                            loading="lazy"
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="mari-avatar-placeholder mari-avatar-placeholder--persona flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                            <User size="0.75rem" />
                          </div>
                        )}
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
                      <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">Unknown persona</span>
                    );
                  })()}
                  <button
                    onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                    className="ml-auto shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    title="Remove persona"
                  >
                    <X size="0.75rem" />
                  </button>
                </div>
              ) : (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No persona selected.</p>
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
                  <Plus size="0.75rem" /> {chat.personaId ? "Change" : "Choose"} Persona
                </button>
              ) : (
                <PickerDropdown
                  search={personaSearch}
                  onSearchChange={setPersonaSearch}
                  onClose={() => setShowPersonaPicker(false)}
                  placeholder="Search personas..."
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
                    <span className="flex-1 truncate text-xs">None</span>
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
                        {p.avatarPath ? (
                          <img
                            src={p.avatarPath}
                            alt={p.name}
                            loading="lazy"
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="mari-avatar-placeholder mari-avatar-placeholder--persona flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                            <User size="0.625rem" />
                          </div>
                        )}
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
                      {personas.length === 0 ? "No personas created yet." : "No matches."}
                    </p>
                  )}
                </PickerDropdown>
              )}
            </Section>
          )}

          {/* Characters — only show added ones + add button */}
          {!isGame && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.characters }}
              label="Characters"
              icon={<Users size="0.875rem" />}
              count={chatCharIds.length}
              help="Characters in this chat. Each character has their own personality that the AI roleplays as."
            >
              {/* Active characters */}
              {chatCharIds.length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No characters added to this chat.</p>
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
                            title="Drag to reorder"
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
                              useUIStore.getState().openCharacterDetail(c.id);
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left transition-colors hover:opacity-80"
                            title="Open character card"
                          >
                            {c.avatarPath ? (
                              <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full">
                                <img
                                  src={c.avatarPath}
                                  alt={name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                  style={getAvatarCropStyle(charAvatarCrop(c))}
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
                              title={inactiveCharacterIds.includes(c.id) ? "Enable in chat" : "Disable in chat"}
                            >
                              {inactiveCharacterIds.includes(c.id) ? (
                                <EyeOff size="0.6875rem" />
                              ) : (
                                <Eye size="0.6875rem" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => toggleCharacter(c.id)}
                            className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                            title="Remove from chat"
                          >
                            <Trash2 size="0.6875rem" />
                          </button>
                        </div>
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
                  <Plus size="0.75rem" /> Add Character
                </button>
              ) : (
                <PickerDropdown
                  search={charSearch}
                  onSearchChange={setCharSearch}
                  onClose={() => setShowCharPicker(false)}
                  placeholder="Search characters…"
                >
                  {selectableCharacters
                    .filter((c) => !chatCharIds.includes(c.id))
                    .filter(
                      (c) =>
                        includesTextForMatch(charName(c), charSearch) ||
                        includesTextForMatch(charTitle(c) ?? "", charSearch),
                    )
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
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                        >
                          {c.avatarPath ? (
                            <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full">
                              <img
                                src={c.avatarPath}
                                alt={name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                style={getAvatarCropStyle(charAvatarCrop(c))}
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
                    .filter(
                      (c) =>
                        includesTextForMatch(charName(c), charSearch) ||
                        includesTextForMatch(charTitle(c) ?? "", charSearch),
                    ).length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {selectableCharacters.filter((c) => !chatCharIds.includes(c.id)).length === 0
                        ? "All characters already added."
                        : "No matches."}
                    </p>
                  )}
                </PickerDropdown>
              )}

              {/* Add from Group picker */}
              {((characterGroups ?? []) as CharacterGroup[]).length > 0 &&
                (!showGroupPicker ? (
                  <button
                    onClick={() => setShowGroupPicker(true)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                  >
                    <Users size="0.75rem" /> Add from Group
                  </button>
                ) : (
                  <PickerDropdown
                    search=""
                    onSearchChange={() => {}}
                    onClose={() => setShowGroupPicker(false)}
                    placeholder="Select a group…"
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
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
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
                              {groupCharIds.length} characters
                              {newIds.length > 0 ? ` (· ${newIds.length} new)` : " (all added)"}
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
              style={{ order: CHAT_SETTINGS_ORDER.cardTheming }}
              label="Card Theming"
              icon={<Paintbrush size="0.875rem" />}
              help="Apply CSS embedded in a character's Creator Notes. Exclusive keeps each character's styling to their own messages; Chat applies it to the whole area."
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
                    Disabled
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
                    Exclusive
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
                    Chat
                  </button>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {cardCssMode === "disabled"
                    ? "Card CSS is off — no character styling is applied."
                    : cardCssMode === "exclusive"
                      ? "Each character's CSS only affects their own messages."
                      : "All card CSS affects the entire chat area, including UI elements."}
                </p>
              </div>
            </Section>
          )}

          {/* Scoped Regex Scripts — only shown when a chat character has scoped scripts */}
          {chatScopedRegexGroups.length > 0 && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.scopedRegex }}
              label="Scoped Regex Scripts"
              icon={<Regex size="0.875rem" />}
              count={scopedRegexCount}
              help="Apply character-scoped regex scripts to displayed messages. Exclusive runs each script only on its character's messages; Chat runs them on every message."
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
                    Disabled
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
                    Exclusive
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
                    Chat
                  </button>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {scopedRegexMode === "disabled"
                    ? "Character-scoped regex is off — only global scripts run."
                    : scopedRegexMode === "exclusive"
                      ? "Each scoped script only transforms its own character's messages."
                      : "All scoped scripts transform every message."}
                </p>
                {chatScopedRegexGroups.map((group) => (
                  <div key={group.characterId} className="rounded-lg ring-1 ring-[var(--border)]">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-medium text-[var(--foreground)]">
                        {group.name}
                      </span>
                      <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                        {group.scripts.length} script{group.scripts.length === 1 ? "" : "s"}
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
                            title={enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
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

          {/* Group Chat Settings — only when 2+ characters, game mode handles it internally */}
          {chatCharIds.length > 1 && modeCapabilities.supportsGroupChatControls && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.groupChat }}
              label="Group Chat"
              icon={<Users size="0.875rem" />}
              help={
                isConversation
                  ? "Configure whether group conversations reply automatically or wait for a manually triggered character response."
                  : "Configure how multiple characters interact. Merged mode combines all characters into one narrator; Individual mode has each character respond separately."
              }
            >
              {/* Mode selector */}
              {!isConversation && (
                <div className="space-y-2">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Mode</label>
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
                      Merged (Narrator)
                    </button>
                    <button
                      onClick={() => updateMeta.mutate({ id: chat.id, groupChatMode: "individual" })}
                      className={cn(
                        "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                        metadata.groupChatMode === "individual"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      Individual
                    </button>
                  </div>
                </div>
              )}

              {/* Merged mode: speaker color option */}
              {!isConversation && (metadata.groupChatMode ?? "merged") === "merged" && (
                <div className="mt-2">
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, groupSpeakerColors: !metadata.groupSpeakerColors })}
                    className={cn(
                      "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.groupSpeakerColors && "mari-chat-option-field--active",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.6875rem] font-medium">Color Dialogues</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        Color character dialogues differently using the special tags. The colors are assigned based on
                        what you chose in the Color tab for your Character.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.groupSpeakerColors && "mari-chat-option-switch--active",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.groupSpeakerColors && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                </div>
              )}

              {/* Individual mode: response order */}
              {!isConversation && metadata.groupChatMode === "individual" && (
                <div className="mt-2 space-y-2">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Response Order</label>
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
                      Sequential
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
                      Smart
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
                      Manual
                    </button>
                  </div>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {metadata.groupResponseOrder === "manual"
                      ? "No automatic responses — use the character picker in the input bar to trigger responses one at a time."
                      : metadata.groupResponseOrder === "smart"
                        ? "An AI agent decides which characters should respond based on the scene context."
                        : "Characters respond one by one in their listed order."}
                  </p>
                  <button
                    onClick={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        groupTurnPromptEnabled: metadata.groupTurnPromptEnabled === false,
                      })
                    }
                    className={cn(
                      "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.groupTurnPromptEnabled !== false && "mari-chat-option-field--active",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.6875rem] font-medium">Add Turn To Prompt</span>
                      <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                        {metadata.groupTurnPromptEnabled !== false
                          ? "Each individual turn includes a short responding-character instruction."
                          : "Individual turns rely on context without adding a turn instruction."}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mari-chat-option-switch ml-3 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.groupTurnPromptEnabled !== false && "mari-chat-option-switch--active",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.groupTurnPromptEnabled !== false && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        groupSpeakerNamesInHistory: metadata.groupSpeakerNamesInHistory !== true,
                      })
                    }
                    className={cn(
                      "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.groupSpeakerNamesInHistory === true && "mari-chat-option-field--active",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.6875rem] font-medium">Name Prefix History</span>
                      <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                        {metadata.groupSpeakerNamesInHistory === true
                          ? "History turns are sent as Name: message before merged role blocks."
                          : "History turns keep their stored text before role merging."}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mari-chat-option-switch ml-3 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.groupSpeakerNamesInHistory === true && "mari-chat-option-switch--active",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.groupSpeakerNamesInHistory === true && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                </div>
              )}

              {/* Scenario Override */}
              {!isConversation && (
                <div className="mt-2 space-y-1.5">
                  <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Scenario Override
                  </label>
                  <div className="relative">
                    <textarea
                      value={groupScenarioDraft}
                      onChange={(e) => setGroupScenarioDraft(e.target.value)}
                      onBlur={() => {
                        if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                          updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
                        }
                      }}
                      placeholder="Replace individual character scenarios with a shared scenario for this group chat or leave empty to keep them…"
                      rows={4}
                      className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                    />
                    <button
                      onClick={() => setGroupScenarioExpanded(true)}
                      className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      title="Expand editor"
                    >
                      <Maximize2 size="0.75rem" />
                    </button>
                  </div>
                  <ExpandedTextarea
                    open={groupScenarioExpanded}
                    onClose={() => {
                      setGroupScenarioExpanded(false);
                      if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                        updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
                      }
                    }}
                    title="Group Scenario Override"
                    value={groupScenarioDraft}
                    onChange={setGroupScenarioDraft}
                    placeholder="Replace individual character scenarios with a shared scenario for this group chat or leave empty to keep them…"
                  />
                </div>
              )}
            </Section>
          )}

          {/* Autonomous Messaging — conversation mode only */}
          {isConversation && (
            <Section
              label="Autonomous Messaging"
              icon={<Bot size="0.875rem" />}
              help="Characters can message you unprompted based on their personality, your status, and optional schedules. Chatty characters will reach out sooner when you're inactive."
              initialOpen={initialSection === "autonomous"}
            >
              <div className="space-y-2">
                {/* Enable autonomous messages toggle */}
                <div
                  className={cn(
                    "mari-chat-option-field rounded-lg transition-all",
                    metadata.autonomousMessages && "mari-chat-option-field--active",
                  )}
                >
                  <button
                    onClick={() => {
                      updateMeta.mutate({ id: chat.id, autonomousMessages: !metadata.autonomousMessages });
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">Autonomous Messages</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        Characters message you when you&apos;re inactive, even without schedules
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.autonomousMessages && "mari-chat-option-switch--active",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.autonomousMessages && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>

                  {metadata.autonomousMessages && (
                    <div className="border-t border-[var(--border)]/50 px-3 pb-2.5 pt-2">
                      <label className="space-y-1.5">
                        <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          Daily Check-In Cap
                        </span>
                        <select
                          value={autonomousDailyCapOverride ?? ""}
                          onChange={(e) =>
                            updateMeta.mutate({
                              id: chat.id,
                              autonomousDailyCapOverride: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                        >
                          <option value="">Default (talkativeness-based)</option>
                          {AUTONOMOUS_DAILY_CAP_OPTIONS.map((cap) => (
                            <option key={cap} value={cap}>
                              {cap} check-in{cap === 1 ? "" : "s"} / day
                            </option>
                          ))}
                        </select>
                        <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                          Overrides the talkativeness-based daily limit for each character.
                        </p>
                      </label>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const onlyWhenMentioned = metadata.groupResponseOrder === "manual";
                    updateMeta.mutate({
                      id: chat.id,
                      groupResponseOrder: onlyWhenMentioned ? "sequential" : "manual",
                    });
                  }}
                  className={cn(
                    "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.groupResponseOrder === "manual" && "mari-chat-option-field--active",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">Reply When Mentioned</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Characters wait for direct mentions or manual response triggers
                    </p>
                  </div>
                  <div
                    className={cn(
                      "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      metadata.groupResponseOrder === "manual" && "mari-chat-option-switch--active",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.groupResponseOrder === "manual" && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>

                {/* Character exchanges toggle (group chats only) */}
                {chatCharIds.length > 1 && (
                  <button
                    onClick={() => {
                      updateMeta.mutate({ id: chat.id, characterExchanges: !metadata.characterExchanges });
                    }}
                    className={cn(
                      "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.characterExchanges && "mari-chat-option-field--active",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">Character Exchanges</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        Characters chat with each other in group chats
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        metadata.characterExchanges && "mari-chat-option-switch--active",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.characterExchanges && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                )}

                {/* Conversation schedules toggle */}
                <button
                  onClick={() => {
                    const nextEnabled = !conversationSchedulesEnabled;
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
                  className={cn(
                    "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    conversationSchedulesEnabled && "mari-chat-option-field--active",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">Schedules</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Optional character routines for availability and delays
                    </p>
                  </div>
                  <div
                    className={cn(
                      "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      conversationSchedulesEnabled && "mari-chat-option-switch--active",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        conversationSchedulesEnabled && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>

                <div ref={scheduleControlsRef} className="scroll-mt-2 space-y-2">
                  {/* Schedule status */}
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                        {!conversationSchedulesEnabled
                          ? "Schedules are off: autonomy uses talkativeness and your status."
                          : hasGeneratedConversationSchedules
                            ? "Schedules generated — status is derived from character routines."
                            : "Schedules enabled — generate routines when you're ready."}
                      </span>
                      <p className="text-[0.59375rem] mt-0.5 text-[var(--muted-foreground)]/60">
                        {conversationSchedulesEnabled
                          ? "Schedules refresh only after you enable or regenerate them."
                          : "Turn schedules on if you want availability and busy delays to matter."}
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
                      title={isRegeneratingSchedules ? "Regenerating schedules…" : "Generate schedules"}
                    >
                      <RefreshCw size="0.6875rem" className={cn(isRegeneratingSchedules && "animate-spin")} />
                      {isRegeneratingSchedules
                        ? "Regenerating…"
                        : hasGeneratedConversationSchedules
                          ? "Regenerate"
                          : "Generate"}
                    </button>
                  </div>

                  {/* Schedule editor per character */}
                  {conversationSchedulesEnabled && hasGeneratedConversationSchedules && (
                    <ScheduleEditor
                      characterSchedules={metadata.characterSchedules}
                      chatCharIds={chatCharIds}
                      charNameMap={charNameMap}
                      onSave={(updated) => {
                        updateMeta.mutate({ id: chat.id, characterSchedules: updated });
                      }}
                    />
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Commands — conversation mode only */}
          {isConversation && (
            <Section
              label="Commands"
              icon={<Sparkles size="0.875rem" />}
              help="Allow characters to use hidden command tags for actions that happen outside the visible message."
            >
              <div className="space-y-3">
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, characterCommands: !conversationCommandsEnabled });
                  }}
                  className={cn(
                    "mari-chat-option-field flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    conversationCommandsEnabled && "mari-chat-option-field--active",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium">Commands</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Allow models to interact with you via commands. This way, they can send you selfies, play songs
                      for you, change their schedules, start scenes, and do much more!
                    </p>
                  </div>
                  <div
                    className={cn(
                      "mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      conversationCommandsEnabled && "mari-chat-option-switch--active",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        conversationCommandsEnabled && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>

                {conversationCommandsEnabled && (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {CONVERSATION_COMMAND_TOGGLE_OPTIONS.map((command) => {
                      const enabled = isConversationCommandToggleEnabled(conversationCommandToggles, command.id);
                      return (
                        <button
                          key={command.id}
                          type="button"
                          onClick={() =>
                            updateMeta.mutate({
                              id: chat.id,
                              conversationCommandToggles: {
                                ...conversationCommandToggles,
                                [command.id]: !enabled,
                              },
                            })
                          }
                          className={cn(
                            "mari-chat-option-field flex min-h-[4.125rem] items-start justify-between gap-2 rounded-lg px-3 py-2 text-left transition-all",
                            enabled && "mari-chat-option-field--active",
                          )}
                          aria-pressed={enabled}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
                              {command.label}
                            </span>
                            <p className="mt-0.5 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                              {command.description}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "mari-chat-option-switch mt-0.5 h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors",
                              enabled && "mari-chat-option-switch--active",
                            )}
                          >
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                                enabled && "translate-x-3",
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selfie Connection — connection picker for character selfies */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Selfie Connection</span>
                  <select
                    value={(metadata.imageGenConnectionId as string) ?? ""}
                    onChange={(e) => updateMeta.mutate({ id: chat.id, imageGenConnectionId: e.target.value || null })}
                    className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  >
                    <option value="">None (selfies disabled)</option>
                    {imageConnectionsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.provider})
                      </option>
                    ))}
                  </select>
                  <label className="block">
                    <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      Image style
                    </span>
                    <select
                      value={(metadata.imageStyleProfileId as string) ?? ""}
                      onChange={(e) => updateMeta.mutate({ id: chat.id, imageStyleProfileId: e.target.value || null })}
                      className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                    >
                      <option value="">Use default style from Style Profiles in Advanced settings</option>
                      {imageStyleProfiles.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <AgentSettingsToggle
                    label="Send Avatar References"
                    description="Send the matching character avatar or sprite as a reference image for generated selfies when the provider supports it."
                    enabled={selfieUseAvatarReferences}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        selfieUseAvatarReferences: !selfieUseAvatarReferences,
                      })
                    }
                  />
                  <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                    Used for character selfies when Commands are enabled. The Illustrator agent uses its own connection
                    from the Agents tab.
                  </p>

                  {/* Selfie resolution picker */}
                  {(metadata.imageGenConnectionId as string) && (
                    <div className="mt-2 space-y-1">
                      <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Resolution</span>
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
                            (metadata.selfieResolution as string) ?? `${imageSelfieWidth}x${imageSelfieHeight}`;
                          const val = `${opt.w}x${opt.h}`;
                          const active = current === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateMeta.mutate({ id: chat.id, selfieResolution: val })}
                              className={`rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors ${
                                active
                                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                        {(() => {
                          const inactiveCustom = availableAgents.filter(
                            (agent) => agent.category === "custom" && !activeAgentIds.includes(agent.id),
                          );
                          if (inactiveCustom.length === 0) return null;
                          return (
                            <div className="mt-2 rounded-lg bg-[var(--background)]/55 p-2 ring-1 ring-[var(--border)]">
                              <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                <Settings2 size="0.6875rem" />
                                Custom Agents
                              </div>
                              <div className="flex flex-col gap-1">
                                {inactiveCustom.map((agent) => (
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
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Selfie prompt controls */}
                  {(metadata.imageGenConnectionId as string) && (
                    <SelfiePromptControls
                      promptTemplate={metadata.selfiePrompt as string | null | undefined}
                      positivePrompt={metadata.selfiePositivePrompt as string | undefined}
                      legacyTags={(metadata.selfieTags as string[]) ?? []}
                      negativePrompt={(metadata.selfieNegativePrompt as string) ?? ""}
                      onCommitPromptTemplate={(selfiePrompt) => updateMeta.mutate({ id: chat.id, selfiePrompt })}
                      onCommitPositivePrompt={(selfiePositivePrompt) =>
                        updateMeta.mutate({ id: chat.id, selfiePositivePrompt })
                      }
                      onCommitNegativePrompt={(selfieNegativePrompt) =>
                        updateMeta.mutate({ id: chat.id, selfieNegativePrompt })
                      }
                    />
                  )}
                </div>

                {/* Schedule generation preferences — free-form authorial guidance */}
                <label className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    Schedule generation preferences
                    <HelpTooltip text="Free-form guidance that steers how character schedules are generated. Both directives ('no characters past midnight') and factual constraints ('I work 9-5') work. This setting is global, it applies to every conversation chat." />
                  </span>
                  <textarea
                    value={scheduleGenerationPreferences}
                    onChange={(e) => setScheduleGenerationPreferences(e.target.value)}
                    placeholder="e.g. Make everyone go to sleep before midnight. Give characters free time 10am-noon. I work 9-5 on weekdays."
                    className="min-h-[5rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 placeholder:text-[var(--muted-foreground)]/40"
                  />
                  <p className="text-[0.59375rem] text-[var(--muted-foreground)]/70">
                    Global setting. Applies to every conversation chat&apos;s next schedule regeneration, manual or
                    weekly auto.
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
                        Schedule generation preference active
                      </span>
                      <p className="mt-0.5 truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                        "{scheduleGenerationPreferences.trim()}"
                      </p>
                      <p className="mt-1 text-[0.59375rem] text-[var(--muted-foreground)]/70">
                        Will be applied the next time schedules are regenerated.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Cross-Chat Awareness — conversation mode only */}
          {isConversation && (
            <Section
              label="Cross-Chat Awareness"
              icon={<Link size="0.875rem" />}
              help="Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context."
            >
              <button
                onClick={() => {
                  updateMeta.mutate({
                    id: chat.id,
                    crossChatAwareness: metadata.crossChatAwareness === false ? true : false,
                  });
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                  metadata.crossChatAwareness !== false
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">Cross-Chat Awareness</span>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Characters know what happens in their other chats
                  </p>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                    metadata.crossChatAwareness !== false ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      metadata.crossChatAwareness !== false && "translate-x-3.5",
                    )}
                  />
                </div>
              </button>
            </Section>
          )}

          {/* Connected Roleplay — conversation mode: link to a roleplay or game chat */}
          {isConversation && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label="Connected Chats"
              icon={<ArrowRightLeft size="0.875rem" />}
              help="Link this conversation to a roleplay or game. Recent messages from the linked chat are pulled into context here automatically. To send something the other direction, the character uses `<influence>` (steers the next linked turn, one-shot) or `<note>` (persists on every future linked turn until cleared)."
            >
              {chat.connectedChatId ? (
                (() => {
                  const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                  return (
                    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                      <ArrowRightLeft size="0.875rem" className="text-[var(--primary)]" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate text-xs font-medium">
                          {linked ? getConnectedChatDisplayName(linked) : "Unknown chat"}
                        </span>
                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          {linked ? (linked.mode === "roleplay" ? "Roleplay" : linked.mode) : "Deleted"}
                        </p>
                      </div>
                      <button
                        onClick={() => disconnectChat.mutate(chat.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Disconnect"
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
                  <Plus size="0.75rem" /> Link to Roleplay or Game
                </button>
              ) : (
                <PickerDropdown
                  search={connectionSearch}
                  onSearchChange={setConnectionSearch}
                  onClose={() => setShowConnectionPicker(false)}
                  placeholder="Search roleplay or game chats…"
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
                        <MessageSquare size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                      </button>
                    ))}
                </PickerDropdown>
              )}
              <DiscordMirrorControls
                webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
              />
            </Section>
          )}

          {/* Connected Conversation — roleplay mode: linked OOC chat + optional in-world DM command */}
          {isRoleplayMode && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label="Connected Chats"
              icon={<ArrowRightLeft size="0.875rem" />}
              help={
                'Link to an OOC conversation, and optionally let roleplay characters open direct-message conversations with `[dm: character="Name" message="text"]` when it naturally fits the scene.'
              }
            >
              <div className="space-y-2">
                {chat.connectedChatId ? (
                  (() => {
                    const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                    return (
                      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                        <MessageCircle size="0.875rem" className="text-[var(--primary)]" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate text-xs font-medium">
                            {linked ? getConnectedChatDisplayName(linked) : "Unknown chat"}
                          </span>
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">Conversation</p>
                        </div>
                        <button
                          onClick={() => disconnectChat.mutate(chat.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Disconnect"
                        >
                          <Unlink size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    No OOC conversation is linked. Direct-message commands can still create new Conversation DMs.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    updateMeta.mutate({
                      id: chat.id,
                      roleplayDmCommandsEnabled: metadata.roleplayDmCommandsEnabled !== true,
                    })
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.roleplayDmCommandsEnabled === true
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] font-medium">Allow character DMs</span>
                    <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      Adds a short hidden command reminder so characters can open a new DM conversation when they text
                      the user in-world.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      metadata.roleplayDmCommandsEnabled === true
                        ? "bg-[var(--primary)]"
                        : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.roleplayDmCommandsEnabled === true && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
                <DiscordMirrorControls
                  webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                  onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
                />
              </div>
            </Section>
          )}

          {/* Connected Conversation — game mode: show linked OOC chat */}
          {isGame && chat.connectedChatId && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label="Connected Chats"
              icon={<ArrowRightLeft size="0.875rem" />}
              help="Linked to a conversation. `<influence>` tags from the conversation steer the next turn here (one-shot, then consumed). `<note>` tags persist on every turn until cleared. Raw conversation messages are not injected — use `<note>` for facts this chat should keep remembering."
            >
              {(() => {
                const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                return (
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                    <MessageCircle size="0.875rem" className="text-[var(--primary)]" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-xs font-medium">
                        {linked ? getConnectedChatDisplayName(linked) : "Unknown chat"}
                      </span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">Conversation</p>
                    </div>
                    <button
                      onClick={() => disconnectChat.mutate(chat.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                      title="Disconnect"
                    >
                      <Unlink size="0.6875rem" />
                    </button>
                  </div>
                );
              })()}
              <DiscordMirrorControls
                webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
              />
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
              style={{ order: CHAT_SETTINGS_ORDER.connectedChat }}
              label="Connected Chats"
              icon={<ArrowRightLeft size="0.875rem" />}
              help="Link this game to an OOC conversation. The conversation character uses `<influence>` (one-shot) or `<note>` (durable) to bridge content into the game; raw conversation messages are not injected. Game events and roleplay moments flow back into the conversation automatically."
            >
              {!showConnectionPicker ? (
                <button
                  onClick={() => {
                    setShowConnectionPicker(true);
                    setConnectionSearch("");
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> Link to Conversation
                </button>
              ) : (
                <PickerDropdown
                  search={connectionSearch}
                  onSearchChange={setConnectionSearch}
                  onClose={() => setShowConnectionPicker(false)}
                  placeholder="Search conversation chats…"
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
                        <MessageSquare size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                      </button>
                    ))}
                </PickerDropdown>
              )}
              <DiscordMirrorControls
                webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
                onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
              />
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
              onToggleLorebook={toggleLorebook}
              onSetLorebookExcluded={setLorebookExcluded}
            />
          </div>

          {/* Agents */}
          {modeCapabilities.sharedSections.includes("agents") && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.agents }}
              label="Agents"
              icon={<Sparkles size="0.875rem" />}
              count={isGame ? gameAgentFeatureCount : visibleActiveAgentIds.length}
              help="When enabled, AI agents run automatically during generation to enrich the chat with world state tracking, expression detection, and more."
            >
              <div className="space-y-2">
                {isGame && metadata.enableAgents && (
                  <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    Toggle scene analysis and custom agents for this game session. Roleplay-only built-ins stay hidden
                    so the game's format doesn't break.
                  </p>
                )}
                <button
                  onClick={() => {
                    updateMeta.mutate({ id: chat.id, enableAgents: !metadata.enableAgents });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                    metadata.enableAgents
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">Enable Agents</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {isGame
                        ? "Run scene analysis and any attached custom agents during generation."
                        : "Run AI agents during generation (world state, expressions, etc.)"}
                    </p>
                    {isGame &&
                      metadata.enableAgents &&
                      (() => {
                        const setupCfg = metadata.gameSetupConfig as Record<string, unknown> | undefined;
                        const sceneConnId =
                          (metadata.gameSceneConnectionId as string) || (setupCfg?.sceneConnectionId as string) || null;
                        const sceneConn = sceneConnId
                          ? ((connections ?? []) as Array<{ id: string; name: string; model?: string }>).find(
                              (c) => c.id === sceneConnId,
                            )
                          : null;
                        const label = sceneConn
                          ? `${sceneConn.name}${sceneConn.model ? ` — ${sceneConn.model}` : ""}`
                          : "Local sidecar (Gemma)";
                        return <p className="mt-0.5 text-[0.55rem] text-[var(--primary)]/70">{label}</p>;
                      })()}
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      metadata.enableAgents ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        metadata.enableAgents && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
                <AgentSettingsToggle
                  label="Review Agent Outputs"
                  description={
                    agentWriteApprovalRequired
                      ? "Lorebook, summary, character card updates, and reviewable writer-agent outputs wait for your approval."
                      : "Lorebook and summary updates can be committed automatically. Character card edits still ask first."
                  }
                  enabled={agentWriteApprovalRequired}
                  onToggle={() =>
                    updateMeta.mutate({
                      id: chat.id,
                      agentWriteApprovalRequired: !agentWriteApprovalRequired,
                    })
                  }
                />
                {/* Manual trackers run only in roleplay-style chats. */}
                {metadata.enableAgents && isRoleplayMode && (
                  <button
                    onClick={() => updateMeta.mutate({ id: chat.id, manualTrackers: !metadata.manualTrackers })}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                      metadata.manualTrackers
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <div>
                      <span className="text-[0.6875rem] font-medium">Manual Trackers</span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {metadata.manualTrackers
                          ? "Trackers won't run automatically — use the button in the HUD to trigger them."
                          : "Trackers run automatically after every generation."}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors shrink-0",
                        metadata.manualTrackers ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          metadata.manualTrackers && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>
                )}
                {roleplayAgentMenuLinks.length > 0 && (
                  <div className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      <ChevronRight size="0.6875rem" className="shrink-0" />
                      <span>Agent Menus</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {roleplayAgentMenuLinks.map((link) => (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() => scrollToAgentMenu(link.targetId)}
                          className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/60"
                          title={`Jump to ${link.label}`}
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
                      {import.meta.env.VITE_MARINARA_LITE !== "true" && <option value="">Local sidecar (Gemma)</option>}
                      {((connections ?? []) as Array<{ id: string; name: string; model?: string }>)
                        .filter((c) => (c as { provider?: string }).provider !== "image_generation")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.model ? ` — ${c.model}` : ""}
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
                      label="Game Session Keeper"
                      description="Game Mode runs this after a session ends with separate game-specific instructions."
                      enabled={gameLorebookKeeperEnabled}
                      onToggle={toggleGameLorebookKeeper}
                    />
                    {gameLorebookKeeperLorebook && (
                      <p className="truncate rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                        Target:{" "}
                        <span className="font-medium text-[var(--foreground)]">{gameLorebookKeeperLorebook.name}</span>
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
                      label="Music DJ"
                      description={`Active player: ${getMusicProviderLabel(musicPlayerSource)}.`}
                      enabled={gameMusicDjEnabled}
                      onToggle={() => void toggleGameMusicDj()}
                    />

                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/65 p-1">
                      {(["spotify", "youtube", "custom"] as const).map((provider) => {
                        const active = musicPlayerSource === provider;
                        return (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => void changeMusicDjProvider(provider)}
                            className={cn(
                              "rounded-lg px-2 py-1.5 text-[0.625rem] font-semibold transition-colors",
                              active
                                ? "bg-[var(--primary)]/18 text-[var(--foreground)] shadow-sm"
                                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            )}
                          >
                            {getMusicProviderLabel(provider)}
                          </button>
                        );
                      })}
                    </div>

                    {gameMusicDjEnabled && musicPlayerSource === "spotify" && (
                      <div className="space-y-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                            Spotify source
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
                            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Playlist</span>
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
                                <option value="">Choose playlist...</option>
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
                                  spotifyPlaylistsQuery.isFetching ? "Loading playlists..." : "Paste playlist ID"
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                              />
                            )}
                            {spotifyPlaylistsQuery.isError && (
                              <span className="text-[0.5625rem] text-amber-400/90">
                                Connect Spotify in the Music DJ agent to load playlist names.
                              </span>
                            )}
                          </label>
                        )}

                        {gameSpotifySourceType === "artist" && (
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Artist</span>
                            <input
                              value={gameSpotifyArtistDraft}
                              onChange={(event) => setGameSpotifyArtistDraft(event.target.value)}
                              onBlur={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameSpotifyArtist: gameSpotifyArtistDraft.trim() || null,
                                })
                              }
                              placeholder="HOYO-MiX"
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {gameMusicDjEnabled && musicPlayerSource === "custom" && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          Custom music folder
                        </span>
                        <input
                          key={`${chat.id}-game-custom-music-${customMusicFolder}`}
                          defaultValue={customMusicFolder}
                          onBlur={(event) => void saveCustomMusicFolder(event.target.value)}
                          placeholder="music"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                        />
                        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                          Reads local audio from Game Assets, for example <code>music</code> or{" "}
                          <code>music/combat</code>.
                        </span>
                      </label>
                    )}
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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                          <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                            Chat Lorebook Keeper runs after assistant replies. Game Mode has a separate session-end
                            keeper with different instructions.
                          </p>
                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                useUIStore.getState().openAgentDetail("lorebook-keeper");
                              }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--background)]/80 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                            >
                              <Settings2 size="0.75rem" />
                              <span>Open Setup</span>
                            </button>
                            <button
                              onClick={handleLorebookKeeperBackfill}
                              disabled={agentProcessing}
                              className={cn(
                                "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.6875rem] font-medium transition-colors",
                                agentProcessing
                                  ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)]"
                                  : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15",
                              )}
                            >
                              <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
                              <span>Backfill Unprocessed</span>
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
                            <span className="font-medium text-[var(--foreground)]">Target Lorebook</span>
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
                              <option value="">Auto-select first writable lorebook</option>
                              {((lorebooks ?? []) as Array<{ id: string; name: string }>).map((lorebook) => (
                                <option key={lorebook.id} value={lorebook.id}>
                                  {lorebook.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
                            <span className="font-medium text-[var(--foreground)]">Read Behind</span>
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
                          Read-behind uses assistant messages: 0 means the newest eligible reply, 1 waits one reply, and
                          backfill only processes messages Lorebook Keeper has not already saved.
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
                            This agent never edits cards directly. It proposes exact oldText/newText replacements from
                            durable roleplay changes, then asks you to review, edit, approve, or regenerate them.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              useUIStore.getState().openAgentDetail("card-evolution-auditor");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
                          >
                            <Settings2 size="0.75rem" />
                            <span>Open Auditor Setup</span>
                          </button>
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
                          label="Banned Words"
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
                          label="Remove From Writing"
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
                          label="Prefer In Writing"
                          value={proseGuardianStyleDraft}
                          placeholder="Optional style notes, phrases, or authorial preferences."
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
                          label="Hold Message Until Rewrite"
                          description={
                            proseGuardianHoldForRewrite
                              ? "Show the rewrite working indicator, then reveal the edited message."
                              : "Stream the original message normally, then replace it when the edit is ready."
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
                        <AgentSettingsSegmentedControl
                          value={narrativeDirectorMode}
                          options={[
                            {
                              id: "natural",
                              label: "Natural",
                              description: "Push the existing plot forward.",
                            },
                            {
                              id: "random",
                              label: "Random Event",
                              description: "Add a plausible surprise.",
                            },
                          ]}
                          onChange={(mode) => updateMeta.mutate({ id: chat.id, narrativeDirectorMode: mode })}
                        />
                        {supportsNarrativeDirectorSecretPlot && (
                          <div className="mt-2 space-y-2">
                            <AgentSettingsToggle
                              label="Secret Plot"
                              description="Maintain a hidden long-term arc for this roleplay."
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
                                    Run Interval
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={narrativeDirectorSecretPlotRunInterval}
                                      onChange={(event) =>
                                        updateMeta.mutate({
                                          id: chat.id,
                                          narrativeDirectorSecretPlotRunInterval: normalizePositiveInteger(
                                            event.target.value,
                                            narrativeDirectorSecretPlotRunInterval,
                                            100,
                                          ),
                                        })
                                      }
                                      className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                                    />
                                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                                      assistant messages
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
                          label="Hold Message Until Rewrite"
                          description={
                            proseGuardianHoldForRewrite
                              ? "Show the rewrite working indicator, then reveal the edited message."
                              : "Stream the original message normally, then replace it when the edit is ready."
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
                        onRemove={getRoleplayAgentMenuRemoveHandler("knowledge-router", knowledgeRouterAgentMeta.name)}
                      />
                    )}

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
                              {spriteCharacterIds.length}/3 enabled
                            </span>
                          ) : null
                        }
                      >
                        <SpriteDisplayModeToggle modes={spriteDisplayModes} onToggle={toggleSpriteDisplayMode} />

                        <button
                          type="button"
                          onClick={() => {
                            const nextEnabled = !expressionAvatarsEnabled;
                            if (onSpriteVisualSettingsChange) {
                              onSpriteVisualSettingsChange({ expressionAvatarsEnabled: nextEnabled });
                              return;
                            }
                            updateMeta.mutate({ id: chat.id, expressionAvatarsEnabled: nextEnabled });
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                            expressionAvatarsEnabled
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[0.6875rem] font-medium">Expression Avatars</span>
                            <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                              Replace message avatars with the selected expression sprite.
                            </p>
                          </div>
                          <div
                            className={cn(
                              "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                              expressionAvatarsEnabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                            )}
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                                expressionAvatarsEnabled && "translate-x-3.5",
                              )}
                            />
                          </div>
                        </button>

                        {chatSpriteSubjects.length === 0 ? (
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            Add characters to this chat or choose a persona first to enable sprite selection.
                          </p>
                        ) : chatSpriteSubjectsLoading ? (
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">Loading sprite owners...</p>
                        ) : chatSpriteSubjectsWithSprites.length > 0 ? (
                          <div className="space-y-1.5">
                            {chatSpriteSubjectsWithSprites.map((subject) => {
                              const isPersona = subject.kind === "persona";
                              const name = isPersona ? subject.persona.name : charName(subject.character);
                              const title = isPersona
                                ? subject.persona.comment || "Persona"
                                : charTitle(subject.character);
                              const avatarPath = isPersona ? subject.persona.avatarPath : subject.character.avatarPath;
                              const avatarCrop = isPersona ? null : charAvatarCrop(subject.character);
                              const spriteActive = spriteCharacterIds.includes(subject.id);

                              return (
                                <div
                                  key={`${subject.kind}:${subject.id}`}
                                  className="flex items-center gap-2.5 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]"
                                >
                                  <button
                                    onClick={() => {
                                      onClose();
                                      if (isPersona) {
                                        useUIStore.getState().openPersonaDetail(subject.id);
                                      } else {
                                        useUIStore.getState().openCharacterDetail(subject.id);
                                      }
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                                    title={isPersona ? "Open persona" : "Open character card"}
                                  >
                                    {avatarPath ? (
                                      <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full">
                                        <img
                                          src={avatarPath}
                                          alt={name}
                                          loading="lazy"
                                          className="h-full w-full object-cover"
                                          style={getAvatarCropStyle(avatarCrop)}
                                        />
                                      </span>
                                    ) : (
                                      <div
                                        className={cn(
                                          "flex h-8 w-8 items-center justify-center rounded-full text-[0.625rem] font-bold",
                                          isPersona
                                            ? "mari-avatar-placeholder mari-avatar-placeholder--persona"
                                            : "mari-avatar-placeholder mari-avatar-placeholder--character",
                                        )}
                                      >
                                        {name[0]}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-medium">{name}</span>
                                      {title && (
                                        <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                                          {title}
                                        </span>
                                      )}
                                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                                        {isPersona ? "Persona sprites available" : "Uploaded sprites available"}
                                      </span>
                                    </div>
                                  </button>

                                  <SpriteToggleButton
                                    active={spriteActive}
                                    disabled={!spriteActive && spriteCharacterIds.length >= 3}
                                    onToggle={() => toggleSprite(subject.id)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : chatSpriteChoicesLoading ? (
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            Checking added characters for uploaded sprites...
                          </p>
                        ) : (
                          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                            None of the added characters have uploaded sprites yet. Open a character card to add them
                            first.
                          </p>
                        )}

                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          Only added characters and the active persona with uploaded sprites appear here. You can enable
                          up to 3 at a time.
                        </p>

                        {spriteCharacterIds.length > 0 && (
                          <div className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                            <div className="flex items-center gap-2">
                              <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
                              <span className="flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                                Sprite Layout
                              </span>
                              <button
                                onClick={() => onToggleSpriteArrange?.()}
                                className={cn(
                                  "rounded-md px-2.5 py-1 text-[0.625rem] font-medium transition-colors ring-1 ring-[var(--border)]",
                                  spriteArrangeMode
                                    ? "bg-[var(--primary)] text-white"
                                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                )}
                              >
                                {spriteArrangeMode ? "Done" : "Arrange"}
                              </button>
                              <button
                                onClick={resetSpritePlacements}
                                disabled={!hasCustomSpritePlacements}
                                className={cn(
                                  "rounded-md px-2.5 py-1 text-[0.625rem] font-medium transition-colors ring-1 ring-[var(--border)]",
                                  hasCustomSpritePlacements
                                    ? "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                                    : "cursor-not-allowed opacity-40 text-[var(--muted-foreground)]",
                                )}
                              >
                                Reset
                              </button>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                Default Side
                              </span>
                              <div className="flex rounded-md ring-1 ring-[var(--border)]">
                                <button
                                  onClick={() => setSpriteSide("left")}
                                  className={cn(
                                    "rounded-l-md px-2.5 py-1 text-[0.625rem] font-medium transition-colors",
                                    spritePosition === "left"
                                      ? "bg-[var(--primary)] text-white"
                                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                  )}
                                >
                                  Left
                                </button>
                                <button
                                  onClick={() => setSpriteSide("right")}
                                  className={cn(
                                    "rounded-r-md px-2.5 py-1 text-[0.625rem] font-medium transition-colors",
                                    spritePosition === "right"
                                      ? "bg-[var(--primary)] text-white"
                                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                  )}
                                >
                                  Right
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <SpriteRangeSlider
                                label="Expression Size"
                                value={expressionSpriteScalePercent}
                                min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
                                max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
                                step={5}
                                suffix="%"
                                onChange={setExpressionSpriteScale}
                              />
                              <SpriteRangeSlider
                                label="Full-body Size"
                                value={fullBodySpriteScalePercent}
                                min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
                                max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
                                step={5}
                                suffix="%"
                                onChange={setFullBodySpriteScale}
                              />
                              <SpriteRangeSlider
                                label="Expression Opacity"
                                value={expressionSpriteOpacityPercent}
                                min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
                                max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
                                step={5}
                                suffix="%"
                                onChange={setExpressionSpriteOpacity}
                              />
                              <SpriteRangeSlider
                                label="Full-body Opacity"
                                value={fullBodySpriteOpacityPercent}
                                min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
                                max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
                                step={5}
                                suffix="%"
                                onChange={setFullBodySpriteOpacity}
                              />
                            </div>

                            <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                              Arrange mode lets you drag sprites anywhere in the chat area. Reset clears saved
                              positions. Changing the side flips the current layout.
                            </p>
                          </div>
                        )}
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
                          selectedId={agentPromptTemplateSelections["echo-chamber"] ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
                          onChange={(promptTemplateId) =>
                            updateAgentPromptTemplateSelection("echo-chamber", promptTemplateId)
                          }
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                          <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                            Prompt mode controls the fictional audience style used for live roleplay reactions.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              useUIStore.getState().openAgentDetail("echo-chamber");
                            }}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--background)]/80 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          >
                            <Settings2 size="0.75rem" />
                            <span>Open Setup</span>
                          </button>
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
                          selectedId={agentPromptTemplateSelections["illustrator"] ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
                          onChange={(promptTemplateId) =>
                            updateAgentPromptTemplateSelection("illustrator", promptTemplateId)
                          }
                        />
                        <AgentSettingsToggle
                          label="Attach Card Appearance"
                          description="Append matched character appearance lines to image prompts, using only visible/generated names."
                          enabled={illustratorIncludeCharacterAppearance}
                          onToggle={toggleIllustratorCharacterAppearance}
                        />
                        <AgentSettingsToggle
                          label="Send Avatar References"
                          description="Send matching character and persona avatars or sprites as reference images when the provider supports them."
                          enabled={illustratorUseAvatarReferences}
                          onToggle={toggleIllustratorAvatarReferences}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                          <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                            Prompt mode controls how Illustrator writes image prompts for this chat.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              useUIStore.getState().openAgentDetail("illustrator");
                            }}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--background)]/80 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          >
                            <Settings2 size="0.75rem" />
                            <span>Open Setup</span>
                          </button>
                        </div>
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
                          Active player: {getMusicProviderLabel(musicPlayerSource)}.
                        </p>

                        <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/65 p-1">
                          {(["spotify", "youtube", "custom"] as const).map((provider) => {
                            const active = musicPlayerSource === provider;
                            return (
                              <button
                                key={provider}
                                type="button"
                                onClick={() => void changeMusicDjProvider(provider)}
                                className={cn(
                                  "rounded-lg px-2 py-1.5 text-[0.625rem] font-semibold transition-colors",
                                  active
                                    ? "bg-[var(--primary)]/18 text-[var(--foreground)] shadow-sm"
                                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                                )}
                              >
                                {getMusicProviderLabel(provider)}
                              </button>
                            );
                          })}
                        </div>

                        {musicPlayerSource === "spotify" && (
                          <>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                Spotify source
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
                                  Playlist
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
                                    <option value="">Choose playlist...</option>
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
                                      spotifyPlaylistsQuery.isFetching ? "Loading playlists..." : "Paste playlist ID"
                                    }
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                  />
                                )}
                                {spotifyPlaylistsQuery.isError && (
                                  <span className="text-[0.5625rem] text-amber-400/90">
                                    Connect Spotify in the Music DJ agent to load playlist names.
                                  </span>
                                )}
                              </label>
                            )}

                            {spotifySourceType === "artist" && (
                              <label className="flex flex-col gap-1">
                                <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                  Artist
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
                                  placeholder="HOYO-MiX"
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                />
                              </label>
                            )}
                          </>
                        )}

                        {musicPlayerSource === "custom" && (
                          <label className="flex flex-col gap-1">
                            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                              Custom music folder
                            </span>
                            <input
                              key={`${chat.id}-roleplay-custom-music-${customMusicFolder}`}
                              defaultValue={customMusicFolder}
                              onBlur={(event) => void saveCustomMusicFolder(event.target.value)}
                              placeholder="music"
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                            />
                            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                              Reads local audio from Game Assets, for example <code>music</code> or{" "}
                              <code>music/combat</code>.
                            </span>
                          </label>
                        )}

                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          {musicPlayerSource === "spotify"
                            ? "Roleplay DJ queues several fitting tracks when it changes music."
                            : musicPlayerSource === "youtube"
                              ? "YouTube mode uses the Music DJ agent's YouTube connection and embedded player."
                              : "Custom mode picks from local Game Assets music and plays it in Marinara Engine."}
                        </p>
                      </AgentSettingsCard>
                    )}

                    {renderActiveCustomAgentSettingsCard()}

                    {/* Haptic Feedback — not for game mode */}
                    {metadata.enableAgents && !isGame && hapticActive && (
                      <AgentSettingsCard
                        id={getAgentSettingsMenuId(chat.id, "haptic")}
                        icon={renderRoleplayAgentMenuIcon("haptic")}
                        title={hapticAgentMeta.name}
                        description={hapticAgentMeta.description}
                        order={getRoleplayAgentSettingsOrder("haptic")}
                        onRemove={getRoleplayAgentMenuRemoveHandler("haptic", hapticAgentMeta.name)}
                      >
                        <AgentSettingsToggle
                          label="Haptic Feedback"
                          description={
                            metadata.enableHapticFeedback
                              ? "Touch cues are enabled for this chat."
                              : "Allow this agent to send touch cues during the chat."
                          }
                          enabled={metadata.enableHapticFeedback}
                          onToggle={() =>
                            updateMeta.mutate({ id: chat.id, enableHapticFeedback: !metadata.enableHapticFeedback })
                          }
                        />
                        {metadata.enableHapticFeedback && (
                          <>
                            {chatMode === "roleplay" && (
                              <div className="space-y-2 rounded-lg bg-[var(--background)]/75 p-2.5 ring-1 ring-[var(--border)]">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                                      Touch sensitivity
                                    </span>
                                    <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                                      Roleplay only
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--background)]/35 p-1">
                                    {HAPTIC_SENSITIVITY_OPTIONS.map((option) => (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => updateMeta.mutate({ id: chat.id, hapticSensitivity: option.id })}
                                        className={cn(
                                          "rounded-md px-2 py-1.5 text-[0.625rem] font-semibold transition-colors",
                                          hapticSensitivity === option.id
                                            ? "bg-[var(--accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                                            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                                        )}
                                        title={option.description}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMeta.mutate({
                                      id: chat.id,
                                      hapticIncidentalContact: metadata.hapticIncidentalContact !== true,
                                    })
                                  }
                                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                                  aria-pressed={metadata.hapticIncidentalContact === true}
                                >
                                  <span className="min-w-0">
                                    <span className="block font-medium text-[var(--foreground)]">
                                      Incidental contact
                                    </span>
                                    <span className="block text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
                                      Tiny taps for accidental brushes and bumps.
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                                      metadata.hapticIncidentalContact === true
                                        ? "bg-[var(--primary)]"
                                        : "bg-[var(--muted-foreground)]/50",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                                        metadata.hapticIncidentalContact === true && "translate-x-3.5",
                                      )}
                                    />
                                  </span>
                                </button>
                              </div>
                            )}
                            <HapticConnectionPanel
                              intifaceUrl={
                                typeof metadata.hapticIntifaceUrl === "string" ? metadata.hapticIntifaceUrl : undefined
                              }
                              onIntifaceUrlChange={(hapticIntifaceUrl) =>
                                updateMeta.mutate({ id: chat.id, hapticIntifaceUrl })
                              }
                            />
                          </>
                        )}
                      </AgentSettingsCard>
                    )}
                  </div>
                )}

                {/* Illustrator — game mode only */}
                {isGame && (
                  <AgentSettingsCard
                    icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                    title="Illustrator"
                    description="Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."
                  >
                    <AgentSettingsToggle
                      label="Game Illustrator"
                      description={
                        metadata.enableSpriteGeneration
                          ? "Illustrator is enabled for this game."
                          : "Allow the game to request scene images, portraits, and backgrounds from your image connection."
                      }
                      enabled={!!metadata.enableSpriteGeneration}
                      onToggle={() =>
                        updateMeta.mutate({ id: chat.id, enableSpriteGeneration: !metadata.enableSpriteGeneration })
                      }
                    />
                    {metadata.enableSpriteGeneration && (
                      <div className="space-y-2">
                        <select
                          value={(metadata.gameImageConnectionId as string) ?? ""}
                          onChange={(e) =>
                            updateMeta.mutate({ id: chat.id, gameImageConnectionId: e.target.value || null })
                          }
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                        >
                          <option value="">Select image connection…</option>
                          {(imageConnectionsList ?? []).map((c: { id: string; name: string; model?: string }) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.model ? ` — ${c.model}` : ""}
                            </option>
                          ))}
                        </select>
                        <label className="flex flex-col gap-1">
                          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                            Image style
                          </span>
                          <select
                            value={(metadata.imageStyleProfileId as string) ?? ""}
                            onChange={(e) =>
                              updateMeta.mutate({ id: chat.id, imageStyleProfileId: e.target.value || null })
                            }
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                          >
                            <option value="">Use global or connection default</option>
                            {imageStyleProfiles.profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <AgentSettingsToggle
                          label="Attach Card Appearance"
                          description="Append matched character appearance details to generated scene image prompts."
                          enabled={gameImageIncludeCharacterAppearance}
                          onToggle={() =>
                            updateMeta.mutate({
                              id: chat.id,
                              gameImageIncludeCharacterAppearance: !gameImageIncludeCharacterAppearance,
                            })
                          }
                        />
                        <AgentSettingsToggle
                          label="Send Avatar References"
                          description="Send matching character and persona avatars or sprites as reference images for generated scene illustrations."
                          enabled={gameImageUseAvatarReferences}
                          onToggle={() =>
                            updateMeta.mutate({
                              id: chat.id,
                              gameImageUseAvatarReferences: !gameImageUseAvatarReferences,
                            })
                          }
                        />
                        <label className="flex flex-col gap-1">
                          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                            Scene image instructions
                          </span>
                          <textarea
                            value={gameImagePromptInstructionsDraft}
                            onChange={(e) => setGameImagePromptInstructionsDraft(e.target.value)}
                            onBlur={() => {
                              const stored = (metadata.gameImagePromptInstructions as string) ?? "";
                              if (gameImagePromptInstructionsDraft !== stored) {
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameImagePromptInstructions: gameImagePromptInstructionsDraft.trim() || null,
                                });
                              }
                            }}
                            placeholder="e.g. Dottore's mask completely covers his eyes; never render visible eyes behind it."
                            rows={3}
                            maxLength={1200}
                            className="min-h-[4.75rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/50"
                          />
                        </label>
                      </div>
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
                              return (
                                <div key={agent.id} className="space-y-1.5">
                                  <button
                                    onClick={() => {
                                      const latestActiveAgentIds = readLatestActiveAgentIds();
                                      if (active) {
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
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                                      active
                                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                                    )}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-medium">{agent.name}</span>
                                      {agent.description ? (
                                        <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                          {agent.description}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div
                                      className={cn(
                                        "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                                        active ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                                          active && "translate-x-3.5",
                                        )}
                                      />
                                    </div>
                                  </button>
                                  {active && knowledgeAgentType && (
                                    <KnowledgeAgentSettingsCard
                                      agentType={knowledgeAgentType}
                                      title={agent.name}
                                      description={agent.description}
                                      lorebooks={(lorebooks ?? []) as Lorebook[]}
                                      settings={getKnowledgeAgentSourceSettings(knowledgeAgentType)}
                                      onChange={(patch) =>
                                        updateKnowledgeAgentSourceSettings(knowledgeAgentType, patch)
                                      }
                                    />
                                  )}
                                  {active && agent.id === "illustrator" && (
                                    <AgentSettingsCard
                                      icon={<Paintbrush size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                      title={agent.name}
                                      description={agent.description}
                                    >
                                      <AgentPromptTemplateSelect
                                        options={getPromptOptionsForAgent(agent.id)}
                                        selectedId={
                                          agentPromptTemplateSelections[agent.id] ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID
                                        }
                                        onChange={(promptTemplateId) =>
                                          updateAgentPromptTemplateSelection(agent.id, promptTemplateId)
                                        }
                                      />
                                      <AgentSettingsToggle
                                        label="Attach Card Appearance"
                                        description="Append matched character appearance lines to image prompts, using only visible/generated names."
                                        enabled={illustratorIncludeCharacterAppearance}
                                        onToggle={toggleIllustratorCharacterAppearance}
                                      />
                                      <AgentSettingsToggle
                                        label="Send Avatar References"
                                        description="Send matching character and persona avatars or sprites as reference images when the provider supports them."
                                        enabled={illustratorUseAvatarReferences}
                                        onToggle={toggleIllustratorAvatarReferences}
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
                              ? "bg-amber-400/10 text-amber-400/90 ring-amber-400/30"
                              : "bg-[var(--secondary)]/60 text-[var(--muted-foreground)] ring-[var(--border)]",
                          )}
                          title={`Approximate. Each call also carries chat context (recent messages, characters, persona, lorebook), so real per-turn token use is higher. Smaller models may slow down or fail past ~${AGENT_COST_HIGH_CALLS} calls or ~${AGENT_COST_HIGH_TOKENS.toLocaleString()} instruction tokens.`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {agentLoadCost.cost.level === "high" && (
                              <AlertTriangle size="0.75rem" className="shrink-0" />
                            )}
                            <span className="truncate">
                              ~{agentLoadCost.cost.instructionTokens.toLocaleString()} tokens of agent instructions
                              {" · "}~{agentLoadCost.cost.extraCalls} extra call
                              {agentLoadCost.cost.extraCalls === 1 ? "" : "s"}/turn
                            </span>
                          </span>
                          <span className="shrink-0 cursor-help text-[0.625rem] opacity-70">ⓘ</span>
                        </div>

                        {visibleActiveAgentIds.length === 0 && (
                          <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                            No agents are active for this chat yet. Add one below to let it run here.
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
                          const activeInCat = catAgents.filter((a) => activeAgentIds.includes(a.id));
                          const inactiveInCat = catAgents.filter((a) => !activeAgentIds.includes(a.id));
                          if (catAgents.length === 0) return null;
                          return (
                            <AgentCategorySection
                              key={cat.key}
                              label={cat.label}
                              icon={cat.icon}
                              description={cat.description}
                              count={activeInCat.length}
                            >
                              {/* Active agents in this category */}
                              {activeInCat.length > 0 && (
                                <div className="flex flex-col gap-1 mb-1.5">
                                  {activeInCat.map((agent) => {
                                    const tokenEst = agentLoadCost.tokensByType.get(agent.id);
                                    return (
                                      <div
                                        key={agent.id}
                                        className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                              <span className="block min-w-0 truncate text-xs">{agent.name}</span>
                                              {tokenEst != null ? (
                                                <span
                                                  className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                                                  title={`~${tokenEst.toLocaleString()} tokens of agent instructions (estimated)`}
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
                                              void toggleAgent(agent.id);
                                            }}
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                            title="Remove from chat"
                                          >
                                            <Trash2 size="0.6875rem" />
                                          </button>
                                        </div>
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
                                  All agents in this category are active.
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
            </Section>
          )}

          {isGame && (
            <Section
              style={{ order: CHAT_SETTINGS_ORDER.widgets }}
              label="Widgets"
              icon={<Puzzle size="0.875rem" />}
              count={gameWidgetDrafts.length}
              help="Configure the visible Game Mode HUD widgets the GM can update with widget commands."
            >
              <div className="space-y-3">
                <GameWidgetSetupEditor
                  widgets={gameWidgetDrafts}
                  onChange={(widgets) => setGameWidgetDrafts(normalizeGameHudWidgets(widgets))}
                  disabled={updateGameWidgets.isPending}
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGameWidgetDrafts(gameWidgetSource)}
                    disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveGameWidgets()}
                    disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateGameWidgets.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
                    <span>{updateGameWidgets.isPending ? "Saving..." : "Save Widgets"}</span>
                  </button>
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
              style={{ order: CHAT_SETTINGS_ORDER.memoryRecall }}
              label="Memory Recall"
              icon={<Brain size="0.875rem" />}
              help="When enabled, relevant fragments from this chat are automatically recalled and injected into the prompt as memories. Uses the local embedding model when available, or the configured embedding connection."
            >
              {renderMemoryRecallControls(true)}
            </Section>
          )}

          {/* Automatic Summarization — conversation mode only. Opens a modal to edit per-day and per-week summaries. */}
          {isConversation && (
            <Section
              label="Automatic Summarization"
              icon={<CalendarClock size="0.875rem" />}
              help="To help keep the request context low, the conversation is automatically summarized. Each day is wrapped up into a day summary. Likewise, day summaries are combined into week summaries. Chat messages that have been summarized are not added to context. Only the week summaries, the day summaries of the current week and today's messages are added to the context. This feature currently can't be disabled."
            >
              <div className="space-y-2.5">
                <button
                  onClick={() => setShowSummariesModal(true)}
                  className="flex w-full items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.6875rem] font-medium">Edit Summaries</span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Review and edit what characters remember from this chat.
                    </p>
                  </div>
                  <Pencil size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>

                {/* Day rollover hour */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Day Rollover Hour</span>
                  <select
                    value={(metadata.dayRolloverHour as number | undefined) ?? 4}
                    onChange={(e) => {
                      setRolloverTouchedThisSession(true);
                      updateMeta.mutate({ id: chat.id, dayRolloverHour: Number(e.target.value) });
                    }}
                    className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
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
                    Messages sent before this hour count as part of the previous day. Pick a time you&apos;re never
                    chatting, so a late-night session doesn&apos;t get cut off mid-conversation.
                  </p>
                  {rolloverTouchedThisSession &&
                    (((metadata.daySummaries as Record<string, unknown> | undefined) &&
                      Object.keys(metadata.daySummaries as Record<string, unknown>).length > 0) ||
                      ((metadata.weekSummaries as Record<string, unknown> | undefined) &&
                        Object.keys(metadata.weekSummaries as Record<string, unknown>).length > 0)) && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-400/10 px-2 py-1.5 ring-1 ring-amber-400/20">
                        <AlertTriangle size="0.75rem" className="mt-[0.125rem] shrink-0 text-amber-400/80" />
                        <p className="text-[0.625rem] text-amber-400/80 leading-snug">
                          Existing summaries were built with the previous setting. For today, messages near the rollover
                          hour may be duplicated or missing from the prompt. From tomorrow onward, new day summaries
                          will line up correctly. To adjust an older summary, use{" "}
                          <span className="font-medium">Edit Summaries</span> above.
                        </p>
                      </div>
                    )}
                </div>

                {/* Recent message tail */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Recent Message Tail</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={(metadata.summaryTailMessages as number | undefined) ?? 10}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(50, Math.floor(raw))) : 10;
                      updateMeta.mutate({ id: chat.id, summaryTailMessages: clamped });
                    }}
                    className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                  />
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    How many recent messages to keep word-for-word, even once they&apos;re summarized. Helps characters
                    pick up the actual flow of last night&apos;s conversation instead of just the gist. Set to{" "}
                    <span className="font-medium">0</span> to disable.
                  </p>
                </div>
              </div>
            </Section>
          )}

          <div style={{ order: CHAT_SETTINGS_ORDER.functionCalling }}>
            <FunctionCallingSection
              enableTools={metadata.enableTools as boolean | undefined}
              activeToolIds={activeToolIds}
              pendingToolIds={pendingToolIds}
              availableTools={availableTools}
              showToolPicker={showToolPicker}
              toolSearch={toolSearch}
              onEnableToolsChange={(enableTools) => updateMeta.mutate({ id: chat.id, enableTools })}
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
              style={{ order: CHAT_SETTINGS_ORDER.memoryRecall }}
              label="Memory Recall"
              icon={<Brain size="0.875rem" />}
              help="When enabled, relevant fragments from this chat are automatically recalled and injected into the prompt as memories. Uses the local embedding model when available, or the configured embedding connection."
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
              connections={(connections as Record<string, unknown>[]) ?? []}
              contextMessageLimit={metadata.contextMessageLimit as number | null | undefined}
              excludePastReasoning={metadata.excludePastReasoning as boolean | undefined}
              onChatParametersChange={(chatParameters) => updateMeta.mutate({ id: chat.id, chatParameters })}
              onContextMessageLimitChange={(contextMessageLimit) =>
                updateMeta.mutate({ id: chat.id, contextMessageLimit })
              }
              onExcludePastReasoningChange={(excludePastReasoning) =>
                updateMeta.mutate({ id: chat.id, excludePastReasoning })
              }
            />
          </div>

          {!isConversation && !isGame && (
            <div style={{ order: CHAT_SETTINGS_ORDER.impersonate }}>
              <ImpersonateSection
                presets={(presets ?? []) as Array<{ id: string; name: string }>}
                connections={textConnectionsList}
              />
            </div>
          )}
        </div>
      </div>

      {/* Choice selection modal for preset variables */}
      <ChoiceSelectionModal
        open={!!choiceModalPresetId}
        onClose={() => setChoiceModalPresetId(null)}
        presetId={choiceModalPresetId}
        chatId={chat.id}
        existingChoices={metadata.presetChoices ?? {}}
        chatFloatingPanel
      />

      {/* Automatic summarization editor */}
      <SummariesEditorModal chat={chat} open={showSummariesModal} onClose={() => setShowSummariesModal(false)} />

      {/* Memory recall chunk viewer */}
      <MemoryRecallMemoriesModal
        chatId={chat.id}
        open={showMemoriesModal}
        onClose={() => setShowMemoriesModal(false)}
      />

      <Modal
        open={!!agentAddPreview}
        onClose={() => {
          if (!addingAgentToChat) setAgentAddPreview(null);
        }}
        title={agentAddPreview ? `Add ${agentAddPreview.agent.name}` : "Add Agent"}
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
                      {agentAddPreview.agent.builtIn ? agentAddPreview.agent.category : "custom"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--muted-foreground)]">
                    {agentAddPreview.agent.description || "No description available."}
                  </p>
                </div>
              </div>
            </div>

            {agentAddIsRuntimeDisabled ? (
              <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                This adds its instructions to the next Roleplay prompt. It does not make a separate model call or use an
                agent connection.
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">Agent Budget</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      Context Size
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
                      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      Max Output Tokens
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
                      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">tokens</span>
                    </div>
                  </div>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Context size controls recent chat messages. Max output reserves completion room; lower it on small
                  local contexts if logs show the prompt budget collapsing.
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
                          aria-label="Increase trigger cadence"
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
                          aria-label="Decrease trigger cadence"
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
                onClick={() => setAgentAddPreview(null)}
                disabled={addingAgentToChat}
                className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddAgent}
                disabled={addingAgentToChat}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingAgentToChat ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* First message confirmation dialog */}
      {firstMesConfirm && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 max-md:pt-[env(safe-area-inset-top)]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFirstMesConfirm(null);
          }}
        >
          <div
            className="relative mx-4 flex w-full max-w-sm flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <MessageCircle size="0.875rem" className="text-[var(--muted-foreground)]" />
              <span className="text-sm font-semibold text-[var(--foreground)]">First Message</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-[var(--foreground)]">
                Add <strong>{firstMesConfirm.charName}</strong>'s first message to the chat?
              </p>
              <p className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-[var(--accent)]/50 px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {firstMesConfirm.message.length > 300
                  ? firstMesConfirm.message.slice(0, 300) + "\u2026"
                  : firstMesConfirm.message}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                onClick={() => setFirstMesConfirm(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                Skip
              </button>
              <button
                onClick={handleFirstMesConfirm}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
              >
                Add Message
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

function MemoryRecallMemoriesModal({ chatId, open, onClose }: { chatId: string; open: boolean; onClose: () => void }) {
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
      toast.error("There are no recall memories to export yet.");
      return;
    }

    try {
      await exportMemories.mutateAsync();
      toast.success("Memory Recall exported.");
    } catch (err) {
      toast.error(err instanceof Error ? `Export failed: ${err.message}` : "Export failed.");
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEMORY_RECALL_IMPORT_FILE_BYTES) {
      toast.error(`Memory Recall import files must be ${MAX_MEMORY_RECALL_IMPORT_FILE_LABEL} or smaller.`);
      event.target.value = "";
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isMemoryRecallExportEnvelope(parsed)) {
        toast.error("Choose a Memory Recall export file.");
        return;
      }

      const result = await importMemories.mutateAsync({ envelope: parsed });
      if (result.imported > 0) {
        toast.success(`Imported ${formatMemoryChunkCount(result.imported)}.`);
      } else {
        toast.info("No new recall memories were imported.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  const handleDelete = async (memory: ChatMemoryChunk) => {
    const ok = await showConfirmDialog({
      title: "Forget Memory",
      message: "Remove this recall memory from this chat?",
      confirmLabel: "Forget",
      tone: "destructive",
    });
    if (ok) deleteMemory.mutate(memory.id);
  };

  const handleClear = async () => {
    if (memories.length === 0) return;
    const ok = await showConfirmDialog({
      title: "Clear Memories",
      message: "Remove all recall memories for this chat? This does not delete chat messages.",
      confirmLabel: "Clear",
      tone: "destructive",
    });
    if (ok) clearMemories.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Memories for This Chat" width="max-w-3xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/70 px-3 py-2 ring-1 ring-[var(--border)]">
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{memories.length}</span>{" "}
            {memories.length === 1 ? "memory chunk" : "memory chunks"}
            {memories.length > 0 && (
              <>
                {" "}
                · <span className="tabular-nums">~{totalTokens.toLocaleString()} tokens</span>
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
              title="Export memories"
              aria-label="Export memories"
            >
              <Upload size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
              title="Import memories"
              aria-label="Import memories"
            >
              <Download size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => refreshMemories.mutate()}
              disabled={memoriesQuery.isFetching || refreshMemories.isPending || importMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
              title="Rebuild memories from current chat messages"
            >
              <RefreshCw
                size="0.8125rem"
                className={cn((memoriesQuery.isFetching || refreshMemories.isPending) && "animate-spin")}
              />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={memories.length === 0 || clearMemories.isPending}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title="Clear all memories"
            >
              <Trash2 size="0.8125rem" />
            </button>
          </div>
        </div>

        {memoriesQuery.isLoading && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
            Loading memories...
          </div>
        )}

        {memoriesQuery.error && (
          <div className="rounded-xl bg-[var(--destructive)]/10 px-4 py-3 text-xs text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            Failed to load memories.
          </div>
        )}

        {!memoriesQuery.isLoading && !memoriesQuery.error && memories.length === 0 && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
            No recall memories have been created for this chat yet. Marinara creates them after generation in groups of
            5 messages.
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
                      <span>{memory.messageCount} messages</span>
                      <span>
                        {memory.hasEmbedding
                          ? "Vectorized"
                          : memory.embeddingStatus === "unavailable"
                            ? "Embedding unavailable"
                            : "Waiting for vector"}
                      </span>
                      <span>Created {formatMemoryDate(memory.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(memory)}
                    disabled={deleteMemory.isPending}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
                    title="Forget this memory"
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

// ── Agent category sub-section (collapsible within Agents section) ──
function AgentCategorySection({
  label,
  icon,
  description,
  count,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  description: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[0.6875rem] font-semibold">{label}</span>
          {!open && (
            <p className="text-[0.5625rem] text-[var(--muted-foreground)] leading-tight truncate">{description}</p>
          )}
        </div>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size="0.625rem"
          className={cn("text-[var(--muted-foreground)] transition-transform shrink-0", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-2.5 space-y-1.5">
          <p className="text-[0.5625rem] text-[var(--muted-foreground)] leading-tight">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

function AgentSettingsCard({
  id,
  icon,
  title,
  description,
  badge,
  order,
  onRemove,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
  order?: number;
  onRemove?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      className="scroll-mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-3 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/45"
      style={order == null ? undefined : { order }}
    >
      <div className="flex items-start gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-medium">
            <span className="min-w-0 truncate">{title}</span>
            {badge}
          </div>
          <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">{description}</p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] focus:outline-none focus:ring-1 focus:ring-[var(--destructive)]/45 active:scale-95"
            title={`Remove ${title} from chat`}
            aria-label={`Remove ${title} from chat`}
          >
            <Trash2 size="0.75rem" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function AgentSettingsTextarea({
  label,
  value,
  placeholder,
  rows,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows ?? 3}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="min-h-[3.25rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
      />
    </label>
  );
}

function AgentSettingsToggle({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
        enabled
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-medium">{label}</span>
        <span className="mt-0.5 block text-[0.625rem] text-[var(--muted-foreground)]">{description}</span>
      </span>
      <span
        className={cn(
          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
          enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            enabled && "translate-x-3.5",
          )}
        />
      </span>
    </button>
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
        label="Use chat-active lorebooks"
        description={
          sourceLorebookIds.length > 0
            ? "Fixed source lorebooks are selected below, so they override chat-active lorebooks."
            : "Use the lorebooks currently active for this chat when no fixed source is selected."
        }
        enabled={settings.useChatActiveLorebooks !== false}
        onToggle={() => onChange({ useChatActiveLorebooks: settings.useChatActiveLorebooks === false })}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">Fixed source lorebooks</span>
          {agentType === "knowledge-router" &&
            descriptionCoverage &&
            !routerEntriesLoading &&
            !routerEntriesError &&
            (descriptionCoverage.total === 0 ? (
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">No entries yet</span>
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
                {Math.round(descriptionCoverage.ratio * 100)}% described
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
            No lorebooks available.
          </p>
        )}
        {agentType === "knowledge-router" &&
          (sourceLorebookIds.length > 0 || settings.useChatActiveLorebooks !== false) && (
            <p className="text-[0.625rem] italic text-[var(--muted-foreground)]">
              Entry descriptions help Router choose precisely. Entries without descriptions fall back to short content
              snippets.
            </p>
          )}
      </div>

      {isRetrieval && (
        <div className="space-y-1.5">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">Uploaded files</span>
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
                        {(source.size / 1024).toFixed(1)} KB
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              No uploaded knowledge files yet.
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
                Uploading...
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                Upload file
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
          selected for this chat.
        </p>
      )}
    </AgentSettingsCard>
  );
}

function AgentSettingsSegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "rounded-md px-2.5 py-2 text-left transition-all",
            value === option.id
              ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/35"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
        >
          <span className="block text-[0.6875rem] font-semibold">{option.label}</span>
          {option.description ? <span className="mt-0.5 block text-[0.625rem]">{option.description}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── Sprite display slider ──
function SpriteRangeSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/50 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--foreground)]">{label}</span>
        <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] tabular-nums text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full cursor-pointer accent-[var(--primary)]"
      />
    </label>
  );
}

function SpriteDisplayModeToggle({
  modes,
  onToggle,
}: {
  modes: readonly SpriteDisplayMode[];
  onToggle: (mode: SpriteDisplayMode) => void;
}) {
  const options: Array<{ id: SpriteDisplayMode; label: string }> = [
    { id: "expressions", label: "Expressions" },
    { id: "full-body", label: "Full-body" },
  ];

  return (
    <div className="space-y-1.5 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Sprite Source</span>
        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">choose one or both</span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-md ring-1 ring-[var(--border)]">
        {options.map((option, index) => {
          const active = hasSpriteDisplayMode(modes, option.id);
          const isLastActive = active && modes.length === 1;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              disabled={isLastActive}
              className={cn(
                "min-w-0 px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors",
                index > 0 && "border-l border-[var(--border)]",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                isLastActive && "cursor-not-allowed",
              )}
              title={isLastActive ? "At least one sprite source must stay enabled" : `${option.label} sprites`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sprite toggle button (per character) ──
function SpriteToggleButton({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors ring-1",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30 hover:bg-[var(--primary)]/15"
          : "text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
        disabled && "opacity-30 cursor-not-allowed",
      )}
      title={active ? "Disable sprite" : disabled ? "Max 3 sprites" : "Enable sprite"}
    >
      <Image size="0.6875rem" />
      <span>{active ? "Enabled" : "Enable"}</span>
    </button>
  );
}

// ── Schedule Editor ──

const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const STATUS_OPTIONS = ["online", "idle", "dnd", "offline"] as const;
const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

interface ScheduleBlock {
  time: string;
  activity: string;
  status: "online" | "idle" | "dnd" | "offline";
}

function SelfiePromptControls({
  promptTemplate,
  positivePrompt,
  legacyTags,
  negativePrompt,
  onCommitPromptTemplate,
  onCommitPositivePrompt,
  onCommitNegativePrompt,
}: {
  promptTemplate: string | null | undefined;
  positivePrompt: string | undefined;
  legacyTags: string[];
  negativePrompt: string;
  onCommitPromptTemplate: (value: string | null) => void;
  onCommitPositivePrompt: (value: string) => void;
  onCommitNegativePrompt: (value: string) => void;
}) {
  const legacyTagText = legacyTags.join(", ");
  const displayPositivePrompt = positivePrompt ?? legacyTagText;
  const displayPromptTemplate = promptTemplate ?? "";
  const [promptDraft, setPromptDraft] = useState(displayPromptTemplate);
  const [positiveDraft, setPositiveDraft] = useState(displayPositivePrompt);
  const [negativeDraft, setNegativeDraft] = useState(negativePrompt);

  useEffect(() => {
    setPromptDraft(displayPromptTemplate);
  }, [displayPromptTemplate]);

  useEffect(() => {
    setPositiveDraft(displayPositivePrompt);
  }, [displayPositivePrompt]);

  useEffect(() => {
    setNegativeDraft(negativePrompt);
  }, [negativePrompt]);

  const commitPromptTemplate = useCallback(() => {
    const nextValue = promptDraft.trim().length > 0 ? promptDraft : null;
    if ((nextValue ?? "") !== displayPromptTemplate) onCommitPromptTemplate(nextValue);
  }, [displayPromptTemplate, onCommitPromptTemplate, promptDraft]);

  const commitPositivePrompt = useCallback(() => {
    if (positiveDraft !== displayPositivePrompt) onCommitPositivePrompt(positiveDraft);
  }, [displayPositivePrompt, onCommitPositivePrompt, positiveDraft]);

  const commitNegativePrompt = useCallback(() => {
    if (negativeDraft !== negativePrompt) onCommitNegativePrompt(negativeDraft);
  }, [negativeDraft, negativePrompt, onCommitNegativePrompt]);

  return (
    <div className="mt-2 space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Selfie prompt</span>
        <textarea
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          onBlur={commitPromptTemplate}
          placeholder={`You are an image prompt generator. Create a concise selfie prompt for ${"${charName}"} using this appearance: ${"${appearance}"}.\nOutput ONLY the prompt text, nothing else.`}
          className="min-h-[7rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Positive tags</span>
        <textarea
          value={positiveDraft}
          onChange={(e) => setPositiveDraft(e.target.value)}
          onBlur={commitPositivePrompt}
          placeholder="masterpiece, best quality, detailed eyes"
          className="min-h-[4rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Negative prompt</span>
        <textarea
          value={negativeDraft}
          onChange={(e) => setNegativeDraft(e.target.value)}
          onBlur={commitNegativePrompt}
          placeholder="lowres, bad anatomy, extra fingers"
          className="min-h-[4rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
        />
      </label>
      <p className="text-[0.55rem] text-[var(--muted-foreground)]">
        Saved for this chat. Leave the selfie prompt blank to use the default prompt. The template can use{" "}
        {"${charName}"} and {"${appearance}"}. Positive tags are appended to the generated selfie prompt; negative tags
        are sent directly to the image generator.
      </p>
    </div>
  );
}
function ScheduleEditor({
  characterSchedules,
  chatCharIds,
  charNameMap,
  onSave,
}: {
  characterSchedules: Record<
    string,
    {
      weekStart: string;
      days: Record<string, ScheduleBlock[]>;
      inactivityThresholdMinutes: number;
      idleResponseDelayMinutes?: number;
      dndResponseDelayMinutes?: number;
      talkativeness: number;
    }
  >;
  chatCharIds: string[];
  charNameMap: Map<string, string>;
  onSave: (updated: typeof characterSchedules) => void;
}) {
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    days: Record<string, ScheduleBlock[]>;
    inactivityThresholdMinutes: string;
    idleResponseDelayMinutes: string;
    dndResponseDelayMinutes: string;
  } | null>(null);

  const parseRequiredMinutes = (value: string, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };

  const parseOptionalMinutes = (value: string, min: number, max: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(min, Math.min(max, parsed));
  };

  // When a character is expanded, load their schedule into a draft for editing
  const handleExpandChar = (charId: string) => {
    if (expandedCharId === charId) {
      setExpandedCharId(null);
      setExpandedDay(null);
      setEditDraft(null);
      return;
    }
    const schedule = characterSchedules[charId];
    if (schedule) {
      setEditDraft({
        days: JSON.parse(JSON.stringify(schedule.days)),
        inactivityThresholdMinutes: String(schedule.inactivityThresholdMinutes),
        idleResponseDelayMinutes:
          typeof schedule.idleResponseDelayMinutes === "number" ? String(schedule.idleResponseDelayMinutes) : "",
        dndResponseDelayMinutes:
          typeof schedule.dndResponseDelayMinutes === "number" ? String(schedule.dndResponseDelayMinutes) : "",
      });
    }
    setExpandedCharId(charId);
    setExpandedDay(null);
  };

  const handleSave = () => {
    if (!expandedCharId || !editDraft) return;
    const updated = { ...characterSchedules };
    const existingSchedule = updated[expandedCharId]!;
    const nextSchedule = {
      ...existingSchedule,
      days: editDraft.days,
      inactivityThresholdMinutes: parseRequiredMinutes(
        editDraft.inactivityThresholdMinutes,
        existingSchedule.inactivityThresholdMinutes,
        15,
        360,
      ),
    };
    const idleDelay = parseOptionalMinutes(editDraft.idleResponseDelayMinutes, 0, 120);
    const dndDelay = parseOptionalMinutes(editDraft.dndResponseDelayMinutes, 0, 120);
    if (idleDelay === undefined) {
      delete nextSchedule.idleResponseDelayMinutes;
    } else {
      nextSchedule.idleResponseDelayMinutes = idleDelay;
    }
    if (dndDelay === undefined) {
      delete nextSchedule.dndResponseDelayMinutes;
    } else {
      nextSchedule.dndResponseDelayMinutes = dndDelay;
    }
    updated[expandedCharId] = nextSchedule;
    onSave(updated);
    setExpandedCharId(null);
    setEditDraft(null);
  };

  const updateBlock = (day: string, idx: number, field: keyof ScheduleBlock, value: string) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft, days: { ...editDraft.days } };
    const dayBlocks = [...(newDraft.days[day] ?? [])];
    dayBlocks[idx] = { ...dayBlocks[idx]!, [field]: value };
    newDraft.days[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const updateDraftSetting = (
    field: "inactivityThresholdMinutes" | "idleResponseDelayMinutes" | "dndResponseDelayMinutes",
    value: string,
  ) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [field]: value });
  };

  const addBlock = (day: string) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft, days: { ...editDraft.days } };
    const dayBlocks = [...(newDraft.days[day] ?? [])];
    dayBlocks.push({ time: "12:00-13:00", activity: "Free time", status: "online" });
    newDraft.days[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const removeBlock = (day: string, idx: number) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft, days: { ...editDraft.days } };
    const dayBlocks = [...(newDraft.days[day] ?? [])];
    dayBlocks.splice(idx, 1);
    newDraft.days[day] = dayBlocks;
    setEditDraft(newDraft);
  };

  const charsWithSchedules = chatCharIds.filter((cid) => characterSchedules[cid]);
  if (charsWithSchedules.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Edit Schedules</span>
      {charsWithSchedules.map((charId) => {
        const name = charNameMap.get(charId) ?? "Unknown";
        const isExpanded = expandedCharId === charId;
        const schedule = characterSchedules[charId]!;

        return (
          <div key={charId} className="rounded-lg bg-[var(--secondary)] overflow-hidden">
            {/* Character header */}
            <button
              onClick={() => handleExpandChar(charId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
            >
              <ChevronRight
                size="0.6875rem"
                className={cn("text-[var(--muted-foreground)] transition-transform", isExpanded && "rotate-90")}
              />
              <span className="flex-1 text-[0.6875rem] font-medium">{name}</span>
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {Object.keys(schedule.days).length} days
              </span>
            </button>

            {/* Expanded schedule editor */}
            {isExpanded && editDraft && (
              <div className="border-t border-[var(--border)] px-3 py-2 space-y-1.5">
                <div className="rounded-md bg-[var(--background)] p-2 space-y-1.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        Inactivity
                      </span>
                      <input
                        type="number"
                        min={15}
                        max={360}
                        step={5}
                        value={editDraft.inactivityThresholdMinutes}
                        onChange={(e) => updateDraftSetting("inactivityThresholdMinutes", e.target.value)}
                        className="w-full rounded bg-[var(--secondary)] px-1.5 py-1 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                        placeholder="120"
                      />
                      <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                        Minutes before they follow up.
                      </span>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        Idle Delay
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={0.5}
                        value={editDraft.idleResponseDelayMinutes}
                        onChange={(e) => updateDraftSetting("idleResponseDelayMinutes", e.target.value)}
                        className="w-full rounded bg-[var(--secondary)] px-1.5 py-1 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                        placeholder="Default"
                      />
                      <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                        Blank keeps the built-in 1-3 minute range.
                      </span>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        DND Delay
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={0.5}
                        value={editDraft.dndResponseDelayMinutes}
                        onChange={(e) => updateDraftSetting("dndResponseDelayMinutes", e.target.value)}
                        className="w-full rounded bg-[var(--secondary)] px-1.5 py-1 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                        placeholder="Default"
                      />
                      <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                        Blank keeps the built-in 2-5 minute range.
                      </span>
                    </label>
                  </div>
                </div>
                {SCHEDULE_DAYS.map((day) => {
                  const blocks = editDraft.days[day] ?? [];
                  const isDayExpanded = expandedDay === day;

                  return (
                    <div key={day}>
                      <button
                        onClick={() => setExpandedDay(isDayExpanded ? null : day)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-[var(--accent)]/40"
                      >
                        <ChevronRight
                          size="0.5625rem"
                          className={cn(
                            "text-[var(--muted-foreground)] transition-transform",
                            isDayExpanded && "rotate-90",
                          )}
                        />
                        <span className="flex-1 text-[0.625rem] font-medium">{day}</span>
                        <span className="flex gap-0.5">
                          {blocks.slice(0, 8).map((b, i) => (
                            <span
                              key={i}
                              className={cn("inline-block h-1.5 w-1.5 rounded-full", STATUS_COLORS[b.status])}
                              title={`${b.time} — ${b.activity}`}
                            />
                          ))}
                          {blocks.length > 8 && (
                            <span className="text-[0.5rem] text-[var(--muted-foreground)]">+{blocks.length - 8}</span>
                          )}
                        </span>
                        <span className="text-[0.5rem] text-[var(--muted-foreground)]">{blocks.length}</span>
                      </button>

                      {isDayExpanded && (
                        <div className="ml-4 mt-1 space-y-1.5">
                          {blocks.map((block, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 rounded-md bg-[var(--background)] p-1.5">
                              {/* Status dot */}
                              <span
                                className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_COLORS[block.status])}
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                {/* Time */}
                                <input
                                  value={block.time}
                                  onChange={(e) => updateBlock(day, idx, "time", e.target.value)}
                                  className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] font-mono outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                                  placeholder="06:00-08:00"
                                />
                                {/* Activity */}
                                <input
                                  value={block.activity}
                                  onChange={(e) => updateBlock(day, idx, "activity", e.target.value)}
                                  className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                                  placeholder="Activity description"
                                />
                                {/* Status selector */}
                                <div className="flex gap-1">
                                  {STATUS_OPTIONS.map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => updateBlock(day, idx, "status", s)}
                                      className={cn(
                                        "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors",
                                        block.status === s
                                          ? "bg-[var(--primary)] text-white"
                                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                      )}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Delete block */}
                              <button
                                onClick={() => removeBlock(day, idx)}
                                className="mt-1 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                              >
                                <Trash2 size="0.625rem" />
                              </button>
                            </div>
                          ))}
                          {/* Add block */}
                          <button
                            onClick={() => addBlock(day)}
                            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-[0.5625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/40 hover:text-[var(--foreground)]"
                          >
                            <Plus size="0.5625rem" />
                            Add time block
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Save / Cancel */}
                <div className="flex justify-end gap-2 pt-1.5 border-t border-[var(--border)]">
                  <button
                    onClick={() => {
                      setExpandedCharId(null);
                      setEditDraft(null);
                    }}
                    className="rounded-md px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-white transition-colors hover:bg-[var(--primary)]/80"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Haptic Connection Panel ──
function HapticConnectionPanel({
  intifaceUrl: savedIntifaceUrl,
  onIntifaceUrlChange,
}: {
  intifaceUrl?: string;
  onIntifaceUrlChange: (value: string | null) => void;
}) {
  const { data: status, isLoading } = useHapticStatus();
  const connect = useHapticConnect();
  const disconnect = useHapticDisconnect();
  const startScan = useHapticStartScan();
  const [intifaceUrl, setIntifaceUrl] = useState(
    () => savedIntifaceUrl ?? localStorage.getItem(HAPTIC_INTIFACE_URL_STORAGE_KEY) ?? "",
  );
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  useEffect(() => {
    setIntifaceUrl(savedIntifaceUrl ?? localStorage.getItem(HAPTIC_INTIFACE_URL_STORAGE_KEY) ?? "");
  }, [savedIntifaceUrl]);

  const saveIntifaceUrl = useCallback(() => {
    const trimmed = intifaceUrl.trim();
    if (trimmed) {
      localStorage.setItem(HAPTIC_INTIFACE_URL_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(HAPTIC_INTIFACE_URL_STORAGE_KEY);
    }
    if ((savedIntifaceUrl ?? "") !== trimmed) {
      onIntifaceUrlChange(trimmed || null);
    }
    return trimmed;
  }, [intifaceUrl, onIntifaceUrlChange, savedIntifaceUrl]);

  // Auto-connect on mount if not connected
  useEffect(() => {
    if (autoConnectAttempted || isLoading || !status || status.connected || connect.isPending) return;
    setAutoConnectAttempted(true);
    const trimmed = saveIntifaceUrl();
    connect.mutate(trimmed || undefined);
  }, [autoConnectAttempted, connect, isLoading, saveIntifaceUrl, status]);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
        Checking Intiface Central...
      </div>
    );
  }

  const connected = status?.connected ?? false;
  const devices = status?.devices ?? [];
  const scanning = status?.scanning ?? false;
  const defaultServerUrl = status?.defaultServerUrl ?? "ws://127.0.0.1:12345";
  const activeServerUrl = status?.serverUrl ?? defaultServerUrl;

  return (
    <div className="space-y-1.5 px-1">
      <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Intiface URL</span>
        <input
          value={intifaceUrl}
          onChange={(event) => setIntifaceUrl(event.target.value)}
          onBlur={saveIntifaceUrl}
          placeholder={defaultServerUrl}
          className="rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/55 focus:ring-[var(--primary)]/60"
        />
        <span className="text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
          Blank uses the server default. Docker or remote browser setups usually need ws://CLIENT_IP:12345.
        </span>
      </label>

      {/* Connection status */}
      <div className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-green-400" : "bg-red-400")} />
          <span className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]">
            {connect.isPending
              ? `Connecting to ${intifaceUrl.trim() || defaultServerUrl}...`
              : connected
                ? `Connected: ${activeServerUrl}`
                : "Not connected"}
          </span>
        </div>
        <button
          onClick={() => {
            if (connected) {
              disconnect.mutate();
            } else {
              connect.mutate(saveIntifaceUrl() || undefined);
            }
          }}
          disabled={connect.isPending || disconnect.isPending}
          className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {/* Error message */}
      {connect.isError && !connected && (
        <p className="text-[0.625rem] text-red-400 px-1">
          Could not connect — make sure{" "}
          <a href="https://intiface.com/central/" target="_blank" rel="noopener noreferrer" className="underline">
            Intiface Central
          </a>{" "}
          is running and the server is started.
        </p>
      )}

      {/* Devices */}
      {connected && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {devices.length === 0 ? "No devices found" : `${devices.length} device${devices.length !== 1 ? "s" : ""}`}
            </span>
            <button
              onClick={() => startScan.mutate()}
              disabled={scanning || startScan.isPending}
              className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {scanning ? "Scanning..." : "Scan for devices"}
            </button>
          </div>
          {devices.map((d) => (
            <div key={d.index} className="flex items-center gap-1.5 rounded-md bg-[var(--accent)]/50 px-2.5 py-1.5">
              <Vibrate size="0.625rem" className="text-[var(--primary)]" />
              <span className="text-[0.625rem] font-medium">{d.name}</span>
              <span className="text-[0.5rem] text-[var(--muted-foreground)]">{d.capabilities.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPromptTemplateSelect({
  options,
  selectedId,
  onChange,
}: {
  options: AgentPromptTemplateOption[];
  selectedId: string;
  onChange: (promptTemplateId: string) => void;
}) {
  if (options.length <= 1) return null;
  const activeOption = options.find((option) => option.id === selectedId) ?? options[0];

  return (
    <div className="mt-2 rounded-lg bg-[var(--background)]/25 px-2 py-2 ring-1 ring-[var(--border)]/70">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.5625rem] font-semibold uppercase text-[var(--muted-foreground)]">Prompt</span>
        <select
          value={activeOption?.id ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {activeOption?.description ? (
        <p className="mt-1.5 text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
          {activeOption.description}
        </p>
      ) : null}
    </div>
  );
}

function ConversationNotesSection({ chatId }: { chatId: string }) {
  const notesQuery = useChatNotes(chatId);
  const deleteNote = useDeleteChatNote(chatId);
  const clearNotes = useClearChatNotes(chatId);
  const notes = useMemo<ConversationNote[]>(() => notesQuery.data ?? [], [notesQuery.data]);
  const totalChars = useMemo(() => notes.reduce((acc, n) => acc + n.content.length, 0), [notes]);

  const handleDelete = async (note: ConversationNote) => {
    const ok = await showConfirmDialog({
      title: "Delete Note",
      message: "Remove this note from the connected roleplay's prompt?",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (ok) deleteNote.mutate(note.id);
  };

  const handleClear = async () => {
    if (notes.length === 0) return;
    const ok = await showConfirmDialog({
      title: "Clear All Notes",
      message: "Remove every durable note from this roleplay? This cannot be undone.",
      confirmLabel: "Clear all",
      tone: "destructive",
    });
    if (ok) clearNotes.mutate();
  };

  return (
    <Section
      label="Conversation Notes"
      icon={<StickyNote size="0.875rem" />}
      count={notes.length}
      help="Durable notes the connected conversation's character has saved using <note>. They persist in this roleplay's prompt every turn until cleared."
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
          <span>
            {notesQuery.isLoading
              ? "Loading…"
              : notesQuery.error
                ? "Failed to load."
                : notes.length === 0
                  ? "No notes saved yet."
                  : `${notes.length} ${notes.length === 1 ? "note" : "notes"} · ${totalChars.toLocaleString()} chars`}
          </span>
          {notes.length > 0 && !notesQuery.isLoading && !notesQuery.error && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearNotes.isPending}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title="Clear all notes"
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
        </div>

        {notesQuery.isLoading ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-center text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            Loading notes…
          </p>
        ) : notesQuery.error ? (
          <p className="rounded-lg bg-[var(--destructive)]/10 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            Failed to load notes.
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            Characters in the connected conversation can save things they want this roleplay to durably remember by
            wrapping text in <code className="rounded bg-[var(--accent)]/60 px-1">{"<note>...</note>"}</code>. Saved
            notes will appear here.
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
                  title="Delete this note"
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
