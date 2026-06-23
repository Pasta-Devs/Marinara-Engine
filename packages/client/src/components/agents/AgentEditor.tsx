// ──────────────────────────────────────────────
// Full-Page Agent Editor
// Click an agent → opens this editor
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  agentKeys,
  useAgentConfigs,
  useUpdateAgent,
  useCreateAgent,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import { useConnections } from "../../hooks/use-connections";
import {
  isCustomToolSelectable,
  useCustomToolCapabilities,
  useCustomTools,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import {
  Activity,
  ArrowLeft,
  Save,
  Sparkles,
  Check,
  AlertCircle,
  X,
  Zap,
  Link2,
  FileText,
  RotateCcw,
  Clock,
  Info,
  Wrench,
  Trash2,
  Plus,
  Layers,
  Music,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  FolderOpen,
  Upload,
  Loader2,
  ImageIcon,
  Shield,
  ShieldCheck,
  Shuffle,
} from "lucide-react";
import { useDeleteAgent } from "../../hooks/use-agents";
import { useLorebooks, useEntriesAcrossLorebooks } from "../../hooks/use-lorebooks";
import {
  useKnowledgeSources,
  useUploadKnowledgeSource,
  useDeleteKnowledgeSource,
} from "../../hooks/use-knowledge-sources";
import { cn } from "../../lib/utils";
import { MacroTextarea } from "../ui/MacroTextarea";
import {
  getAgentRunIntervalMeta,
  getCadenceInputValue,
  parseOptionalCadenceInputValue,
  stepCadenceValue,
} from "../../lib/agent-cadence";
import { HelpTooltip } from "../ui/HelpTooltip";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  BUILT_IN_AGENTS,
  BUILT_IN_TOOLS,
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_AUTHOR,
  CUSTOM_AGENT_CAPABILITY_IDS,
  DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  LOCAL_SIDECAR_CONNECTION_ID,
  MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  MIN_AGENT_MAX_TOKENS,
  getDefaultBuiltInAgentSettings,
  getDefaultAgentPrompt,
  isAgentConfigDeleted,
  mergeBuiltInAgentSettings,
  normalizeAgentPhaseForType,
  normalizeCustomAgentCapabilities,
  normalizeAgentPromptTemplateOptions,
  parseAgentSettingsRecord,
  type AgentPhase,
  type AgentPromptTemplateOption,
  type AgentResultType,
  type CustomAgentCapability,
  type CustomAgentCapabilityMap,
  type ToolDefinition,
} from "@marinara-engine/shared";
import {
  createAgentFolderPackageFilename,
  createAgentFolderPackageFiles,
  sanitizeAgentSettingsForTransfer,
} from "../../lib/agent-transfer";
import { serializeCustomToolForTransfer } from "../../lib/custom-tool-transfer";
import { downloadZipFile } from "../../lib/download-zip";

function parseActivationKeywordsText(value: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const line of value.split(/\r?\n|,/)) {
    const keyword = line.trim();
    if (!keyword) continue;
    const dedupeKey = keyword.toLocaleLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    keywords.push(keyword);
  }
  return keywords;
}

function createCustomAgentType(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "agent";
  const suffix =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom-${slug}-${suffix}`;
}

const LOREBOOK_WRITE_TOOL_NAME = "save_lorebook_entry";
const MESSAGE_EDIT_TOOL_NAME = "edit_chat_message";
const DEFAULT_PROSE_GUARDIAN_BANNED_WORDS = "ozone";
type MusicProvider = "spotify" | "youtube" | "custom";
type CustomMusicSource = "game-assets" | "folder";
const DEFAULT_PROSE_GUARDIAN_AVOID =
  "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";

function normalizeCustomMusicFolderInput(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/g, "");
  if (!normalized || normalized.includes("..")) return "music";
  return normalized.startsWith("music") ? normalized : `music/${normalized}`;
}

function normalizeMusicProvider(settings: Record<string, unknown>): MusicProvider {
  if (settings.musicProvider === "custom" || settings.musicPlayerSource === "custom") return "custom";
  if (settings.musicProvider === "youtube" || settings.musicPlayerSource === "youtube") return "youtube";
  return "spotify";
}

function normalizeCustomMusicSource(settings: Record<string, unknown>): CustomMusicSource {
  return settings.customMusicSource === "folder" || settings.localMusicSource === "folder" ? "folder" : "game-assets";
}

function normalizeExternalMusicFolderInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Mirrors the server's buildSpotifyRedirectUri rule: Spotify only accepts
// https:// or http://127.0.0.1, so fall back to loopback whenever the page
// is served over plain HTTP from a non-loopback host.
function getDisplayedSpotifyRedirectUri(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:7860/api/spotify/callback";
  const { protocol, hostname, origin, port } = window.location;
  const isLoopback = hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  if (protocol === "https:" || isLoopback) return `${origin}/api/spotify/callback`;
  return `http://127.0.0.1:${port || "7860"}/api/spotify/callback`;
}

// ═══════════════════════════════════════════════
//  Phase metadata
// ═══════════════════════════════════════════════
const PHASE_META: Record<AgentPhase, { label: string; color: string; icon: typeof Zap; description: string }> = {
  pre_generation: {
    label: "Pre-Generation",
    color: "text-amber-400",
    icon: Zap,
    description: "Runs before the main AI response. Can inject context or modify the prompt.",
  },
  parallel: {
    label: "Parallel",
    color: "text-sky-400",
    icon: Activity,
    description: "Runs alongside or after the main generation. Independent processing.",
  },
  post_processing: {
    label: "Post-Processing",
    color: "text-emerald-400",
    icon: Clock,
    description: "Runs after the main AI response. Can analyze and extract data from it.",
  },
};

type NarrativeDirectorMode = "natural" | "random";

function normalizeNarrativeDirectorMode(value: unknown): NarrativeDirectorMode {
  return value === "random" ? "random" : "natural";
}

function normalizeAgentMaxTokensInput(value: string): number | "" {
  if (value === "") return "";
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return "";
  return Math.max(1, parsed);
}

function clampAgentMaxTokens(value: number): number {
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(value));
}

type CustomAgentResultType = Extract<
  AgentResultType,
  | "context_injection"
  | "text_rewrite"
  | "lorebook_update"
  | "character_tracker_update"
  | "persona_stats_update"
  | "custom_tracker_update"
  | "game_state_update"
  | "image_prompt"
  | "prompt_patch"
  | "frontend_theme_update"
>;

const CUSTOM_AGENT_CAPABILITY_META: Array<{
  id: CustomAgentCapability;
  label: string;
  description: string;
}> = [
  {
    id: "create_lorebooks",
    label: "Create lorebooks",
    description: "Allow this agent to create a new agent-made lorebook when its lore output has no target.",
  },
  {
    id: "edit_lorebooks",
    label: "Edit lorebooks",
    description: "Allow lorebook entry writes or lorebook update results for selected lorebooks.",
  },
  {
    id: "edit_messages",
    label: "Edit messages",
    description: "Allow Text Rewrite output to replace generated message content.",
  },
  {
    id: "edit_trackers",
    label: "Edit trackers",
    description: "Allow tracker result types to update game, character, persona, or custom tracker state.",
  },
  {
    id: "change_frontend_styling",
    label: "Frontend styling",
    description: "Allow temporary CSS effects from this agent during generation.",
  },
  {
    id: "trigger_image_generation",
    label: "Image generation",
    description: "Allow image prompt output to trigger the configured image generator.",
  },
  {
    id: "access_vectors",
    label: "Vectors/embeddings",
    description: "Mark this agent as allowed to use configured vector or embedding context.",
  },
  {
    id: "edit_main_prompt",
    label: "Main prompt edits",
    description: "Allow prompt patch output to edit the prompt sent to the main generation model.",
  },
];

const CUSTOM_AGENT_RESULT_TYPE_OPTIONS: Array<{
  id: CustomAgentResultType;
  label: string;
  description: string;
  requiredCapability?: CustomAgentCapability;
  requiredAnyCapability?: CustomAgentCapability[];
}> = [
  {
    id: "context_injection",
    label: "Context Injection",
    description: "Adds text context before generation, or records informational text after generation.",
  },
  {
    id: "text_rewrite",
    label: "Text Rewrite",
    description: 'Runs after the reply and expects JSON with "editedText" plus "changes" to replace the message.',
    requiredCapability: "edit_messages",
  },
  {
    id: "lorebook_update",
    label: "Lorebook Update",
    description: 'Expects JSON with an "updates" array to create or update lorebook entries.',
    requiredCapability: "edit_lorebooks",
  },
  {
    id: "character_tracker_update",
    label: "Character Tracker",
    description: 'Expects JSON with "presentCharacters" to update the character tracker.',
    requiredCapability: "edit_trackers",
  },
  {
    id: "persona_stats_update",
    label: "Persona Stats",
    description: 'Expects JSON with "stats", "status", and "inventory" for persona tracker state.',
    requiredCapability: "edit_trackers",
  },
  {
    id: "custom_tracker_update",
    label: "Custom Tracker",
    description: 'Expects JSON with "fields" to replace custom tracker fields.',
    requiredCapability: "edit_trackers",
  },
  {
    id: "game_state_update",
    label: "Game State",
    description: "Expects structured game-state JSON for world-state style tracker updates.",
    requiredCapability: "edit_trackers",
  },
  {
    id: "image_prompt",
    label: "Image Prompt",
    description: 'Expects JSON with "shouldGenerate", "prompt", optional style, and characters.',
    requiredCapability: "trigger_image_generation",
  },
  {
    id: "prompt_patch",
    label: "Prompt Patch",
    description: 'Expects JSON with "operations" to append, prepend, or replace prompt sections.',
    requiredCapability: "edit_main_prompt",
  },
  {
    id: "frontend_theme_update",
    label: "Frontend Style",
    description: 'Expects JSON with "css" for a temporary frontend styling effect.',
    requiredCapability: "change_frontend_styling",
  },
];

function normalizeCustomResultType(value: unknown): CustomAgentResultType {
  return CUSTOM_AGENT_RESULT_TYPE_OPTIONS.some((option) => option.id === value)
    ? (value as CustomAgentResultType)
    : "context_injection";
}

function customCapabilityMapFromLocal(capabilities: CustomAgentCapabilityMap): CustomAgentCapabilityMap {
  const enabled: CustomAgentCapabilityMap = {};
  for (const capability of CUSTOM_AGENT_CAPABILITY_IDS) {
    if (capabilities[capability] === true) enabled[capability] = true;
  }
  return enabled;
}

function resultTypeAllowedByCapabilities(
  resultType: CustomAgentResultType,
  capabilities: CustomAgentCapabilityMap,
): boolean {
  const option = CUSTOM_AGENT_RESULT_TYPE_OPTIONS.find((entry) => entry.id === resultType);
  if (!option) return false;
  if (option.requiredCapability) return capabilities[option.requiredCapability] === true;
  if (option.requiredAnyCapability) return option.requiredAnyCapability.some((capability) => capabilities[capability]);
  return true;
}

function createPromptOptionId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/(^-|-$)/g, "") || "prompt";
  let candidate = base;
  let attempt = 2;
  while (existingIds.has(candidate) || candidate === "default") {
    candidate = `${base}-${attempt}`;
    attempt++;
  }
  return candidate;
}

function createBlankPromptOption(existingOptions: AgentPromptTemplateOption[]): AgentPromptTemplateOption {
  const existingIds = new Set(existingOptions.map((option) => option.id));
  const name = `Prompt ${existingOptions.length + 1}`;
  return {
    id: createPromptOptionId(name, existingIds),
    name,
    promptTemplate: "",
  };
}

function normalizeAuthor(value: unknown, fallback: string): string {
  const author = typeof value === "string" ? value.trim() : "";
  return author || fallback;
}

