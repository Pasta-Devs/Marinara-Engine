// ──────────────────────────────────────────────
// Agent System Types
// ──────────────────────────────────────────────

import { BUILT_IN_AGENT_MANIFESTS, replaceBuiltInAgentManifestRegistry } from "../features/agents/agent-registry.js";
import type { BuiltInAgentManifest } from "../features/agents/agent-manifest.types.js";
import type { AgentToolConfig, ToolDefinition } from "../features/function-calls/tool-definitions.js";
import type { ChatMode } from "./chat.js";
import type { WrapFormat } from "./prompt.js";

/** When in the generation pipeline an agent runs. */
export type AgentPhase =
  /** Before the main generation (can modify prompt context) */
  | "pre_generation"
  /** Fires alongside the main generation (does not receive mainResponse) */
  | "parallel"
  /** After the main response is complete (can modify it) */
  | "post_processing";

const AGENT_PHASE_VALUES = new Set<AgentPhase>(["pre_generation", "parallel", "post_processing"]);

export function normalizeAgentPhaseValue(value: unknown, fallback: AgentPhase = "post_processing"): AgentPhase {
  return typeof value === "string" && AGENT_PHASE_VALUES.has(value as AgentPhase) ? (value as AgentPhase) : fallback;
}

export function normalizeAgentPhaseForType(
  _agentType: string,
  configuredPhase: unknown,
  fallback: AgentPhase = "post_processing",
): AgentPhase {
  // Keep the historical helper name for call-site compatibility, but do not
  // coerce built-ins by type. If the agent editor lets a user choose a phase,
  // that valid phase must survive storage, UI hydration, and runtime resolution.
  return normalizeAgentPhaseValue(configuredPhase, fallback);
}

/** Ordered vocabulary of result types that agents can produce. */
export const AGENT_RESULT_TYPE_VALUES = [
  "game_state_update",
  "text_rewrite",
  "sprite_change",
  "echo_message",
  "quest_update",
  "image_prompt",
  "context_injection",
  "continuity_check",
  "director_event",
  "lorebook_update",
  "character_card_update",
  "character_card_create",
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "inventory_tracker_update",
  "spotify_control",
  "youtube_control",
  "local_music_control",
  "haptic_command",
  "cyoa_choices",
  "secret_plot",
  "game_master_narration",
  "party_action",
  "game_map_update",
  "game_state_transition",
  "prompt_patch",
  "character_activity_update",
  "frontend_theme_update",
  "about_me_update",
  "memory_nag",
] as const;

/** The result type an agent can produce. */
export type AgentResultType = (typeof AGENT_RESULT_TYPE_VALUES)[number];

