// ──────────────────────────────────────────────
// Agent System Types
// ──────────────────────────────────────────────

import { BUILT_IN_AGENT_MANIFESTS } from "../features/agents/agent-registry.js";
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
  agentType: string,
  configuredPhase: unknown,
  fallback: AgentPhase = "post_processing",
): AgentPhase {
  if (agentType === "prose-guardian" || agentType === "continuity") return "post_processing";
  return normalizeAgentPhaseValue(configuredPhase, fallback);
}

/** The result type an agent can produce. */
export type AgentResultType =
  | "game_state_update"
  | "text_rewrite"
  | "sprite_change"
  | "echo_message"
  | "quest_update"
  | "image_prompt"
  | "context_injection"
  | "continuity_check"
  | "director_event"
  | "lorebook_update"
  | "character_card_update"
  | "background_change"
  | "character_tracker_update"
  | "persona_stats_update"
  | "custom_tracker_update"
  | "spotify_control"
  | "youtube_control"
  | "local_music_control"
  | "haptic_command"
  | "cyoa_choices"
  | "secret_plot"
  | "game_master_narration"
  | "party_action"
  | "game_map_update"
  | "game_state_transition"
  | "prompt_patch"
  | "frontend_theme_update";

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
  agentType: string;
  promptTemplate?: string | null;
  fallbackPromptTemplate?: string | null;
  settings?: unknown;
  selectedPromptTemplateId?: string | null;
}): string {
  const selectedId = normalizePromptTemplateId(input.selectedPromptTemplateId, "");
  if (!selectedId || selectedId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
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

export type AgentWriteApprovalKind = "lorebook_update" | "summary_update";

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
  temperature: number;
  maxTokens: number;
  messageCount: number;
  messages?: AgentCallDebugMessage[];
  tools?: string[];
  round?: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  durationMs?: number;
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
  }>;
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
    };
  } | null;
  /** The agent's own persistent memory (key-value) */
  memory: Record<string, unknown>;
  /** Lorebook entries activated for this generation (read context) */
  activatedLorebookEntries: Array<{ id: string; name: string; content: string; tag: string }> | null;
  /** All lorebook IDs the agent can write to */
  writableLorebookIds: string[] | null;
  /** Chat summary text (if any) — helps agents avoid duplicating summarized info */
  chatSummary: string | null;
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
}

export const BUILT_IN_AGENTS: BuiltInAgentMeta[] = BUILT_IN_AGENT_MANIFESTS.map((agent) => ({
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
}));

export const BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS: Readonly<Record<string, number>> = Object.fromEntries(
  BUILT_IN_AGENT_MANIFESTS.flatMap((agent) => (agent.runInterval === undefined ? [] : [[agent.id, agent.runInterval]])),
);

export const DEFAULT_AGENT_CONTEXT_SIZE = 5;
export const DEFAULT_AGENT_MAX_TOKENS = 4096;
export const MIN_AGENT_MAX_TOKENS = 128;
export const MAX_AGENT_MAX_TOKENS = 32768;

export const CUSTOM_AGENT_CAPABILITY_IDS = [
  "create_lorebooks",
  "edit_lorebooks",
  "edit_messages",
  "edit_trackers",
  "change_frontend_styling",
  "trigger_image_generation",
  "access_vectors",
  "edit_main_prompt",
] as const;

export type CustomAgentCapability = (typeof CUSTOM_AGENT_CAPABILITY_IDS)[number];
export type CustomAgentCapabilityMap = Partial<Record<CustomAgentCapability, boolean>>;

const CUSTOM_AGENT_CAPABILITY_SET = new Set<string>(CUSTOM_AGENT_CAPABILITY_IDS);

const CUSTOM_AGENT_RESULT_CAPABILITY: Partial<Record<AgentResultType, CustomAgentCapability>> = {
  text_rewrite: "edit_messages",
  lorebook_update: "edit_lorebooks",
  character_tracker_update: "edit_trackers",
  persona_stats_update: "edit_trackers",
  custom_tracker_update: "edit_trackers",
  quest_update: "edit_trackers",
  game_state_update: "edit_trackers",
  image_prompt: "trigger_image_generation",
  prompt_patch: "edit_main_prompt",
  frontend_theme_update: "change_frontend_styling",
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

  if (settings?.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry")) {
    capabilities.edit_lorebooks = true;
  }

  if (resultType && Object.prototype.hasOwnProperty.call(CUSTOM_AGENT_RESULT_CAPABILITY, resultType)) {
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

export function mergeBuiltInAgentSettings(agentType: string, settings: unknown): Record<string, unknown> {
  const parsed = parseAgentSettingsRecord(settings);
  const builtIn = BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentType);
  if (!builtIn) return parsed;

  const defaults = getDefaultBuiltInAgentSettings(agentType);
  const merged: Record<string, unknown> = {
    ...defaults,
    ...parsed,
  };

  const defaultPromptTemplates = normalizeAgentPromptTemplateOptions(defaults.promptTemplates);
  const savedPromptTemplates = normalizeAgentPromptTemplateOptions(parsed.promptTemplates);
  const obsoleteIds = OBSOLETE_BUILT_IN_PROMPT_TEMPLATE_IDS[agentType] ?? new Set<string>();
  const usedIds = new Set(defaultPromptTemplates.map((entry) => entry.id));
  const customPromptTemplates = savedPromptTemplates.filter((entry) => {
    if (obsoleteIds.has(entry.id) || usedIds.has(entry.id)) return false;
    usedIds.add(entry.id);
    return true;
  });
  const promptTemplates = [...defaultPromptTemplates, ...customPromptTemplates];

  if (promptTemplates.length) {
    merged.promptTemplates = promptTemplates;
  } else {
    delete merged.promptTemplates;
  }

  return merged;
}

/** Recommended default tools for each built-in agent type. */
export const DEFAULT_AGENT_TOOLS: Record<string, string[]> = Object.fromEntries(
  BUILT_IN_AGENT_MANIFESTS.map((agent) => [agent.id, [...(agent.defaultTools ?? [])]]),
);

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