function normalizeOptionalNumber(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(numeric)));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function getReferencedCustomTools(toolNames: string[], customTools: CustomToolRow[]) {
  if (toolNames.length === 0 || customTools.length === 0) return [];
  const referenced = new Set(toolNames);
  return customTools.filter((tool) => referenced.has(tool.name));
}

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════
export function AgentEditor() {
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const closeAgentDetail = useUIStore((s) => s.closeAgentDetail);

  const { data: agentConfigs } = useAgentConfigs();
  const { data: connections } = useConnections();
  const { data: customToolsRaw } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const updateAgent = useUpdateAgent();
  const createAgent = useCreateAgent();
  const qc = useQueryClient();
  const deleteAgent = useDeleteAgent();
  const connectionIndexRef = useRef<{
    loaded: boolean;
    llmIds: Set<string>;
    imageIds: Set<string>;
  }>({ loaded: false, llmIds: new Set(), imageIds: new Set() });

  useEffect(() => {
    const rows =
      (connections as
        | Array<{
            id: string;
            provider: string;
          }>
        | undefined) ?? [];
    connectionIndexRef.current = {
      loaded: Array.isArray(connections),
      llmIds: new Set(
        rows.filter((connection) => connection.provider !== "image_generation").map((connection) => connection.id),
      ),
      imageIds: new Set(
        rows.filter((connection) => connection.provider === "image_generation").map((connection) => connection.id),
      ),
    };
  }, [connections]);

  const normalizeTextConnectionOverride = useCallback((connectionId: unknown): string => {
    if (typeof connectionId !== "string" || !connectionId.trim()) return "";
    if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
      return import.meta.env.VITE_MARINARA_LITE === "true" ? "" : connectionId;
    }
    const index = connectionIndexRef.current;
    if (!index.loaded) return connectionId;
    return index.llmIds.has(connectionId) ? connectionId : "";
  }, []);

  const normalizeImageConnectionOverride = useCallback((connectionId: unknown): string => {
    if (typeof connectionId !== "string" || !connectionId.trim()) return "";
    const index = connectionIndexRef.current;
    if (!index.loaded) return connectionId;
    return index.imageIds.has(connectionId) ? connectionId : "";
  }, []);

  // Find built-in meta (null for custom agents)
  const builtIn = useMemo(() => BUILT_IN_AGENTS.find((a) => a.id === agentDetailId) ?? null, [agentDetailId]);

  // Find DB config — for built-ins, match by type; for custom agents, match by id
  const dbConfig = useMemo(() => {
    if (!agentDetailId || !agentConfigs) return null;
    return (agentConfigs as AgentConfigRow[]).find((c) => c.type === agentDetailId || c.id === agentDetailId) ?? null;
  }, [agentDetailId, agentConfigs]);

  // Custom agent = DB entry with no matching built-in
  const isCustomAgent = !builtIn && !!dbConfig;
  const isNewCustomAgent = agentDetailId === "__new__";
  const customRunIntervalMeta =
    isCustomAgent || isNewCustomAgent
      ? getAgentRunIntervalMeta(isNewCustomAgent ? "__new__" : (dbConfig?.type ?? agentDetailId ?? ""), false)
      : null;

  // ── Local editable state ──
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localPhase, setLocalPhase] = useState<AgentPhase>("post_processing");
  const [localConnectionId, setLocalConnectionId] = useState("");
  const [localImageConnectionId, setLocalImageConnectionId] = useState("");
  const [localContextSize, setLocalContextSize] = useState<number | "">("");
  const [localMaxTokens, setLocalMaxTokens] = useState<number | "">("");
  const [localRunInterval, setLocalRunInterval] = useState<number | "">("");
  const [localActivationKeywordsText, setLocalActivationKeywordsText] = useState("");
  const [localActivationScanDepth, setLocalActivationScanDepth] = useState<number | "">(
    DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  );
  const [customCadenceInputFocused, setCustomCadenceInputFocused] = useState(false);
  const [localPrompt, setLocalPrompt] = useState("");
  const [localAuthor, setLocalAuthor] = useState("");
  const [localPromptTemplates, setLocalPromptTemplates] = useState<AgentPromptTemplateOption[]>([]);
  const [localResultType, setLocalResultType] = useState<CustomAgentResultType>("context_injection");
  const [localCustomCapabilities, setLocalCustomCapabilities] = useState<CustomAgentCapabilityMap>({});
  const [localInjectAsSection, setLocalInjectAsSection] = useState(false);
  const [localIncludePreGenInjections, setLocalIncludePreGenInjections] = useState(false);
  const [localIncludeParallelResults, setLocalIncludeParallelResults] = useState(false);
  const [localEnabledTools, setLocalEnabledTools] = useState<string[]>([]);
  const [toolsSectionOpen, setToolsSectionOpen] = useState(false);
  const [localLorebookWriteEnabled, setLocalLorebookWriteEnabled] = useState(false);
  const [localWritableLorebookId, setLocalWritableLorebookId] = useState("");
  const [localMusicProvider, setLocalMusicProvider] = useState<MusicProvider>("spotify");
  const [localCustomMusicSource, setLocalCustomMusicSource] = useState<CustomMusicSource>("game-assets");
  const [localCustomMusicFolder, setLocalCustomMusicFolder] = useState("music");
  const [localCustomMusicExternalFolder, setLocalCustomMusicExternalFolder] = useState("");
  const [localSpotifyClientId, setLocalSpotifyClientId] = useState("");
  const [localSourceLorebookIds, setLocalSourceLorebookIds] = useState<string[]>([]);
  const [localUseChatActiveLorebooks, setLocalUseChatActiveLorebooks] = useState(false);
  const [localSourceFileIds, setLocalSourceFileIds] = useState<string[]>([]);
  const [localAutoGenerateAvatars, setLocalAutoGenerateAvatars] = useState(false);
  const [localAutoGenerateBackgrounds, setLocalAutoGenerateBackgrounds] = useState(false);
  const [localUseAvatarReferences, setLocalUseAvatarReferences] = useState(false);
  const [localIncludeCharacterAppearance, setLocalIncludeCharacterAppearance] = useState(false);
  const [localImagePositivePrompt, setLocalImagePositivePrompt] = useState("");
  const [localImageNegativePrompt, setLocalImageNegativePrompt] = useState("");
  const [localProseGuardianBanned, setLocalProseGuardianBanned] = useState(DEFAULT_PROSE_GUARDIAN_BANNED_WORDS);
  const [localProseGuardianAvoid, setLocalProseGuardianAvoid] = useState(DEFAULT_PROSE_GUARDIAN_AVOID);
  const [localProseGuardianPrefer, setLocalProseGuardianPrefer] = useState("");
  const [localProseGuardianHoldForRewrite, setLocalProseGuardianHoldForRewrite] = useState(true);
  const [localDirectorMode, setLocalDirectorMode] = useState<NarrativeDirectorMode>("natural");
  const [localSecretPlotEnabled, setLocalSecretPlotEnabled] = useState(false);
  const [localSecretPlotRunInterval, setLocalSecretPlotRunInterval] = useState(8);
  const [spotifyStatus, setSpotifyStatus] = useState<{
    connected: boolean;
    expired: boolean;
    redirectUri: string | null;
  } | null>(null);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [spotifyConnectError, setSpotifyConnectError] = useState<string | null>(null);
  const [spotifyPasteOpen, setSpotifyPasteOpen] = useState(false);
  const [spotifyPasteValue, setSpotifyPasteValue] = useState("");
  const [spotifyPasteError, setSpotifyPasteError] = useState<string | null>(null);
  const [spotifyPasteSubmitting, setSpotifyPasteSubmitting] = useState(false);
  const spotifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spotifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localYoutubeApiKey, setLocalYoutubeApiKey] = useState("");
  const [youtubeConfigured, setYoutubeConfigured] = useState(false);
  const [youtubeSaving, setYoutubeSaving] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const musicPlayerSource = useUIStore((s) => s.musicPlayerSource);
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Populate from DB config or built-in defaults
  useEffect(() => {
    if (!agentDetailId) return;
    const agentType = dbConfig?.type ?? builtIn?.id ?? agentDetailId;
    const defaultSettings = getDefaultBuiltInAgentSettings(agentType);
    if (dbConfig) {
      setLocalName(builtIn ? builtIn.name : dbConfig.name);
      setLocalDescription(dbConfig.description);
      setLocalPhase(normalizeAgentPhaseForType(agentType, dbConfig.phase));
      setLocalConnectionId(normalizeTextConnectionOverride(dbConfig.connectionId));
      const settings = mergeBuiltInAgentSettings(agentType, dbConfig.settings);
      const promptTemplateSource = settings.promptTemplates ?? defaultSettings.promptTemplates;
      setLocalAuthor(
        normalizeAuthor(settings.author, builtIn?.author ?? (isCustomAgent ? "Unknown" : DEFAULT_AGENT_AUTHOR)),
      );
      setLocalPromptTemplates(normalizeAgentPromptTemplateOptions(promptTemplateSource));
      setLocalContextSize(normalizeOptionalNumber(settings.contextSize));
      setLocalMaxTokens(normalizeOptionalNumber(settings.maxTokens) || (defaultSettings.maxTokens as number) || "");
      setLocalImageConnectionId(normalizeImageConnectionOverride(settings.imageConnectionId));
      setLocalRunInterval(
        (settings.runInterval as number | undefined) ?? (defaultSettings.runInterval as number) ?? "",
      );
      setLocalActivationKeywordsText(
        Array.isArray(settings.activationKeywords)
          ? settings.activationKeywords.filter((keyword: unknown) => typeof keyword === "string").join("\n")
          : "",
      );
      setLocalActivationScanDepth(
        (settings.activationScanDepth as number | undefined) ?? DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
      );
      setLocalInjectAsSection(
        (settings.injectAsSection as boolean | undefined) ?? defaultSettings.injectAsSection === true,
      );
      const enabledTools = Array.isArray(settings.enabledTools)
        ? settings.enabledTools.filter((tool: unknown): tool is string => typeof tool === "string")
        : (DEFAULT_AGENT_TOOLS[dbConfig.type] ?? []);
      const writableLorebookId =
        typeof settings.writableLorebookId === "string"
          ? settings.writableLorebookId
          : typeof settings.targetLorebookId === "string"
            ? settings.targetLorebookId
            : Array.isArray(settings.writableLorebookIds) && typeof settings.writableLorebookIds[0] === "string"
              ? settings.writableLorebookIds[0]
              : "";
      setLocalEnabledTools(enabledTools);
      setLocalLorebookWriteEnabled(
        settings.lorebookWriteEnabled === true || enabledTools.includes(LOREBOOK_WRITE_TOOL_NAME),
      );
      setLocalWritableLorebookId(writableLorebookId);
      setLocalMusicProvider(normalizeMusicProvider(settings));
      setLocalCustomMusicSource(normalizeCustomMusicSource(settings));
      setLocalCustomMusicFolder(
        normalizeCustomMusicFolderInput(
          typeof settings.customMusicFolder === "string"
            ? settings.customMusicFolder
            : typeof settings.localMusicFolder === "string"
              ? settings.localMusicFolder
              : "music",
        ),
      );
      setLocalCustomMusicExternalFolder(
        normalizeExternalMusicFolderInput(settings.customMusicExternalFolder ?? settings.localMusicExternalFolder),
      );
      setLocalSpotifyClientId(typeof settings.spotifyClientId === "string" ? settings.spotifyClientId : "");
      setLocalSourceLorebookIds(normalizeStringArray(settings.sourceLorebookIds));
      setLocalUseChatActiveLorebooks(
        (settings.useChatActiveLorebooks as boolean | undefined) ?? defaultSettings.useChatActiveLorebooks === true,
      );
      setLocalSourceFileIds(normalizeStringArray(settings.sourceFileIds));
      setLocalAutoGenerateAvatars(settings.autoGenerateAvatars === true);
      setLocalAutoGenerateBackgrounds(settings.autoGenerateBackgrounds === true);
      setLocalUseAvatarReferences(
        (settings.useAvatarReferences as boolean | undefined) ?? defaultSettings.useAvatarReferences === true,
      );
      setLocalIncludeCharacterAppearance(
        (settings.includeCharacterAppearance as boolean | undefined) ??
          defaultSettings.includeCharacterAppearance === true,
      );
      setLocalImagePositivePrompt((settings.imagePositivePrompt as string) ?? "");
      setLocalImageNegativePrompt((settings.imageNegativePrompt as string) ?? "");
      setLocalProseGuardianBanned(
        typeof settings.banned === "string"
          ? settings.banned
          : typeof defaultSettings.banned === "string"
            ? defaultSettings.banned
            : DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
      );
      setLocalProseGuardianAvoid(
        typeof settings.avoid === "string"
          ? settings.avoid
          : typeof defaultSettings.avoid === "string"
            ? defaultSettings.avoid
            : DEFAULT_PROSE_GUARDIAN_AVOID,
      );
      setLocalProseGuardianPrefer(
        typeof settings.prefer === "string"
          ? settings.prefer
          : typeof defaultSettings.prefer === "string"
            ? defaultSettings.prefer
            : "",
      );
      setLocalProseGuardianHoldForRewrite(
        (settings.holdForRewrite as boolean | undefined) ?? defaultSettings.holdForRewrite !== false,
      );
      setLocalDirectorMode(normalizeNarrativeDirectorMode(settings.directorMode ?? defaultSettings.directorMode));
      setLocalSecretPlotEnabled(
        (settings.secretPlotEnabled as boolean | undefined) ?? defaultSettings.secretPlotEnabled === true,
      );
      setLocalSecretPlotRunInterval(
        normalizePositiveInteger(settings.secretPlotRunInterval ?? defaultSettings.secretPlotRunInterval, 8, 100),
      );
      setLocalCustomCapabilities(normalizeCustomAgentCapabilities(settings));
      setLocalResultType(normalizeCustomResultType(settings.resultType));
      setLocalIncludePreGenInjections(settings.includePreGenInjections === true);
      setLocalIncludeParallelResults(settings.includeParallelResults === true);
      setLocalPrompt(dbConfig.promptTemplate || "");
    } else if (builtIn) {
      setLocalName(builtIn.name);
      setLocalDescription(builtIn.description);
      setLocalAuthor(builtIn.author ?? DEFAULT_AGENT_AUTHOR);
      setLocalPromptTemplates(normalizeAgentPromptTemplateOptions(defaultSettings.promptTemplates));
      setLocalPhase(normalizeAgentPhaseForType(builtIn.id, builtIn.phase));
      setLocalConnectionId("");
      setLocalImageConnectionId("");
      setLocalContextSize("");
      setLocalMaxTokens((defaultSettings.maxTokens as number) ?? "");
      setLocalRunInterval((defaultSettings.runInterval as number) ?? "");
      setLocalActivationKeywordsText("");
      setLocalActivationScanDepth(DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH);
      setLocalInjectAsSection(defaultSettings.injectAsSection === true);
      setLocalEnabledTools(DEFAULT_AGENT_TOOLS[builtIn.id] ?? []);
      setLocalSpotifyClientId("");
      setLocalSourceLorebookIds([]);
      setLocalUseChatActiveLorebooks(defaultSettings.useChatActiveLorebooks === true);
      setLocalSourceFileIds([]);
      setLocalAutoGenerateAvatars(false);
      setLocalAutoGenerateBackgrounds(false);
      setLocalUseAvatarReferences(defaultSettings.useAvatarReferences === true);
      setLocalIncludeCharacterAppearance(defaultSettings.includeCharacterAppearance === true);
      setLocalImagePositivePrompt("");
      setLocalImageNegativePrompt("");
      setLocalProseGuardianBanned(
        typeof defaultSettings.banned === "string" ? defaultSettings.banned : DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
      );
      setLocalProseGuardianAvoid(
        typeof defaultSettings.avoid === "string" ? defaultSettings.avoid : DEFAULT_PROSE_GUARDIAN_AVOID,
      );
      setLocalProseGuardianPrefer(typeof defaultSettings.prefer === "string" ? defaultSettings.prefer : "");
      setLocalProseGuardianHoldForRewrite(defaultSettings.holdForRewrite !== false);
      setLocalDirectorMode(normalizeNarrativeDirectorMode(defaultSettings.directorMode));
      setLocalSecretPlotEnabled(defaultSettings.secretPlotEnabled === true);
      setLocalSecretPlotRunInterval(normalizePositiveInteger(defaultSettings.secretPlotRunInterval, 8, 100));
      setLocalCustomCapabilities({});
      setLocalResultType("context_injection");
      setLocalIncludePreGenInjections(false);
      setLocalIncludeParallelResults(false);
      setLocalLorebookWriteEnabled(false);
      setLocalWritableLorebookId("");
      setLocalMusicProvider(normalizeMusicProvider(defaultSettings));
      setLocalCustomMusicSource(normalizeCustomMusicSource(defaultSettings));
      setLocalCustomMusicFolder(
        normalizeCustomMusicFolderInput(
          typeof defaultSettings.customMusicFolder === "string" ? defaultSettings.customMusicFolder : "music",
        ),
      );
      setLocalCustomMusicExternalFolder(
        normalizeExternalMusicFolderInput(
          defaultSettings.customMusicExternalFolder ?? defaultSettings.localMusicExternalFolder,
        ),
      );
      setLocalPrompt("");
    } else {
      // Brand new custom agent — start empty
      setLocalName("New Agent");
      setLocalDescription("");
      setLocalAuthor("");
      setLocalPromptTemplates([]);
      setLocalPhase("post_processing");
      setLocalConnectionId("");
      setLocalImageConnectionId("");
      setLocalContextSize("");
      setLocalMaxTokens(DEFAULT_AGENT_MAX_TOKENS);
      setLocalRunInterval(customRunIntervalMeta?.defaultValue ?? "");
      setLocalActivationKeywordsText("");
      setLocalActivationScanDepth(DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH);
      setLocalInjectAsSection(false);
      setLocalEnabledTools([]);
      setLocalSpotifyClientId("");
      setLocalSourceLorebookIds([]);
      setLocalUseChatActiveLorebooks(false);
      setLocalSourceFileIds([]);
      setLocalAutoGenerateAvatars(false);
      setLocalAutoGenerateBackgrounds(false);
      setLocalUseAvatarReferences(false);
      setLocalIncludeCharacterAppearance(false);
      setLocalImagePositivePrompt("");
      setLocalImageNegativePrompt("");
      setLocalProseGuardianBanned(DEFAULT_PROSE_GUARDIAN_BANNED_WORDS);
      setLocalProseGuardianAvoid(DEFAULT_PROSE_GUARDIAN_AVOID);
      setLocalProseGuardianPrefer("");
      setLocalProseGuardianHoldForRewrite(true);
      setLocalDirectorMode("natural");
      setLocalSecretPlotEnabled(false);
      setLocalSecretPlotRunInterval(8);
      setLocalCustomCapabilities({});
      setLocalResultType("context_injection");
      setLocalIncludePreGenInjections(false);
      setLocalIncludeParallelResults(false);
      setLocalLorebookWriteEnabled(false);
      setLocalWritableLorebookId("");
      setLocalMusicProvider("spotify");
      setLocalCustomMusicSource("game-assets");
      setLocalCustomMusicFolder("music");
      setLocalCustomMusicExternalFolder("");
      setLocalPrompt("");
    }
    setDirty(false);
    setSaveError(null);
  }, [
    agentDetailId,
    dbConfig,
    builtIn,
    customRunIntervalMeta?.defaultValue,
    isCustomAgent,
    normalizeTextConnectionOverride,
    normalizeImageConnectionOverride,
  ]);

  // Fetch music connection status when viewing Music DJ.
  const isSpotifyAgent = agentDetailId === "spotify" || dbConfig?.type === "spotify";
  const isMusicAgent = isSpotifyAgent;

  const showsYoutubeSettings = isMusicAgent;

  // In YouTube mode Music DJ runs tool-free and returns its pick as a search-query
  // JSON, so the editor reflects the YouTube-specific built-in prompt and skips the
  // (Spotify-only) tool toggles.
  const musicDjYoutubeMode = isMusicAgent && localMusicProvider === "youtube";
  const musicDjCustomMode = isMusicAgent && localMusicProvider === "custom";

  // Default prompt for this agent type. Music DJ has a separate built-in prompt per
  // provider, so show the service-specific prompt when that provider is selected.
  const defaultPrompt = useMemo(
    () =>
      agentDetailId
        ? getDefaultAgentPrompt(musicDjCustomMode ? "local-music" : musicDjYoutubeMode ? "youtube" : agentDetailId)
        : "",
    [agentDetailId, musicDjCustomMode, musicDjYoutubeMode],
  );

  // Lorebook Keeper agent — run interval setting
  const isLorebookKeeperAgent = agentDetailId === "lorebook-keeper" || dbConfig?.type === "lorebook-keeper";
  // Card Evolution Auditor agent — run interval setting
  const isCardEvolutionAuditorAgent =
    agentDetailId === "card-evolution-auditor" || dbConfig?.type === "card-evolution-auditor";

  // Narrative Director agent — one-shot story push setting
  const isDirectorAgent = agentDetailId === "director" || dbConfig?.type === "director";

  // Illustrator agent — run interval setting
  const isIllustratorAgent = agentDetailId === "illustrator" || dbConfig?.type === "illustrator";

  // Knowledge Retrieval agent — lorebook source selector
  const isKnowledgeRetrievalAgent = agentDetailId === "knowledge-retrieval" || dbConfig?.type === "knowledge-retrieval";
  // Knowledge Router agent — also uses the lorebook source selector (file picker stays Retrieval-only)
  const isKnowledgeRouterAgent = agentDetailId === "knowledge-router" || dbConfig?.type === "knowledge-router";
  // Background agent — can optionally generate missing roleplay backgrounds.
  const isBackgroundAgent = agentDetailId === "background" || dbConfig?.type === "background";
  // Prose Guardian agent — exposes macro defaults used by its rewrite prompt.
  const isProseGuardianAgent = agentDetailId === "prose-guardian" || dbConfig?.type === "prose-guardian";
  // Continuity Checker agent — shares the rewrite reveal timing control.
  const isContinuityAgent = agentDetailId === "continuity" || dbConfig?.type === "continuity";

  // Detect when both knowledge agents are configured. Actual activation is
  // chat-scoped, but saving both with overlapping sources can still bloat the
  // prompt when a chat enables them together.
  const bothKnowledgeAgentsConfigured = useMemo(() => {
    if (!agentConfigs) return false;
    if (!isKnowledgeRouterAgent && !isKnowledgeRetrievalAgent) return false;
    const rows = agentConfigs as AgentConfigRow[];
    const configuredTypes = new Set(rows.filter((c) => !isAgentConfigDeleted(c.settings)).map((c) => c.type));
    return configuredTypes.has("knowledge-router") && configuredTypes.has("knowledge-retrieval");
  }, [agentConfigs, isKnowledgeRetrievalAgent, isKnowledgeRouterAgent]);

  const { data: allLorebooks } = useLorebooks();

  // For the router only: compute description coverage across the selected source
  // lorebooks. Used to render the coverage badge that tells users whether their
  // selected lorebooks are well-described enough for routing precision.
  const {
    entries: routerSourceEntries,
    isLoading: routerEntriesLoading,
    isError: routerEntriesError,
  } = useEntriesAcrossLorebooks(isKnowledgeRouterAgent ? localSourceLorebookIds : []);
  // `descriptionCoverage` is non-null whenever there's something to display —
  // including the zero-entry case (renders as "No entries yet"). Returns null
  // when there's no selection, when entries are still loading/erroring (so the
  // hook hasn't given us a complete set yet), or when the agent isn't the router.
  const descriptionCoverage = useMemo(() => {
    if (localSourceLorebookIds.length === 0) return null;
    if (!routerSourceEntries) return null; // hook returned undefined → still loading or errored
    const total = routerSourceEntries.length;
    const withDescription = routerSourceEntries.filter((e) => e.description?.trim().length > 0).length;
    const ratio = total > 0 ? withDescription / total : 0;
    return { withDescription, total, ratio };
  }, [localSourceLorebookIds.length, routerSourceEntries]);
  const { data: allKnowledgeSources } = useKnowledgeSources();
  const uploadSource = useUploadKnowledgeSource();
  const deleteSource = useDeleteKnowledgeSource();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isMusicAgent || !dbConfig?.id) {
      setSpotifyStatus(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/spotify/status?agentId=${encodeURIComponent(dbConfig.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setSpotifyStatus({ connected: data.connected, expired: data.expired, redirectUri: data.redirectUri ?? null });
      })
      .catch(() => {
        if (!cancelled) setSpotifyStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isMusicAgent, dbConfig?.id]);

  // Fetch YouTube key-configured status when viewing Music DJ or a legacy YouTube agent.
  useEffect(() => {
    if (!showsYoutubeSettings || !dbConfig?.id) {
      setYoutubeConfigured(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/youtube/status?agentId=${encodeURIComponent(dbConfig.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setYoutubeConfigured(data.configured === true);
      })
      .catch(() => {
        if (!cancelled) setYoutubeConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showsYoutubeSettings, dbConfig?.id]);

  // Clean up Spotify polling timers on unmount
  useEffect(() => {
    return () => {
      if (spotifyPollRef.current) clearInterval(spotifyPollRef.current);
      if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current);
    };
  }, []);

  // Whether the prompt textarea shows the default or a custom override
  const isUsingDefaultPrompt = !localPrompt.trim();
  const _displayPrompt = isUsingDefaultPrompt ? defaultPrompt : localPrompt;

  const allConnections =
    (connections as
      | Array<{ id: string; name: string; provider: string; defaultForAgents?: boolean | string }>
      | undefined) ?? [];

  const llmConnections = allConnections.filter((conn) => conn.provider !== "image_generation");
  const imageConnections = allConnections.filter((conn) => conn.provider === "image_generation");

  const defaultAgentConn = allConnections.find(
    (c) => c.provider !== "image_generation" && (c.defaultForAgents === true || c.defaultForAgents === "true"),
  );

  const defaultAgentImageConn = imageConnections.find(
    (c) => c.defaultForAgents === true || c.defaultForAgents === "true",
  );

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeAgentDetail();
  }, [dirty, closeAgentDetail]);

  const openAgentDetail = useUIStore((s) => s.openAgentDetail);

  const handleSave = useCallback(async () => {
    if (!agentDetailId) return;
    setSaveError(null);
    const isEditingCustomAgent = isCustomAgent || isNewCustomAgent;
    const agentType = dbConfig?.type ?? builtIn?.id ?? agentDetailId;
    const selectedPhase = isEditingCustomAgent && localResultType === "text_rewrite" ? "post_processing" : localPhase;
    const savedPhase = normalizeAgentPhaseForType(agentType, selectedPhase);
    const mayIncludeTurnData = isEditingCustomAgent && savedPhase === "post_processing";
    const activationKeywords = isEditingCustomAgent ? parseActivationKeywordsText(localActivationKeywordsText) : [];
    const activationScanDepth =
      localActivationScanDepth === ""
        ? DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH
        : Math.max(
            1,
            Math.min(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH, Math.floor(Number(localActivationScanDepth) || 1)),
          );
    const customCapabilities = customCapabilityMapFromLocal(localCustomCapabilities);
    if (isEditingCustomAgent && !resultTypeAllowedByCapabilities(localResultType, customCapabilities)) {
      setSaveError("Enable the matching custom-agent ability before saving this result type.");
      return;
    }
    const writableLorebookId = localWritableLorebookId.trim();
    const lorebookWriterEnabled =
      isEditingCustomAgent && localLorebookWriteEnabled && customCapabilities.edit_lorebooks === true;
    if (lorebookWriterEnabled && !writableLorebookId) {
      setSaveError("Select a target lorebook before enabling lorebook writing for this agent.");
      return;
    }
    const effectiveEnabledTools = Array.from(
      new Set(
        lorebookWriterEnabled
          ? [...localEnabledTools, LOREBOOK_WRITE_TOOL_NAME]
          : localEnabledTools.filter((tool) => tool !== LOREBOOK_WRITE_TOOL_NAME),
      ),
    ).filter((tool) => customCapabilities.edit_messages === true || tool !== MESSAGE_EDIT_TOOL_NAME);
    const savedAuthor = localAuthor.trim() || (builtIn ? DEFAULT_AGENT_AUTHOR : "Unknown");
    const savedPromptTemplates = normalizeAgentPromptTemplateOptions(localPromptTemplates);

    // Preserve OAuth fields the form doesn't expose. The server replaces
    // `settings` wholesale, so anything we omit here would be wiped — and the
    // Spotify tokens live in settings rather than their own column.
    const currentSettings: Record<string, unknown> = parseAgentSettingsRecord(dbConfig?.settings);
    const preservedSpotifyFields: Record<string, unknown> = {};
    for (const key of [
      "spotifyAccessToken",
      "spotifyRefreshToken",
      "spotifyExpiresAt",
      "spotifyScope",
      // YouTube key is encrypted server-side and not exposed by the form — preserve it
      // so a normal agent Save doesn't wipe the stored key.
      "youtubeApiKey",
    ]) {
      if (currentSettings[key] !== undefined) preservedSpotifyFields[key] = currentSettings[key];
    }
    const savedConnectionId = normalizeTextConnectionOverride(localConnectionId);
    const savedImageConnectionId = normalizeImageConnectionOverride(localImageConnectionId);

    const payload = {
      name: localName,
      description: localDescription,
      phase: savedPhase,
      enabled: true,
      connectionId: savedConnectionId || null,
      promptTemplate: localPrompt,
      settings: {
        ...preservedSpotifyFields,
        author: savedAuthor,
        promptTemplates: savedPromptTemplates,
        ...(isEditingCustomAgent ? { customCapabilities } : {}),
        ...(isEditingCustomAgent ? { resultType: localResultType } : {}),
        ...(activationKeywords.length > 0
          ? {
              activationKeywords,
              activationScanDepth,
            }
          : {}),
        ...(mayIncludeTurnData && localIncludePreGenInjections ? { includePreGenInjections: true } : {}),
        ...(mayIncludeTurnData && localIncludeParallelResults ? { includeParallelResults: true } : {}),
        ...(localContextSize !== "" ? { contextSize: Number(localContextSize) } : {}),
        ...(localMaxTokens !== "" ? { maxTokens: clampAgentMaxTokens(localMaxTokens) } : {}),
        ...(!isDirectorAgent && localRunInterval !== "" ? { runInterval: Number(localRunInterval) } : {}),
        ...(!isDirectorAgent && localInjectAsSection ? { injectAsSection: true } : {}),
        ...(isMusicAgent
          ? {
              musicProvider: localMusicProvider,
              customMusicSource: localCustomMusicSource,
              customMusicFolder: normalizeCustomMusicFolderInput(localCustomMusicFolder),
              ...(localCustomMusicExternalFolder.trim()
                ? { customMusicExternalFolder: localCustomMusicExternalFolder.trim() }
                : {}),
            }
          : {}),
        enabledTools: isMusicAgent && localMusicProvider !== "spotify" ? [] : effectiveEnabledTools,
        ...(lorebookWriterEnabled
          ? { lorebookWriteEnabled: true, writableLorebookId, writableLorebookIds: [writableLorebookId] }
          : {}),
        ...(localSpotifyClientId ? { spotifyClientId: localSpotifyClientId } : {}),
        ...(isKnowledgeRetrievalAgent || isKnowledgeRouterAgent
          ? { useChatActiveLorebooks: localUseChatActiveLorebooks }
          : {}),
        ...(localSourceLorebookIds.length > 0 ? { sourceLorebookIds: localSourceLorebookIds } : {}),
        // Only persist sourceFileIds for the Knowledge Retrieval agent — the Router
        // doesn't read this setting. Without this guard, switching an agent from
        // Retrieval to Router would leave behind stale file IDs the user can no
        // longer see or remove via the UI.
        ...(isKnowledgeRetrievalAgent && localSourceFileIds.length > 0 ? { sourceFileIds: localSourceFileIds } : {}),
        ...(savedImageConnectionId ? { imageConnectionId: savedImageConnectionId } : {}),
        ...(localAutoGenerateAvatars ? { autoGenerateAvatars: true } : {}),
        ...(localAutoGenerateBackgrounds ? { autoGenerateBackgrounds: true } : {}),
        ...(isIllustratorAgent
          ? {
              useAvatarReferences: localUseAvatarReferences,
              includeCharacterAppearance: localIncludeCharacterAppearance,
            }
          : {}),
        ...(isProseGuardianAgent
          ? {
              banned: localProseGuardianBanned.trim() || DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
              avoid: localProseGuardianAvoid.trim() || DEFAULT_PROSE_GUARDIAN_AVOID,
              prefer: localProseGuardianPrefer.trim(),
              holdForRewrite: localProseGuardianHoldForRewrite,
            }
          : {}),
        ...(isContinuityAgent ? { holdForRewrite: localProseGuardianHoldForRewrite } : {}),
        ...(isDirectorAgent
          ? {
              directorMode: localDirectorMode,
              secretPlotEnabled: localSecretPlotEnabled,
              secretPlotRunInterval: localSecretPlotRunInterval,
            }
          : {}),
        ...(localImagePositivePrompt.trim() ? { imagePositivePrompt: localImagePositivePrompt.trim() } : {}),
        ...(localImageNegativePrompt.trim() ? { imageNegativePrompt: localImageNegativePrompt.trim() } : {}),
      },
    };

    try {
      if (dbConfig) {
        await updateAgent.mutateAsync({ id: dbConfig.id, ...payload });
      } else {
        // Built-ins are keyed by type. Custom agents need unique types so creating
        // another "New Agent" does not overwrite the existing custom agent.
        const typeId = builtIn ? agentDetailId : createCustomAgentType(localName);
        const created = (await createAgent.mutateAsync({
          ...payload,
          type: typeId,
        })) as { id?: string } | undefined;
        // After creating a new custom agent, switch agentDetailId to its DB id
        if (!builtIn && created?.id) {
          openAgentDetail(created.id);
        }
      }
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save agent config");
    }
  }, [
    agentDetailId,
    localName,
    localDescription,
    localPhase,
    localResultType,
    localCustomCapabilities,
    localConnectionId,
    localImageConnectionId,
    localIncludePreGenInjections,
    localIncludeParallelResults,
    localPrompt,
    localAuthor,
    localPromptTemplates,
    localContextSize,
    localMaxTokens,
    localRunInterval,
    localActivationKeywordsText,
    localActivationScanDepth,
    localInjectAsSection,
    localEnabledTools,
    localLorebookWriteEnabled,
    localWritableLorebookId,
    localMusicProvider,
    localCustomMusicSource,
    localCustomMusicFolder,
    localCustomMusicExternalFolder,
    localSpotifyClientId,
    localUseChatActiveLorebooks,
    localSourceLorebookIds,
    localSourceFileIds,
    localAutoGenerateAvatars,
    localAutoGenerateBackgrounds,
    localUseAvatarReferences,
    localIncludeCharacterAppearance,
    localProseGuardianBanned,
    localProseGuardianAvoid,
    localProseGuardianPrefer,
    localProseGuardianHoldForRewrite,
    localDirectorMode,
    localSecretPlotEnabled,
    localSecretPlotRunInterval,
    localImagePositivePrompt,
    localImageNegativePrompt,
    dbConfig,
    builtIn,
    isCustomAgent,
    isNewCustomAgent,
    isIllustratorAgent,
    isProseGuardianAgent,
    isContinuityAgent,
    isDirectorAgent,
    isMusicAgent,
    isKnowledgeRetrievalAgent,
    isKnowledgeRouterAgent,
    updateAgent,
    createAgent,
    openAgentDetail,
    normalizeTextConnectionOverride,
    normalizeImageConnectionOverride,
  ]);

  const handleExportAgent = () => {
    if (!agentDetailId) return;
    const isEditingCustomAgent = isCustomAgent || isNewCustomAgent;
    const agentType = dbConfig?.type ?? builtIn?.id ?? createCustomAgentType(localName);
    const selectedPhase = isEditingCustomAgent && localResultType === "text_rewrite" ? "post_processing" : localPhase;
    const savedPhase = normalizeAgentPhaseForType(agentType, selectedPhase);
    const mayIncludeTurnData = isEditingCustomAgent && savedPhase === "post_processing";
    const activationKeywords = isEditingCustomAgent ? parseActivationKeywordsText(localActivationKeywordsText) : [];
    const activationScanDepth =
      localActivationScanDepth === ""
        ? DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH
        : Math.max(
            1,
            Math.min(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH, Math.floor(Number(localActivationScanDepth) || 1)),
          );
    const customCapabilities = customCapabilityMapFromLocal(localCustomCapabilities);
    if (isEditingCustomAgent && !resultTypeAllowedByCapabilities(localResultType, customCapabilities)) {
      toast.error("Enable the matching custom-agent ability before exporting this result type.");
      return;
    }
    const writableLorebookId = localWritableLorebookId.trim();
    const lorebookWriterEnabled =
      isEditingCustomAgent && localLorebookWriteEnabled && customCapabilities.edit_lorebooks === true;
    const effectiveEnabledTools = Array.from(
      new Set(
        lorebookWriterEnabled
          ? [...localEnabledTools, LOREBOOK_WRITE_TOOL_NAME]
          : localEnabledTools.filter((tool) => tool !== LOREBOOK_WRITE_TOOL_NAME),
      ),
    ).filter((tool) => customCapabilities.edit_messages === true || tool !== MESSAGE_EDIT_TOOL_NAME);
    const savedAuthor = localAuthor.trim() || (builtIn ? DEFAULT_AGENT_AUTHOR : "Unknown");
    const savedPromptTemplates = normalizeAgentPromptTemplateOptions(localPromptTemplates);
    const exportingMusicAgent = agentType === "spotify";
    const settings = sanitizeAgentSettingsForTransfer({
      author: savedAuthor,
      promptTemplates: savedPromptTemplates,
      ...(isEditingCustomAgent ? { customCapabilities } : {}),
      ...(isEditingCustomAgent ? { resultType: localResultType } : {}),
      ...(activationKeywords.length > 0 ? { activationKeywords, activationScanDepth } : {}),
      ...(mayIncludeTurnData && localIncludePreGenInjections ? { includePreGenInjections: true } : {}),
      ...(mayIncludeTurnData && localIncludeParallelResults ? { includeParallelResults: true } : {}),
      ...(localContextSize !== "" ? { contextSize: Number(localContextSize) } : {}),
      ...(localMaxTokens !== "" ? { maxTokens: clampAgentMaxTokens(localMaxTokens) } : {}),
      ...(!isDirectorAgent && localRunInterval !== "" ? { runInterval: Number(localRunInterval) } : {}),
      ...(!isDirectorAgent && localInjectAsSection ? { injectAsSection: true } : {}),
      ...(exportingMusicAgent
        ? {
            musicProvider: localMusicProvider,
            customMusicSource: localCustomMusicSource,
            customMusicFolder: normalizeCustomMusicFolderInput(localCustomMusicFolder),
            ...(localCustomMusicExternalFolder.trim()
              ? { customMusicExternalFolder: localCustomMusicExternalFolder.trim() }
              : {}),
          }
        : {}),
      enabledTools: exportingMusicAgent && localMusicProvider !== "spotify" ? [] : effectiveEnabledTools,
      ...(lorebookWriterEnabled
        ? { lorebookWriteEnabled: true, writableLorebookId, writableLorebookIds: [writableLorebookId] }
        : {}),
      ...(localSpotifyClientId ? { spotifyClientId: localSpotifyClientId } : {}),
      ...(isKnowledgeRetrievalAgent || isKnowledgeRouterAgent
        ? { useChatActiveLorebooks: localUseChatActiveLorebooks }
        : {}),
      ...(localSourceLorebookIds.length > 0 ? { sourceLorebookIds: localSourceLorebookIds } : {}),
      ...(isKnowledgeRetrievalAgent && localSourceFileIds.length > 0 ? { sourceFileIds: localSourceFileIds } : {}),
      ...(localImageConnectionId ? { imageConnectionId: localImageConnectionId } : {}),
      ...(localAutoGenerateAvatars ? { autoGenerateAvatars: true } : {}),
      ...(localAutoGenerateBackgrounds ? { autoGenerateBackgrounds: true } : {}),
      ...(isIllustratorAgent
        ? {
            useAvatarReferences: localUseAvatarReferences,
            includeCharacterAppearance: localIncludeCharacterAppearance,
          }
        : {}),
      ...(isProseGuardianAgent
        ? {
            banned: localProseGuardianBanned.trim() || DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
            avoid: localProseGuardianAvoid.trim() || DEFAULT_PROSE_GUARDIAN_AVOID,
            prefer: localProseGuardianPrefer.trim(),
            holdForRewrite: localProseGuardianHoldForRewrite,
          }
        : {}),
      ...(isContinuityAgent ? { holdForRewrite: localProseGuardianHoldForRewrite } : {}),
      ...(isDirectorAgent
        ? {
            directorMode: localDirectorMode,
            secretPlotEnabled: localSecretPlotEnabled,
            secretPlotRunInterval: localSecretPlotRunInterval,
          }
        : {}),
      ...(localImagePositivePrompt.trim() ? { imagePositivePrompt: localImagePositivePrompt.trim() } : {}),
      ...(localImageNegativePrompt.trim() ? { imageNegativePrompt: localImageNegativePrompt.trim() } : {}),
    });
    const bundledCustomTools = getReferencedCustomTools(
      Array.isArray(settings.enabledTools) ? settings.enabledTools.filter((tool): tool is string => typeof tool === "string") : [],
      (customToolsRaw as CustomToolRow[] | undefined) ?? [],
    ).map(serializeCustomToolForTransfer);
    downloadZipFile(
      createAgentFolderPackageFiles(
        [
          {
            type: agentType,
            name: localName,
            description: localDescription,
            phase: savedPhase,
            enabled: true,
            connectionId: null,
            imagePath: null,
            promptTemplate: localPrompt,
            settings,
            ...(isEditingCustomAgent ? { resultType: localResultType } : {}),
          },
        ],
        { customTools: bundledCustomTools },
      ),
      createAgentFolderPackageFilename(localName || agentType, "agent"),
    );
    toast.success(`Exported ${localName || "agent"}`);
  };

  const handleResetPrompt = useCallback(() => {
    setLocalPrompt("");
    setDirty(true);
  }, []);

  const handleLoadDefault = useCallback(() => {
    setLocalPrompt(defaultPrompt);
    setDirty(true);
  }, [defaultPrompt]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleMusicProviderChange = useCallback(
    (provider: MusicProvider) => {
      setLocalMusicProvider(provider);
      setMusicPlayerSource(provider);
      if (provider === "spotify" && localEnabledTools.length === 0) {
        setLocalEnabledTools(DEFAULT_AGENT_TOOLS.spotify ?? []);
      } else if (provider !== "spotify" && localEnabledTools.length > 0) {
        setLocalEnabledTools([]);
      }
      setDirty(true);
    },
    [localEnabledTools.length, setMusicPlayerSource],
  );

  const handleOpenCustomMusicFolder = useCallback(async () => {
    const subfolder = normalizeCustomMusicFolderInput(localCustomMusicFolder);
    try {
      await fetch("/api/game-assets/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subfolder }),
      });
      toast.success(`Opened Game Assets/${subfolder}`);
    } catch {
      toast.error("Could not open the Custom music folder.");
    }
  }, [localCustomMusicFolder]);

  const handleSelectCustomMusicFolder = useCallback(async () => {
    try {
      const res = await fetch("/api/game-assets/pick-local-music-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; path?: string; error?: string };
      if (!res.ok || data.success !== true || !data.path) {
        throw new Error(data.error ?? "No folder selected.");
      }
      setLocalCustomMusicExternalFolder(data.path);
      setLocalCustomMusicSource("folder");
      setDirty(true);
      toast.success("Selected custom music folder.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select a custom music folder.");
    }
  }, []);

  const toggleCustomCapability = useCallback(
    (capability: CustomAgentCapability) => {
      setLocalCustomCapabilities((current) => {
        const next = { ...current, [capability]: current[capability] !== true };
        if (next[capability] !== true) {
          const currentResultAllowed = resultTypeAllowedByCapabilities(localResultType, next);
          if (!currentResultAllowed) {
            setLocalResultType("context_injection");
          }
          if (capability === "edit_lorebooks") {
            setLocalLorebookWriteEnabled(false);
          }
        }
        return customCapabilityMapFromLocal(next);
      });
      markDirty();
    },
    [localResultType, markDirty],
  );

  const handleAddPromptTemplate = useCallback(() => {
    setLocalPromptTemplates((options) => [...options, createBlankPromptOption(options)]);
    markDirty();
  }, [markDirty]);

  const handleUpdatePromptTemplate = useCallback(
    (id: string, patch: Partial<Pick<AgentPromptTemplateOption, "name" | "promptTemplate" | "description">>) => {
      setLocalPromptTemplates((options) =>
        options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
      );
      markDirty();
    },
    [markDirty],
  );

  const handleRemovePromptTemplate = useCallback(
    (id: string) => {
      setLocalPromptTemplates((options) => options.filter((option) => option.id !== id));
      markDirty();
    },
    [markDirty],
  );

  const currentAgentType = dbConfig?.type ?? builtIn?.id ?? agentDetailId ?? "";
  const normalizedLocalPhase = normalizeAgentPhaseForType(currentAgentType, localPhase);
  const phaseMeta = PHASE_META[normalizedLocalPhase];
  const effectivePhase =
    (isCustomAgent || isNewCustomAgent) && localResultType === "text_rewrite"
      ? "post_processing"
      : normalizedLocalPhase;
  const showTurnDataAccess = (isCustomAgent || isNewCustomAgent) && effectivePhase === "post_processing";
  const visibleBuiltInTools = useMemo(
    () =>
      BUILT_IN_TOOLS.filter(
        (tool) =>
          tool.name !== LOREBOOK_WRITE_TOOL_NAME &&
          (tool.name !== MESSAGE_EDIT_TOOL_NAME || localCustomCapabilities.edit_messages === true),
      ),
    [localCustomCapabilities.edit_messages],
  );
  const selectableCustomTools = useMemo(
    () =>
      (customToolsRaw as CustomToolRow[] | undefined)?.filter((tool) =>
        isCustomToolSelectable(tool, customToolCapabilities),
      ) ?? [],
    [customToolsRaw, customToolCapabilities],
  );
  const visibleToolNames = useMemo(
    () => new Set([...visibleBuiltInTools.map((tool) => tool.name), ...selectableCustomTools.map((tool) => tool.name)]),
    [selectableCustomTools, visibleBuiltInTools],
  );
  const selectedVisibleToolCount = localEnabledTools.filter((toolName) => visibleToolNames.has(toolName)).length;
  const availableVisibleToolCount = visibleToolNames.size;

  // ── Loading / not found ──
  if (!agentDetailId || (!builtIn && !dbConfig && agentDetailId !== "__new__")) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
        Agent not found.
      </div>
    );
  }

  const handleDelete = async () => {
    if (!dbConfig) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Agent",
        message: "Delete this custom agent? This cannot be undone.",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deleteAgent.mutateAsync(dbConfig.id);
    closeAgentDetail();
  };

  const isPending = updateAgent.isPending || createAgent.isPending;

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="mari-editor-header">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Back to agents"
          className="mari-editor-action inline-flex"
        >
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <Sparkles size="1.125rem" className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]" />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="mari-editor-title-input min-w-0 flex-1 placeholder:text-[var(--marinara-editor-muted)]"
          placeholder="Agent name…"
        />
        <div className="mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2">
          {saveError && (
            <span className="mari-editor-status mr-2 text-red-400">
              <AlertCircle size="0.6875rem" /> Save failed
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mari-editor-status mr-2 text-emerald-400">
              <Check size="0.6875rem" /> Saved
            </span>
          )}
          {dirty && !saveError && <span className="mari-editor-status mr-2 text-amber-400">Unsaved</span>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
          >
            <Save size="0.8125rem" /> <span className="max-md:hidden">Save</span>
          </button>
          <button
            onClick={handleExportAgent}
            className="mari-editor-action inline-flex"
            title="Export agent"
            aria-label="Export agent"
          >
            <Upload size="0.9375rem" />
          </button>
          {isCustomAgent && dbConfig && (
            <button
              onClick={handleDelete}
              className="mari-editor-action mari-editor-action--danger inline-flex"
              title="Delete agent"
              aria-label="Delete agent"
            >
              <Trash2 size="0.9375rem" />
            </button>
          )}
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              Keep editing
            </button>
            <button
              onClick={() => closeAgentDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={async () => {
                await handleSave();
                closeAgentDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              Save & close
            </button>
          </div>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          <AlertCircle size="0.8125rem" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="rounded-lg px-2 py-0.5 hover:bg-red-500/20">
            <X size="0.75rem" />
          </button>
        </div>
      )}

      {/* Both-knowledge-agents-configured warning. Both can run in parallel
          without crashing, but they do overlapping work and bloat the prompt
          with two injection blocks. The warning surfaces this so users either
          choose one or knowingly accept the cost. */}
      {bothKnowledgeAgentsConfigured && (
        <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <AlertCircle size="0.8125rem" />
          <span className="flex-1">
            {isKnowledgeRouterAgent ? "Knowledge Retrieval" : "Knowledge Router"} is also configured. Both agents can
            run in parallel if a chat enables both, injecting overlapping context. Consider enabling only one for cleaner
            prompts.
          </span>
        </div>
      )}

      {/* ── Body ── */}
      <div className="mari-editor-content max-md:p-4">
        <div className="mari-editor-content-inner mari-editor-content-inner--wide space-y-6">
          {/* ── Description ── */}
          <FieldGroup
            label="Description"
            icon={<Info size="0.875rem" className="text-[var(--primary)]" />}
            help="A short summary of what this agent does, plus author credit for the person or team who made it."
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Description</span>
                <input
                  value={localDescription}
                  onChange={(e) => {
                    setLocalDescription(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder="What does this agent do…"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Author</span>
                <input
                  value={localAuthor}
                  onChange={(e) => {
                    setLocalAuthor(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={builtIn ? DEFAULT_AGENT_AUTHOR : "Your name"}
                />
              </label>
            </div>
          </FieldGroup>

          {/* Agent Pipeline Phase */}
          <FieldGroup
            label="Pipeline Phase"
            icon={<Zap size="0.875rem" className="text-[var(--primary)]" />}
            help="When this agent runs during generation. Pre-Generation runs before the AI replies, Parallel runs alongside, Post-Processing runs after the reply is complete."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.entries(PHASE_META) as [AgentPhase, typeof phaseMeta][]).map(([phase, meta]) => {
                const isActive = normalizedLocalPhase === phase;
                const Icon = meta.icon;
                return (
                  <button
                    key={phase}
                    onClick={() => {
                      setLocalPhase(normalizeAgentPhaseForType(currentAgentType, phase));
                      markDirty();
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs ring-1 transition-all",
                      isActive
                        ? "bg-[var(--primary)]/10 ring-[var(--primary)] " + meta.color
                        : "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <Icon size="1rem" />
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">{phaseMeta.description}</p>
          </FieldGroup>

          {(isCustomAgent || isNewCustomAgent) && (
            <FieldGroup
              label="Custom Agent Abilities"
              icon={<Sparkles size="0.875rem" className="text-[var(--primary)]" />}
              help="Opt-in powers for custom agents. Result formats and runtime handlers stay blocked until the matching ability is enabled."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CUSTOM_AGENT_CAPABILITY_META.map((capability) => {
                  const enabled = localCustomCapabilities[capability.id] === true;
                  return (
                    <EditorSwitchRow
                      key={capability.id}
                      label={capability.label}
                      description={capability.description}
                      checked={enabled}
                      onChange={() => toggleCustomCapability(capability.id)}
                    />
                  );
                })}
              </div>
            </FieldGroup>
          )}

          {(isCustomAgent || isNewCustomAgent) && (
            <FieldGroup
              label="Result Type"
              icon={<FileText size="0.875rem" className="text-[var(--primary)]" />}
              help="Controls how Marinara interprets this custom agent's output. Some result types require the matching ability toggle above."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CUSTOM_AGENT_RESULT_TYPE_OPTIONS.map((option) => {
                  const isActive = localResultType === option.id;
                  const isAllowed = resultTypeAllowedByCapabilities(option.id, localCustomCapabilities);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => {
                        if (!isAllowed) return;
                        setLocalResultType(option.id);
                        if (option.id === "text_rewrite") setLocalPhase("post_processing");
                        if (option.id === "prompt_patch") setLocalPhase("pre_generation");
                        markDirty();
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl p-3 text-left text-xs ring-1 transition-all",
                        isActive
                          ? "bg-[var(--primary)]/10 ring-[var(--primary)] text-[var(--foreground)]"
                          : isAllowed
                            ? "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                            : "cursor-not-allowed ring-[var(--border)] text-[var(--muted-foreground)] opacity-45",
                      )}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-[0.625rem] leading-tight">{option.description}</span>
                    </button>
                  );
                })}
              </div>
              {localResultType === "text_rewrite" && (
                <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[0.625rem] leading-relaxed text-amber-200">
                  Text rewrite agents always save as Post-Processing. Their prompt should return JSON like{" "}
                  <code className="rounded bg-black/20 px-1 py-0.5">
                    {'{"editedText":"...","changes":[{"description":"..."}]}'}
                  </code>
                  .
                </p>
              )}
            </FieldGroup>
          )}

          {showTurnDataAccess && (
            <FieldGroup
              label="Turn Data Access"
              icon={<Layers size="0.875rem" className="text-[var(--primary)]" />}
              help="Optional current-turn data for custom post-processing agents. Existing agents stay isolated unless these are enabled."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <EditorSwitchRow
                  label="Pre-generation injections"
                  checked={localIncludePreGenInjections}
                  onChange={() => {
                    setLocalIncludePreGenInjections((value) => !value);
                    markDirty();
                  }}
                  description="Current-turn context injected before the reply."
                />
                <EditorSwitchRow
                  label="Parallel agent results"
                  checked={localIncludeParallelResults}
                  onChange={() => {
                    setLocalIncludeParallelResults((value) => !value);
                    markDirty();
                  }}
                  description="Results from agents that ran alongside the reply."
                />
              </div>
            </FieldGroup>
          )}

          {(isCustomAgent || isNewCustomAgent) && (
            <FieldGroup
              label="Lorebook Writer"
              icon={<BookOpen size="0.875rem" className="text-amber-400" />}
              help="Lets this custom agent call a function that creates or updates entries in one selected lorebook."
            >
              <div className="space-y-3">
                <EditorSwitchRow
                  label="Allow lorebook entry writes"
                  checked={localLorebookWriteEnabled}
                  disabled={localCustomCapabilities.edit_lorebooks !== true}
                  onChange={() => {
                    if (localCustomCapabilities.edit_lorebooks !== true) return;
                    setLocalLorebookWriteEnabled((value) => !value);
                    markDirty();
                  }}
                  description={
                    localCustomCapabilities.edit_lorebooks === true
                      ? "The agent can only write to the lorebook selected below."
                      : "Enable Edit lorebooks above before selecting a target."
                  }
                />

                <div className="space-y-1.5">
                  <p className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Target lorebook</p>
                  {allLorebooks && allLorebooks.length > 0 ? (
                    <select
                      value={localWritableLorebookId}
                      disabled={!localLorebookWriteEnabled || localCustomCapabilities.edit_lorebooks !== true}
                      onChange={(event) => {
                        setLocalWritableLorebookId(event.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="">Select a lorebook</option>
                      {allLorebooks.map((lorebook) => (
                        <option key={lorebook.id} value={lorebook.id}>
                          {lorebook.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[0.625rem] text-amber-200">
                      Create a lorebook before enabling writes for this agent.
                    </p>
                  )}
                </div>
              </div>
            </FieldGroup>
          )}

          {/* ── Connection Override ── */}
          <FieldGroup
            label="Connection Override"
            icon={<Link2 size="0.875rem" className="text-[var(--primary)]" />}
            help="Use a different AI connection for this agent. For example, use a faster/cheaper model for background processing tasks."
          >
            <select
              value={localConnectionId}
              onChange={(e) => {
                setLocalConnectionId(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">
                {defaultAgentConn ? `Agent default (${defaultAgentConn.name})` : "Use chat connection"}
              </option>
              {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                <option value={LOCAL_SIDECAR_CONNECTION_ID}>Local Model (sidecar)</option>
              )}
              {llmConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.provider})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {localConnectionId === LOCAL_SIDECAR_CONNECTION_ID
                ? "Uses the built-in Local Model from the Connections panel. The sidecar will start on demand when this agent runs."
                : "When empty, uses the agent default connection if one is set, otherwise falls back to the chat's active connection."}
            </p>
          </FieldGroup>

          {/* ── Image Generation Connection (Illustrator only) ── */}
          {(agentDetailId === "illustrator" || dbConfig?.type === "illustrator") && (
            <FieldGroup
              label="Image Generation Connection Override"
              icon={<ImageIcon size="0.875rem" className="text-[var(--primary)]" />}
              help="The connection used to generate images. This should point to an image generation API (e.g. DALL-E, NovelAI, Stable Diffusion). The Connection Override above is used for the LLM that decides when and what to illustrate. Leave this empty to use the default Illustrator image connection from Settings → Connections."
            >
              <select
                value={localImageConnectionId}
                onChange={(e) => {
                  setLocalImageConnectionId(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">
                  {defaultAgentImageConn
                    ? `Illustrator agent default (${defaultAgentImageConn.name})`
                    : "None (no image generation)"}
                </option>
                {imageConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.provider})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                The Illustrator uses two connections: the LLM above analyzes the scene and writes an image prompt, then
                this connection generates the actual image from that prompt. Leave this empty to use the default
                Illustrator image connection from Settings → Connections, if one is configured.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Positive prompt / tags
                  </span>
                  <MacroTextarea
                    value={localImagePositivePrompt}
                    onChange={(value) => {
                      setLocalImagePositivePrompt(value);
                      markDirty();
                    }}
                    placeholder="masterpiece, best quality, detailed lighting"
                    rows={3}
                    title="Positive prompt / tags"
                    className="min-h-[5rem] resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Negative prompt</span>
                  <MacroTextarea
                    value={localImageNegativePrompt}
                    onChange={(value) => {
                      setLocalImageNegativePrompt(value);
                      markDirty();
                    }}
                    placeholder="lowres, bad anatomy, text artifacts"
                    rows={3}
                    title="Negative prompt"
                    className="min-h-[5rem] resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50"
                  />
                </div>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Saved on the Illustrator agent. Positive tags are appended after the generated prompt; negative tags are
                sent directly to the image generator and combine with any connection-level defaults. NovelAI tag syntax
                is supported.
              </p>
              <div className="mt-3 grid gap-2">
                <EditorSwitchRow
                  label="Send matching character and persona avatars as reference images"
                  checked={localUseAvatarReferences}
                  onChange={(checked) => {
                    setLocalUseAvatarReferences(checked);
                    markDirty();
                  }}
                  description="Sends references only for characters or persona names matched in the Illustrator request. Works best with providers that support reference images."
                />
                <EditorSwitchRow
                  label="Attach matching character appearance descriptions to image prompts"
                  checked={localIncludeCharacterAppearance}
                  onChange={(checked) => {
                    setLocalIncludeCharacterAppearance(checked);
                    markDirty();
                  }}
                  description="Adds only matched visible names as lines like Name's Appearance: card appearance. Characters can be found from the full character database."
                />
              </div>
            </FieldGroup>
          )}

          {/* ── NPC Avatar Generation (Character Tracker only) ── */}
          {(agentDetailId === "character-tracker" || dbConfig?.type === "character-tracker") && (
            <FieldGroup
              label="Auto-Generate NPC Avatars"
              icon={<Sparkles size="0.875rem" className="text-[var(--primary)]" />}
              help="When enabled, the Character Tracker will automatically generate portrait images for NPCs that don't have an avatar, using their appearance description."
            >
              <EditorSwitchRow
                label="Generate avatar portraits for new NPCs"
                checked={localAutoGenerateAvatars}
                onChange={(checked) => {
                  setLocalAutoGenerateAvatars(checked);
                  markDirty();
                }}
              />
              {localAutoGenerateAvatars && (
                <div className="mt-2">
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                    Image Generation Connection
                  </label>
                  <select
                    value={localImageConnectionId}
                    onChange={(e) => {
                      setLocalImageConnectionId(e.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="">None (select a connection)</option>
                    {imageConnections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.name} ({conn.provider})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </FieldGroup>
          )}

          {/* ── Missing Background Generation (Background agent only) ── */}
          {isBackgroundAgent && (
            <FieldGroup
              label="Background Image Generation"
              icon={<ImageIcon size="0.875rem" className="text-[var(--primary)]" />}
              help="When enabled, the Background agent can generate a new reusable roleplay background when none of your existing backgrounds fit the scene."
            >
              <EditorSwitchRow
                label={localAutoGenerateBackgrounds ? "Generate missing backgrounds" : "Only pick existing backgrounds"}
                checked={localAutoGenerateBackgrounds}
                onChange={() => {
                  setLocalAutoGenerateBackgrounds(!localAutoGenerateBackgrounds);
                  markDirty();
                }}
                description={
                  localAutoGenerateBackgrounds
                    ? "If nothing fits a changed location, the agent can request a new background image."
                    : "The agent will choose the closest uploaded background and never create a new one."
                }
                labelClassName="text-sm"
              />

              {localAutoGenerateBackgrounds && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                      Image Generation Connection
                    </label>
                    <select
                      value={localImageConnectionId}
                      onChange={(e) => {
                        setLocalImageConnectionId(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="">
                        {defaultAgentImageConn
                          ? `Agent image default (${defaultAgentImageConn.name})`
                          : "None (select a connection)"}
                      </option>
                      {imageConnections.map((conn) => (
                        <option key={conn.id} value={conn.id}>
                          {conn.name} ({conn.provider})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Generated images are saved into your normal Backgrounds library, so later runs can reuse them
                    instead of regenerating the same place.
                  </p>
                  {!localImageConnectionId && !defaultAgentImageConn && (
                    <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[0.625rem] text-amber-300">
                      Add an image generation connection here or mark one as the default for Illustrator in Connections.
                    </p>
                  )}
                </div>
              )}
            </FieldGroup>
          )}

          <FieldGroup
            label="Agent Budget"
            icon={<Clock size="0.875rem" className="text-[var(--primary)]" />}
            help="Controls how much recent chat context the agent reads and how much output room it reserves. If max output is too high for the model context, prompt context can be trimmed."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  Context Size
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={localContextSize}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalContextSize(v === "" ? "" : Math.max(1, Math.min(200, parseInt(v) || 1)));
                      markDirty();
                    }}
                    placeholder={String(DEFAULT_AGENT_CONTEXT_SIZE)}
                    className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  Max Output Tokens
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={MIN_AGENT_MAX_TOKENS}
                    value={localMaxTokens}
                    onChange={(e) => {
                      setLocalMaxTokens(normalizeAgentMaxTokensInput(e.target.value));
                      markDirty();
                    }}
                    onBlur={() => {
                      if (localMaxTokens !== "") {
                        setLocalMaxTokens(clampAgentMaxTokens(localMaxTokens));
                      }
                    }}
                    placeholder={String(DEFAULT_AGENT_MAX_TOKENS)}
                    className="w-32 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <span className="text-[0.6875rem] text-[var(--muted-foreground)]">tokens</span>
                </div>
              </div>
            </div>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              Each agent only sees its own context size. When agents are batched together (same model), the highest
              context size in the batch is used and output budgets are combined.
            </p>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              For 8k local models, try {DEFAULT_AGENT_MAX_TOKENS.toLocaleString()} or lower so the agent prompt keeps
              enough room.
            </p>
          </FieldGroup>

          {isProseGuardianAgent && (
            <FieldGroup
              label="Prose Guardian Defaults"
              icon={<Shield size="0.875rem" className="text-[var(--primary)]" />}
              help="These values fill the Prose Guardian prompt macros. Chat settings can override them for one chat."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Banned Words {"{{banned}}"}
                  </span>
                  <textarea
                    value={localProseGuardianBanned}
                    onChange={(e) => {
                      setLocalProseGuardianBanned(e.target.value);
                      markDirty();
                    }}
                    placeholder={DEFAULT_PROSE_GUARDIAN_BANNED_WORDS}
                    rows={3}
                    className="min-h-[5.5rem] resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Prefer In Writing {"{{prefer}}"}
                  </span>
                  <textarea
                    value={localProseGuardianPrefer}
                    onChange={(e) => {
                      setLocalProseGuardianPrefer(e.target.value);
                      markDirty();
                    }}
                    placeholder="Optional style notes, phrases, or authorial preferences."
                    rows={3}
                    className="min-h-[5.5rem] resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>
              </div>
              <label className="mt-3 flex flex-col gap-1.5">
                <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  Remove From Writing {"{{avoid}}"}
                </span>
                <textarea
                  value={localProseGuardianAvoid}
                  onChange={(e) => {
                    setLocalProseGuardianAvoid(e.target.value);
                    markDirty();
                  }}
                  placeholder={DEFAULT_PROSE_GUARDIAN_AVOID}
                  rows={4}
                  className="min-h-[6.5rem] resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
              <EditorSwitchRow
                label="Hold message until rewrite"
                checked={localProseGuardianHoldForRewrite}
                onChange={() => {
                  setLocalProseGuardianHoldForRewrite((value) => !value);
                  markDirty();
                }}
                description={
                  localProseGuardianHoldForRewrite
                    ? "Show the working state, then reveal the rewritten message."
                    : "Show the original response first, then replace it if Prose Guardian edits it."
                }
                className="mt-3"
              />
            </FieldGroup>
          )}

          {isContinuityAgent && (
            <FieldGroup
              label="Continuity Checker Defaults"
              icon={<ShieldCheck size="0.875rem" className="text-[var(--primary)]" />}
              help="Choose whether Continuity Checker should hold the raw response until its rewrite pass finishes. Chat settings can override this for one chat."
            >
              <EditorSwitchRow
                label="Hold message until rewrite"
                checked={localProseGuardianHoldForRewrite}
                onChange={() => {
                  setLocalProseGuardianHoldForRewrite((value) => !value);
                  markDirty();
                }}
                description={
                  localProseGuardianHoldForRewrite
                    ? "Show the working state, then reveal the continuity-checked message."
                    : "Show the original response first, then replace it if Continuity Checker edits it."
                }
              />
            </FieldGroup>
          )}

          {/* ── Triggers After (Chat Summary agent) ── */}
          {(isCustomAgent || isNewCustomAgent) && customRunIntervalMeta && (
            <FieldGroup
              label={customRunIntervalMeta.label}
              icon={<Clock size="0.875rem" className="text-[var(--primary)]" />}
              help={customRunIntervalMeta.help}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-28">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      customCadenceInputFocused ? String(localRunInterval) : getCadenceInputValue(localRunInterval)
                    }
                    onFocus={(e) => {
                      setCustomCadenceInputFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => setCustomCadenceInputFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      const delta = e.key === "ArrowUp" ? 1 : -1;
                      setLocalRunInterval(stepCadenceValue(localRunInterval, delta, customRunIntervalMeta.max));
                      markDirty();
                    }}
                    onChange={(e) => {
                      setLocalRunInterval(parseOptionalCadenceInputValue(e.target.value, customRunIntervalMeta.max));
                      markDirty();
                    }}
                    className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 pr-8 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md">
                    <button
                      type="button"
                      aria-label="Increase trigger cadence"
                      onClick={() => {
                        setLocalRunInterval(stepCadenceValue(localRunInterval, 1, customRunIntervalMeta.max));
                        markDirty();
                      }}
                      className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <ChevronUp size="0.6875rem" />
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease trigger cadence"
                      onClick={() => {
                        setLocalRunInterval(stepCadenceValue(localRunInterval, -1, customRunIntervalMeta.max));
                        markDirty();
                      }}
                      className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <ChevronDown size="0.6875rem" />
                    </button>
                  </div>
                </div>
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{customRunIntervalMeta.unit}</span>
              </div>
            </FieldGroup>
          )}

          {(isCustomAgent || isNewCustomAgent) && (
            <FieldGroup
              label="Activation Keywords"
              icon={<Activity size="0.875rem" className="text-[var(--primary)]" />}
              help="When keywords are set, this custom agent is skipped unless at least one keyword appears in the recent chat messages it scans."
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Keywords
                  </label>
                  <textarea
                    value={localActivationKeywordsText}
                    onChange={(e) => {
                      setLocalActivationKeywordsText(e.target.value);
                      markDirty();
                    }}
                    placeholder={"tavern\nsecret door\nmoonlit ritual"}
                    rows={4}
                    className="w-full resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Scan Depth
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH}
                      value={localActivationScanDepth}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocalActivationScanDepth(
                          v === ""
                            ? ""
                            : Math.max(1, Math.min(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH, parseInt(v, 10) || 1)),
                        );
                        markDirty();
                      }}
                      placeholder={String(DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH)}
                      className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Leave keywords empty to run this custom agent on its normal cadence.
              </p>
            </FieldGroup>
          )}

          {/* ── Run Interval (Lorebook Keeper) ── */}
          {isLorebookKeeperAgent && (
            <FieldGroup
              label="Run Interval"
              icon={<Clock size="0.875rem" className="text-[var(--primary)]" />}
              help="How many assistant messages between each Lorebook Keeper run. Higher values reduce duplicates and save tokens. Set to 1 to run every message."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={localRunInterval}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalRunInterval(v === "" ? "" : Math.max(1, Math.min(100, parseInt(v) || 1)));
                    markDirty();
                  }}
                  placeholder="8"
                  className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                The chat/roleplay keeper runs once every N assistant messages instead of every response. Default: 8.
                Game Mode uses a separate session-end Lorebook Keeper with different instructions.
              </p>
            </FieldGroup>
          )}

          {/* ── Run Interval (Card Evolution Auditor) ── */}
          {isCardEvolutionAuditorAgent && (
            <FieldGroup
              label="Run Interval"
              icon={<FileText size="0.875rem" className="text-[var(--primary)]" />}
              help="How many assistant messages between Card Evolution Auditor checks. Higher values keep card review conservative and cheaper."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={localRunInterval}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalRunInterval(v === "" ? "" : Math.max(1, Math.min(100, parseInt(v) || 1)));
                    markDirty();
                  }}
                  placeholder="8"
                  className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                The auditor proposes character card changes for manual approval only. It never applies edits by itself.
              </p>
            </FieldGroup>
          )}

          {isDirectorAgent && (
            <FieldGroup
              label="Story Push Mode"
              icon={<Shuffle size="0.875rem" className="text-[var(--primary)]" />}
              help="Choose what Push Story should ask the Narrative Director to create when you arm it in chat."
            >
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-1">
                {[
                  {
                    id: "natural" as const,
                    label: "Natural",
                    description: "Advance existing tension, goals, or scenario threads.",
                  },
                  {
                    id: "random" as const,
                    label: "Random Event",
                    description: "Introduce a plausible surprise, complication, or opportunity.",
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLocalDirectorMode(option.id);
                      markDirty();
                    }}
                    className={cn(
                      "rounded-lg px-3 py-2 text-left transition-all",
                      localDirectorMode === option.id
                        ? "bg-[var(--primary)]/15 text-[var(--foreground)] ring-1 ring-[var(--primary)]/40"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className="block text-xs font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[0.625rem] leading-snug">{option.description}</span>
                  </button>
                ))}
              </div>
            </FieldGroup>
          )}

          {isDirectorAgent && (
            <FieldGroup
              label="Secret Plot"
              icon={<Sparkles size="0.875rem" className="text-[var(--primary)]" />}
              help="Default hidden arc maintenance for Roleplay chats that use Narrative Director."
            >
              <EditorSwitchRow
                label="Maintain hidden arc"
                checked={localSecretPlotEnabled}
                onChange={() => {
                  setLocalSecretPlotEnabled((value) => !value);
                  markDirty();
                }}
                description="Store and inject a spoilered long-term arc for Roleplay chats."
              />
              {localSecretPlotEnabled && (
                <div className="mt-3">
                  <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    Run Interval
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={localSecretPlotRunInterval}
                      onChange={(event) => {
                        setLocalSecretPlotRunInterval(
                          normalizePositiveInteger(event.target.value, localSecretPlotRunInterval, 100),
                        );
                        markDirty();
                      }}
                      className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">assistant messages</span>
                  </div>
                </div>
              )}
            </FieldGroup>
          )}

          {/* ── Run Interval (Illustrator) ── */}
          {isIllustratorAgent && (
            <FieldGroup
              label="Run Interval"
              icon={<Clock size="0.875rem" className="text-[var(--primary)]" />}
              help="How many assistant messages between allowed Illustrator image generations. Set to 1 to allow it every message."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={localRunInterval}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalRunInterval(v === "" ? "" : Math.max(1, Math.min(100, parseInt(v) || 1)));
                    markDirty();
                  }}
                  placeholder="5"
                  className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">messages</span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                The Illustrator can only create a new image once every N assistant messages. If it decides not to draw,
                the timer does not reset. Default: 5.
              </p>
            </FieldGroup>
          )}

          {/* ── Inject as Prompt Section ── */}
          {!isDirectorAgent && (
            <FieldGroup
              label="Add as Prompt Section"
              icon={<Layers size="0.875rem" className="text-[var(--primary)]" />}
              help="When enabled, this agent's output becomes available as a marker section in prompt presets. Add the section in your preset to inject the agent's latest data into the prompt."
            >
              <EditorSwitchRow
                label={localInjectAsSection ? "Enabled" : "Disabled"}
                checked={localInjectAsSection}
                onChange={() => {
                  setLocalInjectAsSection(!localInjectAsSection);
                  markDirty();
                }}
                description={
                  localInjectAsSection
                    ? `"${localName}" appears as a section option in prompt presets`
                    : "Agent output is not injected into prompts"
                }
                labelClassName="text-sm"
              />
            </FieldGroup>
          )}

          {isMusicAgent && (
            <FieldGroup
              label="Music Player"
              icon={<Music size="0.875rem" className="text-[var(--muted-foreground)]" />}
              help="Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."
            >
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {(["spotify", "youtube", "custom"] as const).map((provider) => {
                    const active = localMusicProvider === provider;
                    const label = provider === "spotify" ? "Spotify" : provider === "youtube" ? "YouTube" : "Custom";
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => handleMusicProviderChange(provider)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs font-medium transition-all",
                          active
                            ? "bg-white/12 text-white shadow-sm"
                            : "text-white/45 hover:bg-white/8 hover:text-white/75",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[0.625rem] text-white/40">
                  Visible player:{" "}
                  {musicPlayerSource === "spotify" ? "Spotify" : musicPlayerSource === "youtube" ? "YouTube" : "Custom"}
                  . Saved provider:{" "}
                  {localMusicProvider === "spotify"
                    ? "Spotify"
                    : localMusicProvider === "youtube"
                      ? "YouTube"
                      : "Custom"}
                  .
                </p>
              </div>
            </FieldGroup>
          )}

          {/* ── Spotify Settings (only shown for Spotify agent) ── */}
          {isMusicAgent && (
            <FieldGroup
              label="Spotify Connection"
              icon={<Music size="0.875rem" className="text-green-400" />}
              help="Connect your Spotify account to let this agent control playback."
            >
              <div className="space-y-3">
                {/* Client ID input */}
                <div>
                  <label className="block text-[0.6875rem] font-medium text-white/60 mb-1">Spotify Client ID</label>
                  <input
                    type="text"
                    value={localSpotifyClientId}
                    onChange={(e) => {
                      setLocalSpotifyClientId(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Paste your Spotify app Client ID..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 font-mono"
                  />
                </div>

                {/* Connection status & buttons */}
                {spotifyStatus?.connected ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400">
                      <Check size="0.75rem" />
                      {spotifyStatus.expired ? "Connected (token expired — will auto-refresh)" : "Connected to Spotify"}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dbConfig?.id) return;
                        await fetch("/api/spotify/disconnect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agentId: dbConfig.id }),
                        });
                        setSpotifyStatus({
                          connected: false,
                          expired: false,
                          redirectUri: spotifyStatus?.redirectUri ?? null,
                        });
                        // Strip tokens from the cached agent row synchronously
                        // so a Save click racing with the pending refetch can't
                        // resurrect them via handleSave's preservation path.
                        qc.setQueryData<AgentConfigRow[] | undefined>(agentKeys.all, (rows) =>
                          rows?.map((row) => {
                            if (row.id !== dbConfig.id) return row;
                            const parsed: Record<string, unknown> =
                              typeof row.settings === "string"
                                ? JSON.parse(row.settings)
                                : ((row.settings as unknown as Record<string, unknown>) ?? {});
                            const {
                              spotifyAccessToken: _a,
                              spotifyRefreshToken: _b,
                              spotifyExpiresAt: _c,
                              spotifyScope: _d,
                              ...rest
                            } = parsed;
                            return { ...row, settings: JSON.stringify(rest) };
                          }),
                        );
                        await qc.invalidateQueries({ queryKey: agentKeys.all });
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!localSpotifyClientId.trim() || !dbConfig?.id || spotifyConnecting}
                    onClick={async () => {
                      if (!localSpotifyClientId.trim() || !dbConfig?.id) return;
                      setSpotifyConnecting(true);
                      setSpotifyConnectError(null);
                      try {
                        // Save clientId first if dirty
                        if (dirty) {
                          await updateAgent.mutateAsync({
                            id: dbConfig.id,
                            settings: {
                              ...(dbConfig.settings
                                ? typeof dbConfig.settings === "string"
                                  ? JSON.parse(dbConfig.settings as string)
                                  : dbConfig.settings
                                : {}),
                              spotifyClientId: localSpotifyClientId,
                            },
                          });
                        }
                        const res = await fetch(
                          `/api/spotify/authorize?${new URLSearchParams({
                            clientId: localSpotifyClientId,
                            agentId: dbConfig.id,
                          })}`,
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data.authUrl) {
                          throw new Error(data.error ?? `Authorize request failed (${res.status})`);
                        }
                        window.open(data.authUrl, "_blank", "width=500,height=700");
                        // Clear any existing poll before starting a new one
                        if (spotifyPollRef.current) clearInterval(spotifyPollRef.current);
                        if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current);
                        // Poll for connection status
                        spotifyPollRef.current = setInterval(async () => {
                          try {
                            const statusRes = await fetch(
                              `/api/spotify/status?agentId=${encodeURIComponent(dbConfig.id)}`,
                            );
                            const status = await statusRes.json();
                            if (status.connected) {
                              clearInterval(spotifyPollRef.current!);
                              spotifyPollRef.current = null;
                              if (spotifyTimeoutRef.current) {
                                clearTimeout(spotifyTimeoutRef.current);
                                spotifyTimeoutRef.current = null;
                              }
                              setSpotifyStatus({
                                connected: true,
                                expired: false,
                                redirectUri: status.redirectUri ?? null,
                              });
                              setSpotifyConnecting(false);
                              setSpotifyPasteOpen(false);
                              setSpotifyPasteValue("");
                              setSpotifyPasteError(null);
                              // Refetch so the cached settings include the new
                              // tokens before any subsequent handleSave runs.
                              await qc.invalidateQueries({ queryKey: agentKeys.all });
                            }
                          } catch {
                            // keep polling
                          }
                        }, 2000);
                        // Stop polling after the server-side pendingAuth TTL
                        spotifyTimeoutRef.current = setTimeout(() => {
                          if (spotifyPollRef.current) {
                            clearInterval(spotifyPollRef.current);
                            spotifyPollRef.current = null;
                          }
                          spotifyTimeoutRef.current = null;
                          setSpotifyConnecting(false);
                        }, 10 * 60_000);
                      } catch (err) {
                        setSpotifyConnectError(err instanceof Error ? err.message : "Failed to start Spotify auth");
                        setSpotifyConnecting(false);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition-all",
                      localSpotifyClientId.trim() && dbConfig?.id
                        ? "bg-[#1DB954] text-white hover:bg-[#1ed760] active:scale-95"
                        : "bg-white/5 text-white/30 cursor-not-allowed",
                    )}
                  >
                    <Music size="0.875rem" />
                    {spotifyConnecting ? "Waiting for authorization..." : "Connect Spotify Account"}
                  </button>
                )}

                {spotifyConnectError && !spotifyStatus?.connected && (
                  <p className="text-[0.6875rem] text-red-400/80">{spotifyConnectError}</p>
                )}

                {/* Paste-back fallback for installs where the browser can't reach the loopback callback. */}
                {spotifyConnecting && !spotifyStatus?.connected && dbConfig?.id && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[0.6875rem] text-white/50 space-y-2">
                    <button
                      type="button"
                      onClick={() => setSpotifyPasteOpen((v) => !v)}
                      className="text-white/60 hover:text-white/80 transition-colors text-left w-full"
                    >
                      {spotifyPasteOpen ? "▾" : "▸"} Browser couldn&apos;t reach the callback?
                    </button>
                    {spotifyPasteOpen && (
                      <div className="space-y-2 pt-1">
                        <p className="text-white/40 leading-relaxed">
                          If you&apos;re running Marinara on a different machine, the popup probably failed to load
                          (Spotify only allows <code className="text-white/50">127.0.0.1</code> or HTTPS callbacks).
                          Copy the full URL from the popup&apos;s address bar and paste it here:
                        </p>
                        <textarea
                          value={spotifyPasteValue}
                          onChange={(e) => {
                            setSpotifyPasteValue(e.target.value);
                            setSpotifyPasteError(null);
                          }}
                          rows={3}
                          placeholder="http://127.0.0.1:7860/api/spotify/callback?code=...&state=..."
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.6875rem] text-white placeholder-white/20 outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 font-mono"
                        />
                        {spotifyPasteError && <p className="text-red-400/80 text-[0.625rem]">{spotifyPasteError}</p>}
                        <button
                          type="button"
                          disabled={!spotifyPasteValue.trim() || spotifyPasteSubmitting}
                          onClick={async () => {
                            if (!dbConfig?.id || !spotifyPasteValue.trim()) return;
                            setSpotifyPasteSubmitting(true);
                            setSpotifyPasteError(null);
                            try {
                              const res = await fetch("/api/spotify/exchange", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ callbackUrl: spotifyPasteValue.trim() }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok || !data.success) {
                                setSpotifyPasteError(data.error ?? `Request failed (${res.status})`);
                              } else {
                                if (spotifyPollRef.current) {
                                  clearInterval(spotifyPollRef.current);
                                  spotifyPollRef.current = null;
                                }
                                if (spotifyTimeoutRef.current) {
                                  clearTimeout(spotifyTimeoutRef.current);
                                  spotifyTimeoutRef.current = null;
                                }
                                const statusRes = await fetch(
                                  `/api/spotify/status?agentId=${encodeURIComponent(dbConfig.id)}`,
                                );
                                const status = await statusRes.json().catch(() => null);
                                setSpotifyStatus({
                                  connected: status?.connected ?? true,
                                  expired: status?.expired ?? false,
                                  redirectUri: status?.redirectUri ?? null,
                                });
                                setSpotifyConnecting(false);
                                setSpotifyPasteOpen(false);
                                setSpotifyPasteValue("");
                                // Refetch so the cached settings include the
                                // new tokens before any subsequent handleSave.
                                await qc.invalidateQueries({ queryKey: agentKeys.all });
                              }
                            } catch (err) {
                              setSpotifyPasteError(err instanceof Error ? err.message : "Submission failed");
                            } finally {
                              setSpotifyPasteSubmitting(false);
                            }
                          }}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-[0.6875rem] font-medium transition-all",
                            spotifyPasteValue.trim() && !spotifyPasteSubmitting
                              ? "bg-[#1DB954] text-white hover:bg-[#1ed760] active:scale-95"
                              : "bg-white/5 text-white/30 cursor-not-allowed",
                          )}
                        >
                          {spotifyPasteSubmitting ? "Submitting..." : "Complete connection"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Setup instructions */}
                <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3 text-[0.6875rem] text-white/50 space-y-2">
                  <p className="font-medium text-green-400/80">Setup:</p>
                  <ol className="list-decimal list-inside space-y-1 text-white/40">
                    <li>
                      Go to the{" "}
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Spotify Developer Dashboard <ExternalLink size="0.5625rem" />
                      </a>
                    </li>
                    <li>Create a new app — select &quot;Web API&quot;</li>
                    <li>
                      In Redirect URIs, add:{" "}
                      <code className="text-white/50 select-all">
                        {spotifyStatus?.redirectUri ?? getDisplayedSpotifyRedirectUri()}
                      </code>
                    </li>
                    <li>
                      Copy the <strong>Client ID</strong> and paste it above
                    </li>
                    <li>
                      Save the agent, then click <strong>Connect Spotify Account</strong>
                    </li>
                  </ol>
                  <p className="text-[0.625rem] text-white/30 mt-1">
                    Requires Spotify Premium. Tokens refresh automatically — no need to reconnect.
                  </p>
                  <p className="text-[0.625rem] text-white/30 leading-relaxed">
                    Spotify only accepts <code className="text-white/40">https://</code> redirect URIs or loopback (
                    <code className="text-white/40">http://127.0.0.1</code>). If you&apos;re running Marinara on another
                    machine over plain HTTP, register the loopback URI anyway and use the paste-back fallback that
                    appears under the Connect button — or set{" "}
                    <code className="text-white/40">SPOTIFY_REDIRECT_URI</code> to your HTTPS URL.
                  </p>
                </div>
              </div>
            </FieldGroup>
          )}

          {/* ── YouTube Settings (shown for Music DJ and legacy YouTube agent) ── */}
          {showsYoutubeSettings && (
            <FieldGroup
              label="YouTube Connection"
              icon={<Music size="0.875rem" className="text-red-400" />}
              help="Plays mood-matched music from YouTube in an embedded in-app player. Needs a free YouTube Data API key — no Premium, no account login."
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-[0.6875rem] font-medium text-white/60 mb-1">YouTube Data API Key</label>
                  <input
                    type="password"
                    value={localYoutubeApiKey}
                    onChange={(e) => {
                      setLocalYoutubeApiKey(e.target.value);
                      setYoutubeError(null);
                    }}
                    placeholder={
                      youtubeConfigured
                        ? "•••••••• key configured — paste a new one to replace"
                        : "Paste your YouTube Data API key (AIza…)"
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 font-mono"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={youtubeSaving || !localYoutubeApiKey.trim()}
                    onClick={async () => {
                      setYoutubeSaving(true);
                      setYoutubeError(null);
                      try {
                        // agentId is optional — the server creates the built-in Music DJ
                        // config if it doesn't exist yet, so the user never has to hit the
                        // top-right Save first.
                        const res = await fetch("/api/youtube/save-key", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agentId: dbConfig?.id, apiKey: localYoutubeApiKey.trim() }),
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          throw new Error(data.error ?? `Save failed (${res.status})`);
                        }
                        setYoutubeConfigured(true);
                        setLocalYoutubeApiKey("");
                        // Refresh the agent list so dbConfig (the new/updated config row) populates.
                        qc.invalidateQueries({ queryKey: agentKeys.all });
                      } catch (err) {
                        setYoutubeError(err instanceof Error ? err.message : "Save failed");
                      } finally {
                        setYoutubeSaving(false);
                      }
                    }}
                    className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {youtubeSaving ? "Saving…" : youtubeConfigured ? "Update Key" : "Save Key"}
                  </button>

                  {youtubeConfigured && (
                    <>
                      <span className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400">
                        <Check size="0.75rem" />
                        API key configured
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!dbConfig?.id) return;
                          await fetch("/api/youtube/disconnect", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ agentId: dbConfig.id }),
                          });
                          setYoutubeConfigured(false);
                        }}
                        className="text-xs text-white/50 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>

                {youtubeError && <p className="text-[0.6875rem] text-red-400">{youtubeError}</p>}

                <div className="rounded-lg bg-white/5 p-3 text-[0.6875rem] text-white/50 leading-relaxed">
                  <p className="mb-1 font-medium text-white/60">How to get a free key:</p>
                  <ol className="ml-4 list-decimal space-y-1">
                    <li>
                      Open the{" "}
                      <a
                        href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Google Cloud Console <ExternalLink size="0.5625rem" />
                      </a>{" "}
                      and create (or pick) a project.
                    </li>
                    <li>
                      Enable the <strong>YouTube Data API v3</strong>.
                    </li>
                    <li>
                      Go to <strong>Credentials → Create credentials → API key</strong>, then paste it above.
                    </li>
                    <li>
                      Leave the key <strong>unrestricted</strong>, or restrict it only by <em>API</em> (YouTube Data API
                      v3) — not by HTTP referrer. Search runs server-side, so a referrer restriction would block it.
                    </li>
                  </ol>
                  <p className="mt-1 text-[0.625rem] text-white/30">
                    The free quota (~100 searches/day) is plenty for a personal DJ. Enable the agent, then it picks
                    music as the scene&apos;s mood shifts.
                  </p>
                </div>
              </div>
            </FieldGroup>
          )}

          {isMusicAgent && (
            <FieldGroup
              label="Custom Music Library"
              icon={<FolderOpen size="0.875rem" className="text-[var(--muted-foreground)]" />}
              help="Choose where the Custom Music DJ looks for local audio files."
            >
              <div className="space-y-3">
                <EditorSwitchRow
                  label="Use Game Assets music folder"
                  checked={localCustomMusicSource === "game-assets"}
                  onChange={(checked) => {
                    setLocalCustomMusicSource(checked ? "game-assets" : "folder");
                    setDirty(true);
                  }}
                  description={
                    localCustomMusicSource === "game-assets"
                      ? "Custom mode will search audio uploaded to Game Assets."
                      : "Custom mode will search the folder selected from this device."
                  }
                />

                {localCustomMusicSource === "game-assets" ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <label className="mb-1 block text-[0.6875rem] font-medium text-white/60">
                      Game Assets music folder
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={localCustomMusicFolder}
                        onChange={(event) => {
                          setLocalCustomMusicFolder(event.target.value);
                          setDirty(true);
                        }}
                        onBlur={() => setLocalCustomMusicFolder((current) => normalizeCustomMusicFolderInput(current))}
                        placeholder="music"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none placeholder-white/30 focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20"
                      />
                      <button
                        type="button"
                        onClick={handleOpenCustomMusicFolder}
                        className="mari-editor-action mari-editor-action--secondary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <ExternalLink size="0.8rem" />
                        Open Folder
                      </button>
                    </div>
                    <p className="mt-2 text-[0.625rem] leading-relaxed text-white/40">
                      Use <code>music</code> for the whole Game Assets music library, or a subfolder like{" "}
                      <code>music/combat</code>.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <label className="mb-1 block text-[0.6875rem] font-medium text-white/60">
                      Music folder on this device
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={localCustomMusicExternalFolder}
                        onChange={(event) => {
                          setLocalCustomMusicExternalFolder(event.target.value);
                          setDirty(true);
                        }}
                        onBlur={() =>
                          setLocalCustomMusicExternalFolder((current) => normalizeExternalMusicFolderInput(current))
                        }
                        placeholder="No folder selected"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none placeholder-white/30"
                      />
                      <button
                        type="button"
                        onClick={handleSelectCustomMusicFolder}
                        className="mari-editor-action mari-editor-action--secondary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <FolderOpen size="0.8rem" />
                        Select Folder
                      </button>
                    </div>
                    <p className="mt-2 text-[0.625rem] leading-relaxed text-white/40">
                      The folder picker opens on the device running Marinara&apos;s server. Custom mode will list and
                      play supported audio files from that folder. On devices without a folder picker, paste the path
                      here.
                    </p>
                  </div>
                )}
              </div>
            </FieldGroup>
          )}

          {/* ── Knowledge Source Lorebooks (Knowledge Retrieval + Knowledge Router) ── */}
          {(isKnowledgeRetrievalAgent || isKnowledgeRouterAgent) && (
            <FieldGroup
              label="Knowledge Sources"
              icon={<BookOpen size="0.875rem" className="text-amber-400" />}
              help={
                isKnowledgeRouterAgent
                  ? "Use chat-active lorebooks by default, or select fixed lorebooks for this agent to route over. The router picks relevant entries by id and injects them verbatim."
                  : "Use chat-active lorebooks by default, select fixed lorebooks, and/or upload files for this agent to scan. Supported file types: .txt, .md, .csv, .json, .xml, .html, .pdf"
              }
            >
              <div className="space-y-4">
                <EditorSwitchRow
                  label="Use this chat's active lorebooks"
                  checked={localUseChatActiveLorebooks}
                  onChange={() => {
                    setLocalUseChatActiveLorebooks((value) => !value);
                    markDirty();
                  }}
                  description="When no fixed source is selected below, this agent scans the lorebooks attached to the current chat."
                />
                {/* ── Lorebooks ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Fixed source override</p>
                    {/* Description coverage badge — Knowledge Router only.
                        Tells the user how many entries in their selected source lorebooks
                        have descriptions filled in. Routing precision drops sharply when
                        coverage is low because the router falls back to content snippets.
                        Hidden during loading and on fetch errors (showing partial data
                        from succeeded queries would silently mislead the user about
                        coverage). Distinguishes the zero-entries case from loading by
                        rendering an explicit "No entries yet" pill. */}
                    {isKnowledgeRouterAgent &&
                      descriptionCoverage &&
                      !routerEntriesLoading &&
                      !routerEntriesError &&
                      (descriptionCoverage.total === 0 ? (
                        <div className="flex items-center gap-1.5 text-[0.625rem]">
                          <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)] opacity-50" />
                          <span className="text-[var(--muted-foreground)]">No entries yet</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[0.625rem]">
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              descriptionCoverage.ratio >= 0.75
                                ? "bg-emerald-400"
                                : descriptionCoverage.ratio >= 0.25
                                  ? "bg-amber-400"
                                  : "bg-red-400",
                            )}
                          />
                          <span className="text-[var(--muted-foreground)]">
                            {Math.round(descriptionCoverage.ratio * 100)}% described
                            <span className="opacity-70">
                              {" "}
                              ({descriptionCoverage.withDescription}/{descriptionCoverage.total})
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                  {allLorebooks && allLorebooks.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-2">
                      {allLorebooks.map((lb) => {
                        const selected = localSourceLorebookIds.includes(lb.id);
                        return (
                          <button
                            key={lb.id}
                            type="button"
                            onClick={() => {
                              setLocalSourceLorebookIds((prev) =>
                                selected ? prev.filter((id) => id !== lb.id) : [...prev, lb.id],
                              );
                              setDirty(true);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-xs",
                              selected
                                ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                                : "bg-[var(--secondary)] border border-transparent text-[var(--foreground)] hover:bg-[var(--accent)]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                                selected
                                  ? "border-amber-500/50 bg-amber-500/20"
                                  : "border-[var(--border)] bg-[var(--background)]",
                              )}
                            >
                              {selected && <Check size="0.625rem" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{lb.name}</p>
                              {lb.description && (
                                <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                  {lb.description}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">No lorebooks available.</p>
                  )}
                  {localSourceLorebookIds.length > 0 && (
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      Fixed selections override chat-active lorebooks for every chat that uses this agent.
                    </p>
                  )}
                  {/* Router-only tip explaining the description fallback behavior.
                      Without this, users have no way to know that filling in entry
                      descriptions improves routing precision — the fallback to a
                      content snippet works invisibly. */}
                  {isKnowledgeRouterAgent && (localSourceLorebookIds.length > 0 || localUseChatActiveLorebooks) && (
                    <p className="text-[0.625rem] italic text-[var(--muted-foreground)]">
                      Tip: entry descriptions help Knowledge Router choose entries; descriptions are not triggers by
                      themselves. Entries without a description fall back to a short content snippet.
                    </p>
                  )}
                </div>

                {/* ── Uploaded Files (Knowledge Retrieval only) ── */}
                {isKnowledgeRetrievalAgent && (
                  <div className="space-y-1.5">
                    <p className="text-[0.6875rem] font-medium text-white/60">Files</p>
                    {/* File list */}
                    {allKnowledgeSources && allKnowledgeSources.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        {allKnowledgeSources.map((src) => {
                          const selected = localSourceFileIds.includes(src.id);
                          return (
                            <div
                              key={src.id}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
                                selected
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                                  : "bg-white/[0.02] border border-transparent text-white/60",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalSourceFileIds((prev) =>
                                    selected ? prev.filter((id) => id !== src.id) : [...prev, src.id],
                                  );
                                  setDirty(true);
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                              >
                                <div
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                                    selected ? "border-amber-500/50 bg-amber-500/20" : "border-white/20 bg-white/5",
                                  )}
                                >
                                  {selected && <Check size="0.625rem" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{src.originalName}</p>
                                  <p className="text-[0.625rem] text-white/40">{(src.size / 1024).toFixed(1)} KB</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteSource.mutate(src.id, {
                                    onSuccess: () => {
                                      setLocalSourceFileIds((prev) => prev.filter((id) => id !== src.id));
                                    },
                                  });
                                }}
                                className="shrink-0 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete file"
                              >
                                <Trash2 size="0.75rem" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Upload button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.tsv,.pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const uploaded = await uploadSource.mutateAsync(file);
                          setLocalSourceFileIds((prev) => [...prev, uploaded.id]);
                          setDirty(true);
                        } catch {
                          /* error handled by mutation */
                        }
                        // Reset so same file can be re-uploaded if needed
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadSource.isPending}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-medium transition-all w-full justify-center",
                        uploadSource.isPending
                          ? "border-white/10 text-white/30 cursor-wait"
                          : "border-white/15 text-white/50 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5",
                      )}
                    >
                      {uploadSource.isPending ? (
                        <>
                          <Loader2 size="0.875rem" className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size="0.875rem" />
                          Upload File
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Summary */}
                {(localSourceLorebookIds.length > 0 || localSourceFileIds.length > 0) && (
                  <p className="text-[0.625rem] text-white/40">
                    {[
                      localSourceLorebookIds.length > 0
                        ? `${localSourceLorebookIds.length} lorebook${localSourceLorebookIds.length !== 1 ? "s" : ""}`
                        : null,
                      localSourceFileIds.length > 0
                        ? `${localSourceFileIds.length} file${localSourceFileIds.length !== 1 ? "s" : ""}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    selected
                  </p>
                )}
              </div>
            </FieldGroup>
          )}

          {/* ── Prompt Template ── */}
          <FieldGroup
            label="Prompt Template"
            icon={<FileText size="0.875rem" className="text-[var(--primary)]" />}
            help="The system instructions this agent receives. Built-in agents have sensible defaults. You can override to customize behavior."
          >
            {/* Toolbar — only show default/override status for built-in agents */}
            {builtIn && (
              <div className="flex items-center gap-2 mb-2">
                {isUsingDefaultPrompt ? (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[0.625rem] font-medium text-emerald-400">
                    <Check size="0.625rem" /> Using built-in default
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-amber-400/10 px-2.5 py-1 text-[0.625rem] font-medium text-amber-400">
                    <FileText size="0.625rem" /> Custom override
                  </span>
                )}
                <div className="flex-1" />
                {!isUsingDefaultPrompt && (
                  <button
                    onClick={handleResetPrompt}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <RotateCcw size="0.625rem" /> Reset to default
                  </button>
                )}
                {isUsingDefaultPrompt && defaultPrompt && (
                  <button
                    onClick={handleLoadDefault}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <FileText size="0.625rem" /> Copy default to edit
                  </button>
                )}
              </div>
            )}

            {builtIn && isUsingDefaultPrompt ? (
              <div className="relative">
                <pre className="w-full max-h-[50vh] overflow-y-auto resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] text-[var(--muted-foreground)] whitespace-pre-wrap">
                  {defaultPrompt || "No default prompt."}
                </pre>
                <span className="absolute right-3 top-2 rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  Default — click "Copy default to edit" to customize
                </span>
              </div>
            ) : (
              <MacroTextarea
                value={localPrompt}
                onChange={(value) => {
                  setLocalPrompt(value);
                  markDirty();
                }}
                rows={16}
                title="Prompt Template"
                placeholder="Write the system prompt for this agent…"
                className="w-full resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] max-h-[60vh] overflow-y-auto"
              />
            )}
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {builtIn
                ? "Leave empty to use the built-in default prompt. Edit to override with your own instructions."
                : localResultType === "text_rewrite"
                  ? 'Write the full system prompt for this custom editor. It must return JSON with "editedText" and "changes".'
                  : "Write the full system prompt for this custom agent."}
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground)]">Named prompt options</p>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    Chats can pick one of these without changing the agent globally.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPromptTemplate}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                >
                  <Plus size="0.6875rem" />
                  Add option
                </button>
              </div>

              {localPromptTemplates.length === 0 ? (
                <p className="rounded-xl bg-[var(--secondary)]/60 px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  No named options yet. The chat menu will show only the default prompt.
                </p>
              ) : (
                <div className="space-y-3">
                  {localPromptTemplates.map((option, index) => (
                    <div
                      key={option.id}
                      className="rounded-xl bg-[var(--secondary)]/70 p-3 ring-1 ring-[var(--border)]"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] text-[0.6875rem] font-semibold text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                          {index + 1}
                        </span>
                        <input
                          value={option.name}
                          onChange={(e) => handleUpdatePromptTemplate(option.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                          placeholder="Option name"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePromptTemplate(option.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove prompt option"
                        >
                          <Trash2 size="0.75rem" />
                        </button>
                      </div>
                      <input
                        value={option.description ?? ""}
                        onChange={(e) => handleUpdatePromptTemplate(option.id, { description: e.target.value })}
                        className="mb-2 w-full rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Short description shown in Chat Settings"
                      />
                      <MacroTextarea
                        value={option.promptTemplate}
                        onChange={(value) => handleUpdatePromptTemplate(option.id, { promptTemplate: value })}
                        rows={7}
                        title={option.name ? `${option.name} Prompt` : `Prompt Option ${index + 1}`}
                        className="w-full resize-y rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Write the prompt template for this option…"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Default prompt preview removed — now shown inline above */}
          </FieldGroup>

          {/* ── Available Tools (Function Calling) ── */}
          <FieldGroup
            label="Tools / Function Calling"
            icon={<Wrench size="0.875rem" className="text-[var(--primary)]" />}
            help="Select which tools this agent can use during generation. The AI can call these functions and receive results back for multi-step interactions."
            collapsible
            expanded={toolsSectionOpen}
            onExpandedChange={setToolsSectionOpen}
            summary={
              musicDjYoutubeMode
                ? "Not used in YouTube mode"
                : `${selectedVisibleToolCount}/${availableVisibleToolCount} enabled`
            }
          >
            {musicDjYoutubeMode ? (
              <p className="rounded-xl bg-[var(--secondary)]/60 px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                In YouTube mode, Music DJ doesn't use function tools. It returns its pick as JSON and the app plays the
                top YouTube search result directly. Switch the Music Player to Spotify to enable playback tools.
              </p>
            ) : (
              <>
                <p className="text-[0.625rem] text-[var(--muted-foreground)] mb-3">
                  Toggle tools on or off for this agent. When enabled for a chat, only selected tools will be available
                  during generation.
                </p>
                <div className="space-y-2">
                  {visibleBuiltInTools.map((tool: ToolDefinition) => (
                    <ToolCard
                      key={tool.name}
                      tool={tool}
                      enabled={localEnabledTools.includes(tool.name)}
                      onToggle={(name) => {
                        setLocalEnabledTools((prev) =>
                          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                        );
                        markDirty();
                      }}
                    />
                  ))}
                  {selectableCustomTools.map((tool) => (
                    <ToolCard
                      key={tool.name}
                      tool={{
                        name: tool.name,
                        description: tool.description,
                        parameters: JSON.parse(tool.parametersSchema || "{}"),
                      }}
                      enabled={localEnabledTools.includes(tool.name)}
                      onToggle={(name) => {
                        setLocalEnabledTools((prev) =>
                          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                        );
                        markDirty();
                      }}
                      isCustom
                    />
                  ))}
                </div>
                <p className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
                  Tool-use must also be enabled per chat via Chat Settings → "Enable Function Calling".
                </p>
              </>
            )}
          </FieldGroup>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Shared Components
// ═══════════════════════════════════════════════

function FieldGroup({
  label,
  icon,
  help,
  collapsible = false,
  expanded = true,
  onExpandedChange,
  summary,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  help?: string;
  collapsible?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const contentVisible = !collapsible || expanded;
  return (
    <div className="mari-editor-panel space-y-2 p-3">
      <div className="flex items-center gap-1.5">
        {collapsible ? (
          <button
            type="button"
            onClick={() => onExpandedChange?.(!expanded)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 text-left transition-colors hover:text-[var(--foreground)]"
            aria-expanded={expanded}
          >
            {icon}
            <h3 className="text-xs font-semibold text-[var(--foreground)]">{label}</h3>
            {summary && (
              <span className="ml-auto rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {summary}
              </span>
            )}
            {expanded ? (
              <ChevronUp size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            )}
          </button>
        ) : (
          <>
            {icon}
            <h3 className="text-xs font-semibold text-[var(--foreground)]">{label}</h3>
          </>
        )}
        {help && <HelpTooltip text={help} />}
      </div>
      {contentVisible && children}
    </div>
  );
}

function EditorSwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
  labelClassName,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <SettingsSwitch
      label={label}
      description={description}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      labelPosition="start"
      className={cn(
        "w-full items-start justify-between rounded-xl p-3 text-left text-xs ring-1",
        checked
          ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-[var(--primary)]/40"
          : "bg-[var(--secondary)]/55 text-[var(--muted-foreground)] ring-[var(--border)]",
        !disabled && !checked && "hover:bg-[var(--accent)]",
        disabled && "opacity-45",
        className,
      )}
      labelClassName={cn("text-xs [&>span:first-child]:font-semibold", labelClassName)}
    />
  );
}

function ToolCard({
  tool,
  enabled,
  onToggle,
  isCustom,
}: {
  tool: ToolDefinition;
  enabled: boolean;
  onToggle: (name: string) => void;
  isCustom?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const params = tool.parameters.properties ?? {};
  const required = tool.parameters.required ?? [];

  return (
    <div
      className={cn(
        "rounded-xl ring-1 overflow-hidden transition-all",
        enabled ? "ring-[var(--primary)]/50 bg-[var(--primary)]/5" : "ring-[var(--border)] bg-[var(--card)]",
      )}
    >
      <div className="flex w-full items-center gap-2.5 px-3 py-2.5">
        <SettingsSwitch
          ariaLabel={`${enabled ? "Disable" : "Enable"} ${tool.name}`}
          checked={enabled}
          onChange={() => onToggle(tool.name)}
          className="shrink-0 p-0 hover:bg-transparent"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
        >
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
              isCustom
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "bg-[var(--muted)]/15 text-[var(--muted-foreground)]",
            )}
          >
            <Wrench size="0.75rem" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold font-mono text-[var(--foreground)]">
              {tool.name}
              {isCustom && <span className="ml-1.5 text-[0.5625rem] font-normal text-[var(--primary)]">custom</span>}
            </p>
            <p className="text-[0.625rem] text-[var(--muted-foreground)] truncate">{tool.description}</p>
          </div>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">{expanded ? "▲" : "▼"}</span>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-2.5 space-y-1.5">
          <p className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Parameters:</p>
          {Object.entries(params).map(([name, prop]) => {
            const p = prop as { type?: string; description?: string; enum?: string[] };
            const isRequired = required.includes(name);
            return (
              <div key={name} className="flex items-start gap-2 text-[0.6875rem]">
                <code className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--foreground)]">
                  {name}
                  {isRequired && <span className="text-red-400">*</span>}
                </code>
                <span className="text-[var(--muted-foreground)]">
                  <span className="text-[var(--primary)]">{p.type}</span>
                  {p.description && ` — ${p.description}`}
                  {p.enum && <span className="ml-1 text-[0.625rem]">[{p.enum.join(", ")}]</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