/** Configuration for a single agent. */
export interface AgentConfig {
  id: string;
  /** Agent type identifier (e.g. "world-state", "prose-guardian") */
  type: string;
  /** Display name */
  name: string;
  description: string;
  /** When this agent runs in the pipeline */
  phase: AgentPhase;
  /** Whether globally enabled */
  enabled: boolean;
  /** Override: use a different connection/model for this agent */
  connectionId: string | null;
  /** Agent-specific prompt template */
  promptTemplate: string;
  /** Agent-specific settings */
  settings: Record<string, unknown>;
  /** Function/tool definitions this agent can use */
  tools: ToolDefinition[];
  /** Tool calling configuration */
  toolConfig: AgentToolConfig | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_AGENT_AUTHOR = "Pasta Devs";
export const DEFAULT_AGENT_PROMPT_TEMPLATE_ID = "default";

/** A named prompt variant that can be selected per chat for an agent. */
export interface AgentPromptTemplateOption {
  id: string;
  name: string;
  promptTemplate: string;
  description?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseAgentSettingsRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
}

export const AGENT_CONFIG_DELETED_SETTING_KEY = "deletedFromLibrary";

export function isAgentConfigDeleted(settings: unknown): boolean {
  return parseAgentSettingsRecord(settings)[AGENT_CONFIG_DELETED_SETTING_KEY] === true;
}

export function markAgentConfigDeletedSettings(settings: unknown): Record<string, unknown> {
  return {
    ...parseAgentSettingsRecord(settings),
    [AGENT_CONFIG_DELETED_SETTING_KEY]: true,
  };
}

function normalizePromptTemplateId(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || fallback;
}

function normalizePromptTemplateName(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

function getUniquePromptTemplateId(id: string, usedIds: Set<string>): string {
  let candidate = id;
  let attempt = 2;
  while (usedIds.has(candidate) || candidate === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
    candidate = `${id}-${attempt}`;
    attempt++;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeAgentPromptTemplateOptions(value: unknown): AgentPromptTemplateOption[] {
  const entries = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([id, entry]) => (isRecord(entry) ? { ...entry, id } : entry))
      : [];
  const usedIds = new Set<string>();
  const options: AgentPromptTemplateOption[] = [];

  for (const [index, entry] of entries.entries()) {
    if (!isRecord(entry)) continue;
    const promptTemplate =
      typeof entry.promptTemplate === "string"
        ? entry.promptTemplate
        : typeof entry.prompt === "string"
          ? entry.prompt
          : "";
    if (!promptTemplate.trim()) continue;
    const name = normalizePromptTemplateName(entry.name ?? entry.label, `Option ${index + 1}`);
    const id = getUniquePromptTemplateId(normalizePromptTemplateId(entry.id, `option-${index + 1}`), usedIds);
    const description = typeof entry.description === "string" ? entry.description.trim() : "";
    options.push({
      id,
      name,
      promptTemplate,
      ...(description ? { description } : {}),
    });
  }

  return options;
}

export function getAgentPromptTemplateOptions(input: {
  promptTemplate?: string | null;
  fallbackPromptTemplate?: string | null;
  settings?: unknown;
}): AgentPromptTemplateOption[] {
  const settings = parseAgentSettingsRecord(input.settings);
  const basePromptTemplate = input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? "");
  const defaultName = normalizePromptTemplateName(settings.defaultPromptTemplateName, "Default");
  const defaultDescription =
    typeof settings.defaultPromptTemplateDescription === "string"
      ? settings.defaultPromptTemplateDescription.trim()
      : "";
  return [
    {
      id: DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
      name: defaultName,
      promptTemplate: basePromptTemplate,
      ...(defaultDescription ? { description: defaultDescription } : {}),
    },
    ...normalizeAgentPromptTemplateOptions(settings.promptTemplates),
  ];
}

export function resolveDefaultAgentPromptTemplateId(settingsValue: unknown): string {
  const settings = parseAgentSettingsRecord(settingsValue);
  const configuredId = normalizePromptTemplateId(settings.defaultPromptTemplateId, DEFAULT_AGENT_PROMPT_TEMPLATE_ID);
  if (configuredId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) return configuredId;
  return normalizeAgentPromptTemplateOptions(settings.promptTemplates).some((option) => option.id === configuredId)
    ? configuredId
    : DEFAULT_AGENT_PROMPT_TEMPLATE_ID;
}

export function normalizeAgentPromptTemplateSelectionMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const selections: Record<string, string> = {};
  for (const [agentType, promptTemplateId] of Object.entries(value)) {
    if (typeof promptTemplateId !== "string") continue;
    const cleanedType = agentType.trim();
    const cleanedId = normalizePromptTemplateId(promptTemplateId, "");
    if (!cleanedType || !cleanedId) continue;
    selections[cleanedType] = cleanedId;
  }
  return selections;
}

export function resolveAgentPromptTemplate(input: {
  promptTemplate?: string | null;
  fallbackPromptTemplate?: string | null;
  settings?: unknown;
  selectedPromptTemplateId?: string | null;
}): string {
  const explicitSelectedId = normalizePromptTemplateId(input.selectedPromptTemplateId, "");
  const selectedId = explicitSelectedId || resolveDefaultAgentPromptTemplateId(input.settings);
  if (selectedId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
    return input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? "");
  }
  const option = getAgentPromptTemplateOptions(input).find((entry) => entry.id === selectedId);
  return (
    option?.promptTemplate ??
    (input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? ""))
  );
}

/** Result produced by an agent after execution. */
export interface AgentResult {
  agentId: string;
  agentType: string;
  type: AgentResultType;
  /** The result payload (varies by type) */
  data: unknown;
  /** Token usage */
  tokensUsed: number;
  /** How long the agent took */
  durationMs: number;
  /** Whether the agent succeeded */
  success: boolean;
  error: string | null;
}

export type AgentWriteApprovalKind = "character_card_create" | "lorebook_update" | "summary_update";

export interface AgentWriteApprovalProposal {
  kind: AgentWriteApprovalKind;
  chatId: string;
  agentType: string | null;
  agentName: string;
  title: string;
  text: string;
  payload?: Record<string, unknown>;
  canRegenerate?: boolean;
  createdAt?: string;
}

export interface AgentWriteApprovalEnvelope {
  requiresApproval: true;
  approval: AgentWriteApprovalProposal;
}

export interface AgentCallDebugMessage {
  role: string;
  content: string;
  name?: string;
}

export interface AgentCallDebugEvent {
  stage: "request" | "response" | "retry_request" | "retry_response" | "error";
  agentId: string;
  agentType: string;
  agentName: string;
  phase: string;
  model: string;
  /** Effective sampling value sent to the provider; omitted when connection/model policy suppresses it. */
  temperature?: number;
  maxTokens: number;
  messageCount: number;
  messages?: AgentCallDebugMessage[];
  tools?: string[];
  round?: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  /** Duration of this provider request. */
  durationMs?: number;
  /** Cumulative elapsed time for a multi-round agent run. */
  elapsedMs?: number;
  finishReason?: string | null;
  response?: string;
  responsePreview?: string;
  error?: string;
  batchedAgentTypes?: string[];
}

/** Shared context passed to every agent. */
export interface AgentContext {
  chatId: string;
  chatMode: string;
  /** Prompt wrapper format selected for this generation. */
  wrapFormat?: WrapFormat;
  /** Recent chat history (last N messages) */
  recentMessages: Array<{
    id?: string;
    role: string;
    content: string;
    characterId?: string;
    /** Tracker state snapshot for this message (if any). */
    gameState?: import("./game-state.js").GameState | null;
  }>;
  /** The main response text (available for post-processing agents) */
  mainResponse: string | null;
  /** Speaker-attributed response segments when Roleplay Name Prefix is enabled. */
  mainResponseSegments?: Array<{
    characterId?: string;
    characterName: string;
    content: string;
  }>;
  /** Current game state (if any) */
  gameState: import("./game-state.js").GameState | null;
  /**
   * Active characters in the chat. The base shape (id/name/description) is
   * always populated. Richer card fields are optional — they're present in
   * practice, but agents should not rely on them unless needed. The Card
   * Evolution Auditor agent uses them to emit exact-match oldText edits.
   */
  characters: Array<{
    id: string;
    name: string;
    /** Persisted character-card world name, when configured. */
    world?: string;
    description: string;
    personality?: string;
    scenario?: string;
    creatorNotes?: string;
    systemPrompt?: string;
    backstory?: string;
    appearance?: string;
    mesExample?: string;
    firstMes?: string;
    postHistoryInstructions?: string;
    avatarPath?: string | null;
    avatarCrop?: unknown;
    rpgStats?: import("./character.js").RPGStatsConfig;
  }>;
  /** Every character attached to the chat, with only the data needed for activity routing. */
  chatCharacters?: Array<{
    id: string;
    name: string;
    active: boolean;
  }>;
  /** Latest known tracker entries, including recurring characters that are currently absent. */
  characterTrackerHistory?: import("./game-state.js").PresentCharacter[];
  /** User persona info */
  persona: {
    name: string;
    description: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    personaStats?: { enabled: boolean; bars: Array<{ name: string; value: number; max: number; color: string }> };
    rpgStats?: {
      enabled: boolean;
      attributes: Array<{ name: string; value: number }>;
      hp: { value: number; max: number };
      pools?: import("./character.js").RPGStatPool[];
    };
  } | null;
  /** The agent's own persistent memory (key-value) */
  memory: Record<string, unknown>;
  /** All lorebook IDs the agent can write to */
  writableLorebookIds: string[] | null;
  /** Chat summary text (if any) — helps agents avoid duplicating summarized info */
  chatSummary: string | null;
  /** Resolved Author's Notes for custom agents that explicitly opt into them. */
  authorNotes?: string | null;
  /** Lorebook entries activated for the main generation on this turn. */
  activatedLorebookEntries?: Array<{
    id: string;
    content: string;
  }>;
  /** Per-lorebook total entry counts (for {{lorebooksize::ID}} macro in agent prompts). */
  lorebookEntryCounts?: Record<string, number>;
  /**
   * Semantic source material resolved for custom agents that opt into vector access.
   * The runtime keeps this out of ordinary agent prompts and injects it only for
   * agents with the `access_vectors` capability.
   */
  vectorContext?: {
    recalledMemories: string[];
    semanticLorebookEntries: Array<{
      id: string;
      content: string;
      semanticScore?: number;
    }>;
  };
  /** Keyword/semantic lorebook matches resolved from each custom agent's own context window. */
  triggeredLorebookEntriesByAgentId?: Record<
    string,
    Array<{
      id: string;
      name?: string;
      content: string;
      matchedKeys: string[];
      activationSources: string[];
      semanticScore?: number;
    }>
  >;
  /** Current-turn pre-generation injections, only present for agents that opt in */
  preGenInjections?: Array<{ agentType: string; agentName?: string; text: string }>;
  /** Current-turn parallel-phase results, only present for agents that opt in */
  parallelResults?: AgentResult[];
  /** Whether internal agent LLM calls should use transport streaming. */
  streaming?: boolean;
  /** Emits full agent call diagnostics for the client debug console. */
  agentDebug?: (event: AgentCallDebugEvent) => void;
  /** Abort signal — when triggered, agent execution should stop. Typed as `any` to avoid DOM/Node lib dependency. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal?: any;
}

/** Built-in agent type identifiers. */
export const BUILT_IN_AGENT_IDS = {
  WORLD_STATE: "world-state",
  PROSE_GUARDIAN: "prose-guardian",
  CONTINUITY: "continuity",
  EXPRESSION: "expression",
  ECHO_CHAMBER: "echo-chamber",
  DIRECTOR: "director",
  QUEST: "quest",
  ILLUSTRATOR: "illustrator",
  LOREBOOK_KEEPER: "lorebook-keeper",
  CARD_EVOLUTION_AUDITOR: "card-evolution-auditor",
  COMBAT: "combat",
  BACKGROUND: "background",
  CHARACTER_TRACKER: "character-tracker",
  PERSONA_STATS: "persona-stats",
  HTML: "html",
  SPOTIFY: "spotify",
  KNOWLEDGE_RETRIEVAL: "knowledge-retrieval",
  KNOWLEDGE_ROUTER: "knowledge-router",
  CUSTOM_TRACKER: "custom-tracker",
  HAPTIC: "haptic",
  CYOA: "cyoa",
} as const;

export const RETIRED_BUILT_IN_AGENT_IDS = [
  "about-me-keeper",
  "prompt-reviewer",
  "response-orchestrator",
  "schedule-planner",
  "chat-summary",
  "autonomous-messenger",
  "youtube",
  "secret-plot-driver",
] as const;

const RETIRED_BUILT_IN_AGENT_ID_SET = new Set<string>(RETIRED_BUILT_IN_AGENT_IDS);

export function isRetiredBuiltInAgentId(agentId: string): boolean {
  return RETIRED_BUILT_IN_AGENT_ID_SET.has(agentId);
}

export type AgentCategory = "writer" | "tracker" | "misc";

export interface BuiltInAgentMeta {
  id: string;
  name: string;
  description: string;
  author: string;
  phase: AgentPhase;
  enabledByDefault: boolean;
  /** Whether "Add as Prompt Section" should default to on when first created */
  defaultInjectAsSection?: boolean;
  category: AgentCategory;
  /** Hide this built-in from public agent library and chat agent pickers. */
  libraryHidden?: boolean;
  /** Keep legacy configs recognized, but never run this built-in in generation pipelines. */
  runtimeDisabled?: boolean;
  modeAllowlist?: readonly ChatMode[];
  promptTemplates?: AgentPromptTemplateOption[];
  execution?: "pipeline" | "feature" | "host";
}

function toBuiltInAgentMeta(agent: BuiltInAgentManifest): BuiltInAgentMeta {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    author: agent.author ?? DEFAULT_AGENT_AUTHOR,
    phase: normalizeAgentPhaseForType(agent.id, agent.phase),
    enabledByDefault: agent.enabledByDefault,
    ...(agent.defaultInjectAsSection !== undefined ? { defaultInjectAsSection: agent.defaultInjectAsSection } : {}),
    category: agent.category,
    ...(agent.libraryHidden !== undefined ? { libraryHidden: agent.libraryHidden } : {}),
    ...(agent.runtimeDisabled !== undefined ? { runtimeDisabled: agent.runtimeDisabled } : {}),
    ...(agent.modeAllowlist !== undefined ? { modeAllowlist: [...agent.modeAllowlist] } : {}),
    ...(agent.promptTemplates !== undefined ? { promptTemplates: [...agent.promptTemplates] } : {}),
    ...(agent.execution !== undefined ? { execution: agent.execution } : {}),
  };
}

export const BUILT_IN_AGENTS: BuiltInAgentMeta[] = [];

export const DEFAULT_AGENT_CONTEXT_SIZE = 5;
export const DEFAULT_AGENT_MAX_TOKENS = 4096;
export const MIN_AGENT_MAX_TOKENS = 128;
export const MAX_AGENT_MAX_TOKENS = 32768;

export const CUSTOM_AGENT_CAPABILITY_IDS = [
  "create_characters",
  "create_lorebooks",
  "edit_lorebooks",
  "edit_messages",
  "edit_trackers",
  "change_frontend_styling",
  "change_backgrounds",
  "change_sprites",
  "control_media",
  "control_haptics",
  "edit_about_me",
  "trigger_image_generation",
  "access_vectors",
  "edit_main_prompt",
  "manage_chat_characters",
] as const;

export type CustomAgentCapability = (typeof CUSTOM_AGENT_CAPABILITY_IDS)[number];
export type CustomAgentCapabilityMap = Partial<Record<CustomAgentCapability, boolean>>;

export const CUSTOM_AGENT_CONTEXT_SOURCE_IDS = [
  "chatHistory",
  "characters",
  "persona",
  "activatedLorebookEntries",
  "chatSummary",
  "authorNotes",
  "trackerData",
  "recalledMemories",
] as const;

export type CustomAgentContextSource = (typeof CUSTOM_AGENT_CONTEXT_SOURCE_IDS)[number];
export type CustomAgentContextSources = Record<CustomAgentContextSource, boolean>;

export const DEFAULT_CUSTOM_AGENT_CONTEXT_SOURCES: CustomAgentContextSources = {
  chatHistory: true,
  characters: false,
  persona: false,
  activatedLorebookEntries: false,
  chatSummary: false,
  authorNotes: false,
  trackerData: false,
  recalledMemories: false,
};

export function normalizeCustomAgentContextSources(settings: unknown): CustomAgentContextSources {
  const stored = parseAgentSettingsRecord(settings).contextSources;
  if (!isRecord(stored)) return { ...DEFAULT_CUSTOM_AGENT_CONTEXT_SOURCES };

  const normalized = { ...DEFAULT_CUSTOM_AGENT_CONTEXT_SOURCES };
  for (const source of CUSTOM_AGENT_CONTEXT_SOURCE_IDS) {
    if (typeof stored[source] === "boolean") normalized[source] = stored[source];
  }
  return normalized;
}

export interface CustomAgentImportPolicy {
  enabled: boolean;
}

export type CustomAgentImportSource = "file" | "folder" | "repository";

export const CUSTOM_AGENT_IMPORT_SOURCE_SETTING = "customAgentImportSource";
export const CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING = "customAgentPermissionsExplicit";

export function createImportedAgentType(sourceType: string): string {
  const slug =
    sourceType
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "agent";
  const suffix =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom-import-${slug}-${suffix}`;
}

const CUSTOM_AGENT_CAPABILITY_SET = new Set<string>(CUSTOM_AGENT_CAPABILITY_IDS);

const CUSTOM_AGENT_RESULT_CAPABILITY: Partial<Record<AgentResultType, CustomAgentCapability>> = {
  character_card_create: "create_characters",
  text_rewrite: "edit_messages",
  lorebook_update: "edit_lorebooks",
  character_tracker_update: "edit_trackers",
  persona_stats_update: "edit_trackers",
  custom_tracker_update: "edit_trackers",
  inventory_tracker_update: "edit_trackers",
  quest_update: "edit_trackers",
  game_state_update: "edit_trackers",
  image_prompt: "trigger_image_generation",
  prompt_patch: "edit_main_prompt",
  character_activity_update: "manage_chat_characters",
  frontend_theme_update: "change_frontend_styling",
  background_change: "change_backgrounds",
  sprite_change: "change_sprites",
  spotify_control: "control_media",
  youtube_control: "control_media",
  local_music_control: "control_media",
  haptic_command: "control_haptics",
  about_me_update: "edit_about_me",
  cyoa_choices: "edit_messages",
  echo_message: "edit_messages",
};

function normalizeCapabilityMap(value: unknown): CustomAgentCapabilityMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: CustomAgentCapabilityMap = {};
  for (const [key, enabled] of Object.entries(value as Record<string, unknown>)) {
    if (!CUSTOM_AGENT_CAPABILITY_SET.has(key) || enabled !== true) continue;
    output[key as CustomAgentCapability] = true;
  }
  return output;
}

export function normalizeCustomAgentCapabilities(
  settings: Record<string, unknown> | null | undefined,
): CustomAgentCapabilityMap {
  const capabilities = normalizeCapabilityMap(settings?.customCapabilities ?? settings?.capabilities);
  const enabledToolsValue = settings?.enabledTools;
  const enabledTools = Array.isArray(enabledToolsValue) ? enabledToolsValue : [];
  const resultType = typeof settings?.resultType === "string" ? settings.resultType : null;

  if (
    settings?.[CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING] !== true &&
    (settings?.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"))
  ) {
    capabilities.edit_lorebooks = true;
  }

  if (
    settings?.[CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING] !== true &&
    resultType &&
    Object.prototype.hasOwnProperty.call(CUSTOM_AGENT_RESULT_CAPABILITY, resultType)
  ) {
    const capability = CUSTOM_AGENT_RESULT_CAPABILITY[resultType as AgentResultType];
    if (capability) capabilities[capability] = true;
  }

  return capabilities;
}

export function customAgentHasCapability(
  settings: Record<string, unknown> | null | undefined,
  capability: CustomAgentCapability,
): boolean {
  return normalizeCustomAgentCapabilities(settings)[capability] === true;
}

export function getCustomAgentResultCapability(resultType: AgentResultType): CustomAgentCapability | null {
  return CUSTOM_AGENT_RESULT_CAPABILITY[resultType] ?? null;
}

export function isExternallyImportedAgent(type: unknown, settings: unknown): boolean {
  const parsed = parseAgentSettingsRecord(settings);
  const source = parsed[CUSTOM_AGENT_IMPORT_SOURCE_SETTING];
  if (source === "file" || source === "folder" || source === "repository") return true;
  if (parsed.customAgentRepositorySource && typeof parsed.customAgentRepositorySource === "object") return true;
  // Repository-backed Agents predate explicit provenance and retain a stable
  // repo-* identity. File/folder imports always persist provenance now, so a
  // locally authored Agent whose slug happens to begin with "import" must not
  // be disabled as an external import.
  return typeof type === "string" && type.startsWith("repo-");
}

export function getDefaultBuiltInAgentSettings(agentType: string): Record<string, unknown> {
  const builtIn = BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentType);
  const settings: Record<string, unknown> = {
    maxTokens: DEFAULT_AGENT_MAX_TOKENS,
    ...(builtIn?.defaultSettings ?? {}),
  };

  if (builtIn) {
    settings.author = builtIn.author ?? DEFAULT_AGENT_AUTHOR;
  }

  if (builtIn?.promptTemplates?.length) {
    settings.promptTemplates = [...builtIn.promptTemplates];
  }

  if (builtIn?.defaultInjectAsSection) {
    settings.injectAsSection = true;
  }

  if (builtIn?.runInterval !== undefined) {
    settings.runInterval = builtIn.runInterval;
  }

  return settings;
}

const OBSOLETE_BUILT_IN_PROMPT_TEMPLATE_IDS: Record<string, ReadonlySet<string>> = {
  illustrator: new Set(["illustration", "sketch"]),
};

const ADDITIONAL_BUILT_IN_PROMPT_TEMPLATE_COLLECTION_KEYS: Record<string, readonly string[]> = {
  storyboard: [
    "illustrationTemplates",
    "videoTemplates",
    "animationRefinementTemplates",
    "roleplayEpisodeTemplates",
    "roleplayStyleTemplates",
    "roleplayAnimationTemplates",
    "roleplayOutputTemplates",
  ],
};

const RETIRED_BUILT_IN_AGENT_TOOLS: Record<string, ReadonlySet<string>> = {
  expression: new Set(["set_expression"]),
};

export function normalizeBuiltInAgentEnabledTools(agentType: string, value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const enabledTools = value.filter((tool): tool is string => typeof tool === "string");
  const retiredTools = RETIRED_BUILT_IN_AGENT_TOOLS[agentType];
  return retiredTools ? enabledTools.filter((tool) => !retiredTools.has(tool)) : enabledTools;
}

function mergeBuiltInPromptTemplateCollection(
  defaultValue: unknown,
  savedValue: unknown,
  obsoleteIds: ReadonlySet<string> = new Set(),
): AgentPromptTemplateOption[] {
  const defaultOptions = normalizeAgentPromptTemplateOptions(defaultValue);
  const savedOptions = normalizeAgentPromptTemplateOptions(savedValue);
  const savedOptionsById = new Map(
    savedOptions.filter((entry) => !obsoleteIds.has(entry.id)).map((entry) => [entry.id, entry]),
  );
  const usedIds = new Set<string>();
  const mergedDefaultOptions = defaultOptions.map((defaultOption) => {
    usedIds.add(defaultOption.id);
    const savedOption = savedOptionsById.get(defaultOption.id);
    return savedOption ? { ...defaultOption, ...savedOption } : defaultOption;
  });
  const customOptions = savedOptions.filter((entry) => {
    if (obsoleteIds.has(entry.id) || usedIds.has(entry.id)) return false;
    usedIds.add(entry.id);
    return true;
  });
  return [...mergedDefaultOptions, ...customOptions];
}

export function mergeBuiltInAgentSettings(agentType: string, settings: unknown): Record<string, unknown> {
  const parsed = parseAgentSettingsRecord(settings);
  const normalizedEnabledTools = normalizeBuiltInAgentEnabledTools(agentType, parsed.enabledTools);
  const normalizedSettings =
    normalizedEnabledTools === null ? parsed : { ...parsed, enabledTools: normalizedEnabledTools };
  const builtIn = BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentType);
  if (!builtIn) return normalizedSettings;

  const defaults = getDefaultBuiltInAgentSettings(agentType);
  const merged: Record<string, unknown> = {
    ...defaults,
    ...normalizedSettings,
  };

  const promptTemplateCollectionKeys = [
    "promptTemplates",
    ...(ADDITIONAL_BUILT_IN_PROMPT_TEMPLATE_COLLECTION_KEYS[agentType] ?? []),
  ];
  for (const key of promptTemplateCollectionKeys) {
    const obsoleteIds =
      key === "promptTemplates" ? (OBSOLETE_BUILT_IN_PROMPT_TEMPLATE_IDS[agentType] ?? new Set<string>()) : undefined;
    const promptTemplates = mergeBuiltInPromptTemplateCollection(defaults[key], normalizedSettings[key], obsoleteIds);
    if (promptTemplates.length) {
      merged[key] = promptTemplates;
    } else {
      delete merged[key];
    }
  }

  return merged;
}

/** Recommended default tools for each built-in agent type. */
export const DEFAULT_AGENT_TOOLS: Record<string, string[]> = {};

export function replaceBuiltInAgentDefinitions(manifests: readonly BuiltInAgentManifest[]): void {
  replaceBuiltInAgentManifestRegistry(manifests);
  BUILT_IN_AGENTS.splice(0, BUILT_IN_AGENTS.length, ...manifests.map(toBuiltInAgentMeta));
  for (const key of Object.keys(DEFAULT_AGENT_TOOLS)) delete DEFAULT_AGENT_TOOLS[key];
  for (const agent of manifests) {
    DEFAULT_AGENT_TOOLS[agent.id] = normalizeBuiltInAgentEnabledTools(agent.id, agent.defaultTools ?? []) ?? [];
  }
}

/** Data shape for a lorebook_update agent result. */
export interface LorebookUpdateResult {
  /** "create" | "update" | "delete" */
  action: "create" | "update" | "delete";
  /** Target lorebook ID */
  lorebookId: string;
  /** Entry ID (for update/delete) */
  entryId?: string;
  /** Entry data (for create/update) */
  entry?: {
    name: string;
    content: string;
    keys: string[];
    tag?: string;
    /** Optional lorebook injection priority. Omission preserves the existing/default order. */
    order?: number;
  };
}

/**
 * Single proposed edit to a character card field.
 *
 * Unlike LorebookUpdateResult, these edits are NEVER applied automatically —
 * the server emits them as an agent_result SSE event and the client shows
 * a confirmation modal. Character cards are more sensitive than lorebook
 * entries because they define the character's identity.
 */
export const EDITABLE_CHARACTER_CARD_FIELDS = [
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "backstory",
  "appearance",
  "aboutMe",
] as const;

export type EditableCharacterCardField = (typeof EDITABLE_CHARACTER_CARD_FIELDS)[number];

export interface CharacterCardFieldUpdate {
  /** Stable target character id from the <character id="..."> context block. */
  characterId: string;
  /** Currently only "update" is supported; reserved for future create/delete. */
  action: "update";
  /** Which stored character-card field this edit targets. */
  field: EditableCharacterCardField;
  /** The existing field value the agent observed. */
  oldText: string;
  /** The proposed replacement text. */
  newText: string;
  /** Why the agent thinks this edit is warranted (shown to the user). */
  reason: string;
}

/** Data shape for a character_card_update agent result. */
export interface CharacterCardUpdateResult {
  updates: CharacterCardFieldUpdate[];
}
