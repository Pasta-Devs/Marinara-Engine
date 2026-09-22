import { BUILT_IN_TOOLS, DEFAULT_AGENT_TOOLS, customAgentHasCapability } from "@marinara-engine/shared";
import type { AgentContext, SourceMessageRef } from "@marinara-engine/shared";
import type { LLMToolDefinition } from "../llm/base-provider.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { capabilityToolDefs } from "../capability-packages/capability-tool-registry.service.js";
import {
  createCustomToolArgumentsValidator,
  executeToolCallForModel,
  executeToolCalls,
  type CustomToolDef,
  type CustomToolHiddenContext,
  type MetadataPatch,
  type MetadataPatchInput,
  type ToolExecutionContext,
} from "../tools/tool-executor.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../spotify/spotify.service.js";
import { logger } from "../../lib/logger.js";
import { semanticShortlistLorebookEntries, type LorebookEmbeddingOptions } from "../lorebook/embeddings.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
} from "../../routes/generate/agent-write-approval.js";
import {
  readSpotifyNumberField,
  readSpotifyPlaybackTrackUri,
  readSpotifyStringField,
  readSpotifyTrackUris,
  rememberSpotifyCandidateTracks,
  type SpotifyRuntimeAgent,
} from "./spotify-agent-runtime.js";
import { resolveSpotifyToolAvailabilityRequest } from "./spotify-tool-availability.js";
import { shouldAttachSummariesToAgents } from "./roleplay-summary-retrieval.js";
import {
  formatZonedConversationTime,
  getZonedDateParts,
  resolveConversationTimeZone,
} from "../conversation/timezone.js";

const LORE_SEARCH_MIN_SIMILARITY = 0.25;

type CustomToolsStore = {
  listEnabled(): Promise<
    Array<{
      name: string;
      description: string;
      parametersSchema: unknown;
      executionType: string;
      webhookUrl: string | null;
      staticResult: string | null;
      scriptBody: string | null;
      includeHiddenContext?: string | boolean | number | null;
    }>
  >;
};

type ChatsStore = {
  getMessage(id: string): Promise<{ id: string; chatId: string; role: string } | null>;
  updateMessageContent(id: string, content: string): Promise<unknown>;
  patchMetadata(
    chatId: string,
    patcher: (currentMeta: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>,
  ): Promise<{ metadata?: unknown } | null>;
};

type LorebooksStore = {
  listActiveEntries(args: Record<string, unknown>): Promise<any[]>;
  getById(id: string): Promise<any | null>;
  listEntries(lorebookId: string): Promise<any[]>;
  createEntry(entry: Record<string, unknown>): Promise<any>;
  updateEntry(
    id: string,
    entry: Record<string, unknown>,
    expectedProvenance?: {
      sourceAgentId: string;
      sourceMessageRefs: SourceMessageRef[];
      updatedAt: string;
      content: string;
    },
  ): Promise<any>;
};

type AgentsStore = unknown;

export type ResolveGenerationToolsArgs = {
  requestBody: Record<string, unknown>;
  chatId: string;
  chatMetadata: Record<string, unknown>;
  chats: ChatsStore;
  agentsStore: AgentsStore;
  customToolsStore: CustomToolsStore;
  lorebooksStore: LorebooksStore;
  resolvedAgents: ResolvedAgent[];
  enabledConfigs: any[];
  promptCharacterIds: string[];
  lorebookCharacterIds?: string[];
  personaId: string | null;
  activeLorebookIds: string[];
  excludedLorebookIds: string[];
  excludedSourceAgentIds: string[];
  gameState: unknown;
  gameSpotifyMusicEnabled: boolean;
  agentContext: AgentContext;
  emitMetadataPatch(patch: Record<string, unknown>): void;
  /**
   * Tools the mode itself needs, attached regardless of the chat's "Enable Tool Use"
   * toggle. Deliberately separate from `enableChatTools`: flipping that on would also
   * arm every other default-on tool, the Spotify credential lookup, and the
   * local-endpoint `<available_functions>` prompt injection.
   */
  autoAttachToolNames?: readonly string[];
  nativeToolsAvailable?: boolean;
  getLorebookSourceMessageRefs?: (agent: ResolvedAgent) => SourceMessageRef[];
  lorebookEmbeddingOptions?: LorebookEmbeddingOptions;
};

export type ResolveAgentGenerationToolsArgs = ResolveGenerationToolsArgs & {
  observeSpotifyPlaybackBeforePlay?: boolean;
};

export type ResolvedGenerationTools = {
  enableChatTools: boolean;
  /**
   * Whether this turn sends tools to the model at all — true when the chat toggle is on
   * *or* when the mode auto-attached something. The tool loop branches on this;
   * everything that must stay tied to the user's toggle keeps reading `enableChatTools`.
   */
  toolsAttached: boolean;
  chatResolvedToolNames: Set<string>;
  toolDefs: LLMToolDefinition[] | undefined;
  baseToolExecutionContext: ToolExecutionContext;
  updateChatMetadataForTools: (patchOrUpdater: MetadataPatchInput) => Promise<MetadataPatch>;
  finalizeLorebookWrites: () => Promise<void>;
};

export function resolveToolLorebookCharacterIds(
  promptCharacterIds: string[],
  lorebookCharacterIds?: string[],
): string[] {
  return lorebookCharacterIds ?? promptCharacterIds;
}

const AGENT_ONLY_TOOL_NAMES = new Set([
  "save_lorebook_entry",
  "read_chat_summary",
  "append_chat_summary",
  "read_chat_variable",
  "write_chat_variable",
  "edit_chat_message",
]);

// Tools only offered in Conversation mode. Enforced regardless of the per-chat
// tool filter, so they can never be called in Roleplay/VN/Game.
const CONVERSATION_ONLY_TOOL_NAMES = new Set(["update_about_me"]);

// Tools that are off unless the user explicitly enables them via activeToolIds
// (excluded from the "no filter set = all tools on" default).
const DEFAULT_OFF_TOOL_NAMES = new Set(["update_about_me", ...(DEFAULT_AGENT_TOOLS.spotify ?? [])]);

export function isChatToolEnabledByDefault(toolName: string): boolean {
  return !AGENT_ONLY_TOOL_NAMES.has(toolName) && !DEFAULT_OFF_TOOL_NAMES.has(toolName);
}

/**
 * Game Mode rolls real dice instead of letting the GM invent numbers, so the dice tool
 * rides along on every game turn. Only this one — the rest of the tool set still waits
 * for the user to turn "Enable Tool Use" on.
 */
export const GAME_MODE_AUTO_ATTACH_TOOL_NAMES: readonly string[] = ["roll_dice"];

/**
 * Decide which tool definitions this chat turn sends to the model.
 *
 * - toggle off, nothing auto-attached → `undefined`, exactly as before this channel existed
 * - toggle off, auto-attach names     → only those names
 * - toggle on                         → the chat's set, plus any auto-attached name it missed
 */
export function resolveChatToolDefs(args: {
  allToolDefs: LLMToolDefinition[];
  enableChatTools: boolean;
  activeToolIds: string[];
  autoAttachToolNames: readonly string[];
}): LLMToolDefinition[] | undefined {
  const autoAttachNames = new Set(args.autoAttachToolNames.filter((name) => !AGENT_ONLY_TOOL_NAMES.has(name)));
  if (!args.enableChatTools && autoAttachNames.size === 0) return undefined;

  return args.allToolDefs.filter((toolDef) => isChatToolResolved(toolDef.function.name, args));
}

/**
 * Whether one named built-in tool survives the filter above.
 *
 * Split out of `resolveChatToolDefs` so a caller that has to know the answer BEFORE the
 * tool set is built can ask the same question instead of restating its three rules. The
 * one caller today is the Game format reminder (#6215): the prompt line that
 * describes `roll_dice` and the attachment itself are gated on this one fact, so the tool
 * is never attached without being described and never described without being attached.
 *
 * Deliberately only meaningful for a built-in name. A custom tool can be missing from the
 * loaded definitions for reasons this cannot see (disabled, renamed, an invalid schema),
 * so the answer for one is an upper bound rather than a fact.
 */
export function isChatToolResolved(
  name: string,
  args: { enableChatTools: boolean; activeToolIds: readonly string[]; autoAttachToolNames: readonly string[] },
): boolean {
  if (AGENT_ONLY_TOOL_NAMES.has(name)) return false;
  if (args.autoAttachToolNames.includes(name)) return true;
  if (!args.enableChatTools) return false;
  return args.activeToolIds.length > 0 ? args.activeToolIds.includes(name) : isChatToolEnabledByDefault(name);
}

/** The chat's tool filter, or an empty list when it has none. Empty means "no filter". */
export function readChatActiveToolIds(chatMetadata: Record<string, unknown>): string[] {
  return Array.isArray(chatMetadata.activeToolIds) ? (chatMetadata.activeToolIds as string[]) : [];
}

/**
 * The chat's "Enable Tool Use" answer for a main generation turn: the request's own
 * override first, then the stored toggle, and nothing at all on a connection without a
 * tools API. Shared with callers that need it before `resolveGenerationTools` runs.
 */
export function resolveChatToolsEnabled(args: {
  requestBody: Record<string, unknown>;
  chatMetadata: Record<string, unknown>;
  nativeToolsAvailable: boolean;
}): boolean {
  if (!args.nativeToolsAvailable) return false;
  if (args.requestBody.enableTools === true) return true;
  return !booleanFalseText(args.chatMetadata.enableTools) && booleanText(args.chatMetadata.enableTools);
}

function parseExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    return typeof extra === "string" ? JSON.parse(extra) : (extra as Record<string, unknown>);
  } catch {
    return {};
  }
}

function parseSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "string") {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
}

function booleanText(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1;
}

function booleanFalseText(value: unknown): boolean {
  return value === false || value === "false" || value === "0" || value === 0;
}

/**
 * Force To Call is a Function Calling panel setting, and the panel hides it whenever
 * "Enable Tool Use" is off — so a chat can hold a stale `forceToolCall` the user can
 * neither see nor clear. It only means anything while that toggle is on: a tool the
 * engine attached by itself (Game Mode's dice) must never be forced by it, or every
 * game turn would open with a roll the scene did not ask for.
 */
export function resolveMainGenerationToolChoice(args: {
  chatMetadata: Record<string, unknown>;
  enableChatTools: boolean;
  round: number;
}): "auto" | "required" {
  const forced = args.round === 0 && args.enableChatTools && booleanText(args.chatMetadata.forceToolCall);
  return forced ? "required" : "auto";
}

function isSpotifyMusicAgent(agent: ResolvedAgent): boolean {
  const settings = parseSettings(agent.settings);
  return (
    agent.type === "spotify" &&
    settings.musicProvider !== "youtube" &&
    settings.musicPlayerSource !== "youtube" &&
    settings.musicProvider !== "custom" &&
    settings.musicPlayerSource !== "custom"
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

function joinNonEmpty(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n");
}

function buildCustomToolHiddenContext(args: {
  requestBody: Record<string, unknown>;
  chatId: string;
  chatMetadata: Record<string, unknown>;
  promptCharacterIds: string[];
  personaId: string | null;
  agentContext: AgentContext;
  gameState: unknown;
}): CustomToolHiddenContext {
  const characters = args.agentContext.characters.map((character) => ({
    id: character.id,
    name: character.name,
  }));
  const characterNamesById = new Map(characters.map((character) => [character.id, character.name]));
  const requestedCharacterId =
    typeof args.requestBody.forCharacterId === "string" && args.requestBody.forCharacterId.trim()
      ? args.requestBody.forCharacterId.trim()
      : null;
  const primaryCharacterId =
    requestedCharacterId && args.promptCharacterIds.includes(requestedCharacterId)
      ? requestedCharacterId
      : (args.promptCharacterIds[0] ?? null);
  const characterIds = args.promptCharacterIds;
  const characterNames = characterIds.map((id) => characterNamesById.get(id) ?? id);
  const personaName = args.agentContext.persona?.name ?? null;
  const primaryCharacterName = primaryCharacterId ? (characterNamesById.get(primaryCharacterId) ?? null) : null;
  const primaryCharacter =
    (primaryCharacterId
      ? args.agentContext.characters.find((character) => character.id === primaryCharacterId)
      : null) ??
    args.agentContext.characters[0] ??
    null;
  const personaFields = args.agentContext.persona
    ? joinNonEmpty([
        args.agentContext.persona.description,
        args.agentContext.persona.personality,
        args.agentContext.persona.backstory,
        args.agentContext.persona.appearance,
        args.agentContext.persona.scenario,
      ])
    : "";
  const lastInput =
    [...args.agentContext.recentMessages].reverse().find((message) => message.role === "user")?.content ?? "";
  const now = new Date();
  const timeZone = resolveConversationTimeZone(args.chatMetadata);
  const zonedNow = getZonedDateParts(now, timeZone);
  const zonedDate = `${zonedNow.year}-${String(zonedNow.month).padStart(2, "0")}-${String(zonedNow.day).padStart(2, "0")}`;

  return {
    chatId: args.chatId,
    chatMode: args.agentContext.chatMode,
    personaId: args.personaId,
    personaName,
    characterId: primaryCharacterId,
    characterName: primaryCharacterName,
    characterIds,
    characterNames,
    characters,
    variables: stringRecord(args.chatMetadata.agentVariables),
    macros: {
      chatId: args.chatId,
      chatMode: args.agentContext.chatMode,
      personaId: args.personaId,
      user: personaName ?? "",
      userName: personaName ?? "",
      persona: personaFields,
      characterId: primaryCharacterId ?? "",
      characterName: primaryCharacterName ?? "",
      char: primaryCharacterName ?? "",
      charName: primaryCharacterName ?? "",
      characters: characterNames.join(", "),
      description: primaryCharacter?.description ?? "",
      personality: primaryCharacter?.personality ?? "",
      backstory: primaryCharacter?.backstory ?? "",
      appearance: primaryCharacter?.appearance ?? "",
      scenario: primaryCharacter?.scenario ?? "",
      example: primaryCharacter?.mesExample ?? "",
      charSysInfo: primaryCharacter?.systemPrompt ?? "",
      charPostHistory: primaryCharacter?.postHistoryInstructions ?? "",
      input: lastInput,
      date: zonedDate,
      time: formatZonedConversationTime(now, timeZone),
      datetime: now.toISOString(),
      isotime: now.toISOString(),
      weekday: zonedNow.weekday,
    },
    recentMessages: args.agentContext.recentMessages.map((message) => ({
      id: message.id ?? null,
      role: message.role,
      characterId: message.characterId ?? null,
    })),
    gameState: args.gameState ?? null,
  };
}

function validateToolSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("parametersSchema must be a JSON object");
  }

  const schemaObject = schema as Record<string, unknown>;
  const schemaType = schemaObject.type;
  const schemaProperties = schemaObject.properties;
  const schemaRequired = schemaObject.required;

  if (schemaType !== undefined && schemaType !== "object") {
    throw new Error('parametersSchema root "type" must be "object"');
  }
  if (schemaType === undefined) {
    schemaObject.type = "object";
  }
  if (
    schemaProperties !== undefined &&
    (!schemaProperties || typeof schemaProperties !== "object" || Array.isArray(schemaProperties))
  ) {
    throw new Error('parametersSchema "properties" must be an object');
  }
  if (schemaProperties === undefined) {
    schemaObject.properties = {};
  }
  if (
    schemaRequired !== undefined &&
    (!Array.isArray(schemaRequired) || schemaRequired.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error('parametersSchema "required" must be an array of strings');
  }
  const normalizedProperties = schemaObject.properties as Record<string, unknown>;
  for (const [name, prop] of Object.entries(normalizedProperties)) {
    validateParameterProperty(prop, `properties.${name}`);
  }

  return schemaObject;
}

const VALID_PARAMETER_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object", "null"]);

function validateParameterProperty(prop: unknown, path: string): void {
  if (!prop || typeof prop !== "object" || Array.isArray(prop)) {
    throw new Error(`parametersSchema ${path} must be an object`);
  }
  const record = prop as Record<string, unknown>;
  if (record.type !== undefined && (typeof record.type !== "string" || !VALID_PARAMETER_TYPES.has(record.type))) {
    throw new Error(`parametersSchema ${path}.type must be a valid JSON Schema primitive type`);
  }
  if (record.enum !== undefined && !Array.isArray(record.enum)) {
    throw new Error(`parametersSchema ${path}.enum must be an array`);
  }
  if (record.required !== undefined) {
    if (!Array.isArray(record.required) || record.required.some((entry) => typeof entry !== "string")) {
      throw new Error(`parametersSchema ${path}.required must be an array of strings`);
    }
  }
  if (record.items !== undefined) {
    validateParameterProperty(record.items, `${path}.items`);
  }
  if (record.properties !== undefined) {
    if (!record.properties || typeof record.properties !== "object" || Array.isArray(record.properties)) {
      throw new Error(`parametersSchema ${path}.properties must be an object`);
    }
    for (const [name, nested] of Object.entries(record.properties as Record<string, unknown>)) {
      validateParameterProperty(nested, `${path}.properties.${name}`);
    }
  }
}

/**
 * Appends every registered package tool that does not collide with a name already spoken for.
 *
 * The collision map is the authority: `executeToolCalls` resolves a call built-in first, then
 * custom, then package, so a package tool must lose the same way here. Otherwise the model would
 * be shown one tool's schema and a different owner's handler would run.
 */
function appendPackageToolDefs(
  allToolDefs: LLMToolDefinition[],
  registeredToolSources: Map<string, "built-in" | "custom" | "package">,
  nativeToolsAvailable: boolean,
): LLMToolDefinition[] {
  if (!nativeToolsAvailable) return [];
  const packageToolDefs = capabilityToolDefs().filter((tool) => {
    const existingSource = registeredToolSources.get(tool.function.name);
    if (existingSource) {
      logger.warn(
        '[tools] Skipping package tool "%s" because it collides with existing %s tool',
        tool.function.name,
        existingSource,
      );
      return false;
    }
    registeredToolSources.set(tool.function.name, "package");
    return true;
  });
  allToolDefs.push(...packageToolDefs);
  return packageToolDefs;
}

async function loadToolDefinitions(args: {
  customToolsStore: CustomToolsStore;
  resolveTools: boolean;
  enableChatTools: boolean;
  nativeToolsAvailable: boolean;
  activeToolIds: string[];
  autoAttachToolNames: readonly string[];
}): Promise<{
  toolDefs: LLMToolDefinition[] | undefined;
  allToolDefs: LLMToolDefinition[];
  customToolDefs: CustomToolDef[];
}> {
  let toolDefs: LLMToolDefinition[] | undefined;
  const allToolDefs: LLMToolDefinition[] = [];
  const customToolDefs: CustomToolDef[] = [];

  const registeredToolSources = new Map<string, "built-in" | "custom" | "package">();
  if (!args.resolveTools && (!args.nativeToolsAvailable || capabilityToolDefs().length === 0)) {
    return { toolDefs, allToolDefs, customToolDefs };
  }
  const enabledCustomTools = await args.customToolsStore.listEnabled();

  // A package's tools are attached even when every built-in and custom tool is switched off: the
  // user's tool switches are about the Engine's tools, not about whether an installed package can
  // do its job. Built-in names are still reserved here so the definition the model is shown always
  // belongs to whoever will actually execute the call.
  if (!args.resolveTools) {
    for (const tool of BUILT_IN_TOOLS) registeredToolSources.set(tool.name, "built-in");
    for (const tool of enabledCustomTools) {
      if (!registeredToolSources.has(tool.name)) registeredToolSources.set(tool.name, "custom");
    }
    const packageOnlyToolDefs = appendPackageToolDefs(allToolDefs, registeredToolSources, args.nativeToolsAvailable);
    return {
      toolDefs: packageOnlyToolDefs.length > 0 ? packageOnlyToolDefs : toolDefs,
      allToolDefs,
      customToolDefs,
    };
  }

  for (const tool of BUILT_IN_TOOLS) {
    const existingSource = registeredToolSources.get(tool.name);
    if (existingSource) {
      throw new Error(
        `Duplicate tool name "${tool.name}" from built-in tool collides with existing ${existingSource} tool`,
      );
    }
    registeredToolSources.set(tool.name, "built-in");
    allToolDefs.push({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    });
  }

  for (const customTool of enabledCustomTools) {
    const existingSource = registeredToolSources.get(customTool.name);
    if (existingSource) {
      logger.warn(
        '[tools] Skipping custom tool "%s" because it collides with existing %s tool',
        customTool.name,
        existingSource,
      );
      continue;
    }
    registeredToolSources.set(customTool.name, "custom");

    try {
      const parsedSchema =
        typeof customTool.parametersSchema === "string"
          ? JSON.parse(customTool.parametersSchema)
          : customTool.parametersSchema;
      const schemaObject = validateToolSchema(parsedSchema);

      customToolDefs.push({
        name: customTool.name,
        executionType: customTool.executionType,
        webhookUrl: customTool.webhookUrl,
        staticResult: customTool.staticResult,
        scriptBody: customTool.scriptBody,
        includeHiddenContext: booleanText(customTool.includeHiddenContext),
        validateArguments: createCustomToolArgumentsValidator(schemaObject),
      });

      allToolDefs.push({
        type: "function" as const,
        function: {
          name: customTool.name,
          description: customTool.description,
          parameters: schemaObject,
        },
      });
    } catch (error) {
      // Keep enabled custom names reserved even if their schema needs repair.
      // Fixing a schema must not silently switch this name to a package handler.
      logger.warn(
        error,
        '[tools] Skipping custom tool "%s" with invalid parameter schema: %s',
        customTool.name,
        String(customTool.parametersSchema),
      );
    }
  }

  toolDefs = resolveChatToolDefs({
    allToolDefs,
    enableChatTools: args.enableChatTools,
    activeToolIds: args.activeToolIds,
    autoAttachToolNames: args.autoAttachToolNames,
  });

  const packageToolDefs = appendPackageToolDefs(allToolDefs, registeredToolSources, args.nativeToolsAvailable);
  if (packageToolDefs.length > 0) {
    toolDefs = [...(toolDefs ?? []), ...packageToolDefs];
  }

  return { toolDefs, allToolDefs, customToolDefs };
}

function resolveAgentWritableLorebookId(agentSettings: Record<string, unknown>): string | null {
  const enabledTools = Array.isArray(agentSettings.enabledTools) ? agentSettings.enabledTools : [];
  const lorebookWriteEnabled =
    agentSettings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry");
  if (!lorebookWriteEnabled) return null;
  for (const key of ["writableLorebookId", "targetLorebookId"]) {
    const value = agentSettings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const writableIds = agentSettings.writableLorebookIds;
  if (Array.isArray(writableIds)) {
    const first = writableIds.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (first) return first.trim();
  }
  return null;
}

/**
 * Fallback for callers without a generation target. Main generation and retries
 * supply their captured source refs, including the assistant's immutable swipe.
 */
function resolveLorebookWriterSourceRefs(agentContext: AgentContext): SourceMessageRef[] {
  for (let i = agentContext.recentMessages.length - 1; i >= 0; i--) {
    const message = agentContext.recentMessages[i];
    if (!message) continue;
    if (message.role === "user" && message.id) return [{ id: message.id, swipeIndex: null }];
  }
  return [];
}

function createLorebookEntryWriter(
  lorebooksStore: LorebooksStore,
  agent: ResolvedAgent,
  agentSettings: Record<string, unknown>,
  options: {
    requireApproval: boolean;
    chatId: string;
    sourceMessageRefs: () => SourceMessageRef[];
    onWrite: (entry: any) => void;
  },
) {
  const writableLorebookId = resolveAgentWritableLorebookId(agentSettings);
  if (!writableLorebookId) return undefined;
  const writtenEntryIds = new Set<string>();

  return async (entry: {
    name: string;
    content: string;
    description?: string;
    keys: string[];
    tag?: string;
    mode: "create" | "replace" | "append";
  }) => {
    // When agent write-approval is required, never write inline — surface a proposal
    // envelope (mirroring the structured lorebook_update gate) so the user approves
    // the write before it touches the lorebook DB.
    if (options.requireApproval) {
      const existingEntries = await lorebooksStore.listEntries(writableLorebookId).catch(() => []);
      return {
        requiresApproval: true,
        approval: buildLorebookWriteApprovalProposal({
          chatId: options.chatId,
          agentType: agent.type,
          agentName: agent.name ?? agent.type,
          updates: [
            {
              action: entry.mode === "create" ? "create" : "update",
              name: entry.name,
              content: entry.content,
              description: entry.description ?? "",
              keys: entry.keys,
              tag: entry.tag ?? "",
              mode: entry.mode,
            },
          ],
          preferredTargetLorebookId: writableLorebookId,
          writableLorebookIds: [writableLorebookId],
          existingEntries,
          sourceAgentId: agent.id,
          sourceMessageRefs: options.sourceMessageRefs(),
        }),
      };
    }

    const targetLorebook = await lorebooksStore.getById(writableLorebookId);
    if (!targetLorebook) {
      return { error: "Selected lorebook is no longer available.", lorebookId: writableLorebookId };
    }

    const existingEntries = await lorebooksStore.listEntries(writableLorebookId);
    const normalizedName = entry.name.trim().toLocaleLowerCase();
    const existing = existingEntries.find(
      (candidate: any) =>
        typeof candidate.name === "string" && candidate.name.trim().toLocaleLowerCase() === normalizedName,
    ) as any;
    const keys = Array.from(new Set(entry.keys.map((key) => key.trim()).filter(Boolean)));

    if (existing && entry.mode === "create") {
      return {
        applied: false,
        action: "exists",
        lorebookId: writableLorebookId,
        lorebookName: (targetLorebook as any).name,
        entryId: existing.id,
        name: entry.name,
        sourceAgentId: agent.id,
      };
    }

    if (!existing) {
      const created = await lorebooksStore.createEntry({
        lorebookId: writableLorebookId,
        name: entry.name,
        content: entry.content,
        description: entry.description ?? "",
        keys,
        tag: entry.tag ?? "",
        enabled: true,
        constant: false,
        selective: false,
        position: 0,
        depth: 4,
        role: "system",
        sourceAgentId: agent.id,
        sourceMessageRefs: options.sourceMessageRefs(),
      });
      options.onWrite(created);
      if (created?.id) writtenEntryIds.add(created.id);
      return {
        applied: true,
        action: "created",
        lorebookId: writableLorebookId,
        lorebookName: (targetLorebook as any).name,
        entryId: (created as any)?.id ?? null,
        name: entry.name,
        sourceAgentId: agent.id,
      };
    }

    const existingContent = typeof existing.content === "string" ? existing.content : "";
    const nextContent =
      entry.mode === "append" && existingContent.trim()
        ? existingContent.includes(entry.content)
          ? existingContent
          : `${existingContent.trim()}\n\n${entry.content}`
        : entry.content;
    const existingKeys = Array.isArray(existing.keys)
      ? existing.keys.filter((key: unknown): key is string => typeof key === "string")
      : [];
    const updated = await lorebooksStore.updateEntry(existing.id, {
      content: nextContent,
      description: entry.description ?? existing.description ?? "",
      keys: Array.from(new Set([...existingKeys, ...keys])),
      ...(entry.tag !== undefined ? { tag: entry.tag } : {}),
      enabled: true,
      sourceAgentId: agent.id,
      sourceMessageRefs: options.sourceMessageRefs(),
      preserveProvenanceSnapshot: writtenEntryIds.has(existing.id),
    });
    options.onWrite(updated);
    if (updated?.id) writtenEntryIds.add(updated.id);
    return {
      applied: true,
      action: entry.mode === "append" ? "appended" : "replaced",
      lorebookId: writableLorebookId,
      lorebookName: (targetLorebook as any).name,
      entryId: (updated as any)?.id ?? existing.id,
      name: entry.name,
      sourceAgentId: agent.id,
    };
  };
}

function resetSpotifyAgentRuntime(agent: ResolvedAgent): void {
  const spotifyAgent = agent as SpotifyRuntimeAgent;
  spotifyAgent.__spotifyToolCalls = new Set<string>();
  spotifyAgent.__spotifyPlayApplied = false;
  spotifyAgent.__spotifyPlayError = null;
  spotifyAgent.__spotifyToolError = null;
  spotifyAgent.__spotifyPlaybackPending = false;
  spotifyAgent.__spotifyPlayUris = [];
  spotifyAgent.__spotifyCandidateTracks = [];
  spotifyAgent.__spotifyCurrentAfterPlayUri = null;
  spotifyAgent.__spotifyCurrentBeforePlayUri = null;
  spotifyAgent.__spotifyRepeatAfterPlayState = null;
  spotifyAgent.__spotifyPlayDisplay = null;
  spotifyAgent.__spotifyPlayReason = null;
  spotifyAgent.__spotifyQueued = null;
  spotifyAgent.__spotifyDevice = null;
}

async function attachSpotifyCurrentPlaybackContext(args: {
  agentContext: AgentContext;
  resolvedAgents: ResolvedAgent[];
  spotify: { accessToken: string } | undefined;
}): Promise<void> {
  delete args.agentContext.memory._spotifyDjCurrentPlayback;
  if (!args.spotify || !args.resolvedAgents.some(isSpotifyMusicAgent)) return;
  try {
    const results = await executeToolCalls(
      [
        {
          id: "spotify-dj-current-playback",
          type: "function",
          function: { name: "spotify_get_current_playback", arguments: "{}" },
        },
      ],
      { spotify: args.spotify },
    );
    const raw = results[0]?.result;
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args.agentContext.memory._spotifyDjCurrentPlayback = parsed;
    }
  } catch (error) {
    logger.debug(error, "[spotify] Failed to preload Music DJ current playback context");
  }
}

async function resolveToolRuntime(
  {
    requestBody,
    chatId,
    chatMetadata,
    chats,
    agentsStore,
    customToolsStore,
    lorebooksStore,
    resolvedAgents,
    enabledConfigs,
    promptCharacterIds,
    lorebookCharacterIds,
    personaId,
    activeLorebookIds,
    excludedLorebookIds,
    excludedSourceAgentIds,
    gameState,
    gameSpotifyMusicEnabled,
    agentContext,
    emitMetadataPatch,
    observeSpotifyPlaybackBeforePlay,
    lorebookEmbeddingOptions,
    nativeToolsAvailable = true,
    getLorebookSourceMessageRefs,
  }: ResolveAgentGenerationToolsArgs,
  options: {
    enableChatTools: boolean;
    autoAttachToolNames: readonly string[];
    preloadSpotifyPlayback: boolean;
    restoreSpotifyAgentDefaultTools: boolean;
  },
): Promise<ResolvedGenerationTools> {
  const { autoAttachToolNames, enableChatTools } = options;
  const spotifyToolNames = new Set(DEFAULT_AGENT_TOOLS.spotify ?? []);
  for (const agent of resolvedAgents) {
    const agentSettings = parseSettings(agent.settings);
    const agentEnabledNames = Array.isArray(agentSettings.enabledTools) ? (agentSettings.enabledTools as string[]) : [];
    if (
      options.restoreSpotifyAgentDefaultTools &&
      isSpotifyMusicAgent(agent) &&
      agentEnabledNames.length === 0 &&
      spotifyToolNames.size > 0
    ) {
      agent.settings = { ...agentSettings, enabledTools: [...spotifyToolNames] };
    }
  }
  const enableAgentTools = resolvedAgents.some((agent) => {
    const agentSettings = parseSettings(agent.settings);
    return Array.isArray(agentSettings.enabledTools) && agentSettings.enabledTools.length > 0;
  });
  const activeToolIds = readChatActiveToolIds(chatMetadata);
  const { allToolDefs, customToolDefs, ...loadedTools } = await loadToolDefinitions({
    customToolsStore,
    resolveTools: enableChatTools || enableAgentTools || autoAttachToolNames.length > 0,
    enableChatTools,
    nativeToolsAvailable,
    activeToolIds,
    autoAttachToolNames,
  });
  let toolDefs = loadedTools.toolDefs;

  // Convo-only tools are stripped in every other mode — the real enforcement of
  // update_about_me's Conversation-only scope (the UI filter is cosmetic).
  if (toolDefs && agentContext.chatMode !== "conversation") {
    toolDefs = toolDefs.filter((toolDef) => !CONVERSATION_ONLY_TOOL_NAMES.has(toolDef.function.name));
  }
  if (toolDefs && agentContext.chatMode === "game" && !booleanText(chatMetadata.gameLorebookSearch)) {
    toolDefs = toolDefs.filter((toolDef) => toolDef.function.name !== "search_lorebook");
  }

  const resolvedToolNames = new Set(allToolDefs.map((toolDef) => toolDef.function.name));
  let chatResolvedToolNames = new Set((toolDefs ?? []).map((toolDef) => toolDef.function.name));
  const agentResolvedSpotifyToolGroups = resolvedAgents.map((agent) => {
    const agentSettings = parseSettings(agent.settings);
    const agentEnabledNames = Array.isArray(agentSettings.enabledTools) ? (agentSettings.enabledTools as string[]) : [];
    return agentEnabledNames.filter((name) => resolvedToolNames.has(name));
  });
  const spotifyAvailabilityRequest = resolveSpotifyToolAvailabilityRequest({
    enableChatTools,
    hasChatToolFilter: activeToolIds.length > 0,
    chatResolvedToolNames,
    agentResolvedToolNameGroups: agentResolvedSpotifyToolGroups,
    spotifyToolNames,
  });
  const spotifyAgentId =
    resolvedAgents.find((agent) => agent.type === "spotify" && !agent.id.startsWith("builtin:"))?.id ??
    enabledConfigs.find((cfg: any) => cfg.type === "spotify")?.id ??
    null;
  const spotifyCredentials = spotifyAvailabilityRequest.needsSpotifyCredentials
    ? await resolveSpotifyCredentials(agentsStore as any, { agentId: spotifyAgentId, refreshSkewMs: 60_000 })
    : null;
  if (spotifyCredentials && !("accessToken" in spotifyCredentials)) {
    logger.debug("[spotify] credentials unavailable for tool execution: %s", spotifyCredentials.error);
  }
  const spotifyCreds =
    spotifyCredentials && "accessToken" in spotifyCredentials
      ? { accessToken: spotifyCredentials.accessToken }
      : undefined;
  const spotifyToolsAvailable = Boolean(
    spotifyCredentials &&
    "accessToken" in spotifyCredentials &&
    spotifyHasScope(spotifyCredentials.scopes, "user-modify-playback-state"),
  );
  if (!spotifyToolsAvailable && toolDefs) {
    const beforeCount = toolDefs.length;
    toolDefs = toolDefs.filter((toolDef) => !spotifyToolNames.has(toolDef.function.name));
    chatResolvedToolNames = new Set((toolDefs ?? []).map((toolDef) => toolDef.function.name));
    if (beforeCount !== toolDefs.length && spotifyAvailabilityRequest.shouldLogUnavailableToolOmission) {
      logger.debug("[spotify] Omitted unavailable Spotify tools from main generation");
    }
  }

  const searchLorebookForTools = async (query: string, category?: string | null, requireVectors = false) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const entries = await lorebooksStore.listActiveEntries({
      chatId,
      characterIds: resolveToolLorebookCharacterIds(promptCharacterIds, lorebookCharacterIds),
      personaId,
      activeLorebookIds,
      excludedLorebookIds,
      excludedSourceAgentIds,
    });
    const eligible = entries.filter(
      (entry: any) =>
        (!category || entry.tag === category) &&
        (chatMetadata.entryStateOverrides as Record<string, { enabled?: boolean }> | undefined)?.[entry.id]?.enabled !==
          false,
    );
    const vectorized = eligible.filter(
      (entry: any) => !entry.excludeFromVectorization && Array.isArray(entry.embedding) && entry.embedding.length > 0,
    );
    const toResult = (entry: any, similarity?: number) => ({
      name: entry.name,
      content: entry.content,
      tag: entry.tag,
      keys: entry.keys as string[],
      ...(similarity === undefined ? {} : { similarity }),
    });
    // Literal hits remain searchable while vectors are missing, stale, or deliberately excluded.
    const results = new Map(
      eligible
        .filter((entry: any) =>
          [entry.name, entry.content, ...(Array.isArray(entry.keys) ? entry.keys : [])].some(
            (value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery),
          ),
        )
        .map((entry: any) => [entry.id, toResult(entry)]),
    );
    if (vectorized.length) {
      try {
        const matches = await semanticShortlistLorebookEntries(vectorized, query, {
          ...lorebookEmbeddingOptions,
          topK: 20,
        });
        if (matches) {
          // A low calibrated floor rejects noise without inheriting automatic-activation limits.
          for (const { entry, similarity } of matches) {
            if (similarity >= LORE_SEARCH_MIN_SIMILARITY) results.set(entry.id, toResult(entry, similarity));
          }
          return [...results.values()].slice(0, 20);
        }
        if (requireVectors)
          throw new Error(
            "Lore search embeddings are unavailable or incompatible. Check the embedding connection and re-vectorize the lorebook.",
          );
      } catch (err) {
        if (requireVectors) throw err;
        logger.warn(err, "[lore-search] Semantic search unavailable; using text matches");
      }
    } else if (requireVectors) {
      throw new Error(
        "No vectorized lore entries are available. Vectorize an enabled lorebook before using Game lore search.",
      );
    }
    return [...results.values()].slice(0, 20);
  };

  const updateChatMetadataForTools = async (patchOrUpdater: MetadataPatchInput): Promise<MetadataPatch> => {
    let emittedPatch: Record<string, unknown> = {};
    const updatedChat = await chats.patchMetadata(chatId, async (currentMeta) => {
      const patch = typeof patchOrUpdater === "function" ? await patchOrUpdater({ ...currentMeta }) : patchOrUpdater;
      emittedPatch = patch;
      return patch;
    });
    const hasUpdatedMetadata = updatedChat && Object.prototype.hasOwnProperty.call(updatedChat, "metadata");
    const updatedMeta = hasUpdatedMetadata ? parseExtra(updatedChat.metadata) : { ...chatMetadata, ...emittedPatch };
    if (hasUpdatedMetadata) {
      for (const key of Object.keys(chatMetadata)) {
        if (!(key in updatedMeta)) {
          delete chatMetadata[key];
        }
      }
    }
    Object.assign(chatMetadata, updatedMeta);
    agentContext.chatSummary =
      shouldAttachSummariesToAgents(agentContext.chatMode, chatMetadata) &&
      typeof chatMetadata.summary === "string" &&
      chatMetadata.summary.trim()
        ? chatMetadata.summary.trim()
        : null;
    emitMetadataPatch(emittedPatch);
    return updatedMeta;
  };

  const replaceChatMessageContent = async (input: {
    messageId: string;
    content: string;
    reason?: string;
  }): Promise<Record<string, unknown>> => {
    const message = await chats.getMessage(input.messageId);
    if (!message || message.chatId !== chatId) {
      return { error: "Message not found in this chat.", messageId: input.messageId };
    }
    if (message.role !== "user" && message.role !== "assistant") {
      return { error: "Only user or assistant messages can be edited.", messageId: input.messageId };
    }
    await chats.updateMessageContent(input.messageId, input.content);
    return {
      applied: true,
      messageId: input.messageId,
      role: message.role,
      reason: input.reason ?? null,
    };
  };

  const baseToolExecutionContext: ToolExecutionContext = {
    chatId,
    gameState: gameState ? (gameState as Record<string, unknown>) : undefined,
    hiddenContext: buildCustomToolHiddenContext({
      requestBody,
      chatId,
      chatMetadata,
      promptCharacterIds,
      personaId,
      agentContext,
      gameState,
    }),
    customTools: customToolDefs,
    spotify: spotifyCreds,
    spotifyRepeatAfterPlay: gameSpotifyMusicEnabled ? "track" : undefined,
    searchLorebook: (query, category) => searchLorebookForTools(query, category, agentContext.chatMode === "game"),
    chatMeta: chatMetadata,
    onUpdateMetadata: updateChatMetadataForTools,
  };

  if (options.preloadSpotifyPlayback) {
    await attachSpotifyCurrentPlaybackContext({
      agentContext,
      resolvedAgents,
      spotify: spotifyCreds,
    });
  }

  const pendingLorebookWrites = new Map<string, () => Promise<unknown>>();
  for (const agent of resolvedAgents) {
    if (agent.toolContext) continue;

    const agentSettings = parseSettings(agent.settings);
    const agentEnabledNames = Array.isArray(agentSettings.enabledTools) ? (agentSettings.enabledTools as string[]) : [];
    if (agentEnabledNames.length === 0) continue;

    const allowSpotifyAgentTools = agent.type === "spotify";
    const agentTools = allToolDefs.filter(
      (toolDef) =>
        agentEnabledNames.includes(toolDef.function.name) &&
        (toolDef.function.name !== "edit_chat_message" || customAgentHasCapability(agentSettings, "edit_messages")) &&
        (spotifyToolsAvailable || !spotifyToolNames.has(toolDef.function.name) || allowSpotifyAgentTools),
    );
    if (agentTools.length === 0) continue;

    const allowedToolNames = new Set(agentTools.map((toolDef) => toolDef.function.name));
    const sourceMessageRefs = () =>
      getLorebookSourceMessageRefs?.(agent) ?? resolveLorebookWriterSourceRefs(agentContext);
    const saveLorebookEntry = createLorebookEntryWriter(lorebooksStore, agent, agentSettings, {
      requireApproval: agentWriteApprovalRequired(chatMetadata),
      chatId,
      sourceMessageRefs,
      onWrite: (entry) => {
        if (!entry?.id || typeof entry.updatedAt !== "string") return;
        pendingLorebookWrites.set(entry.id, () =>
          lorebooksStore.updateEntry(
            entry.id,
            {
              sourceAgentId: agent.id,
              sourceMessageRefs: sourceMessageRefs(),
            },
            {
              sourceAgentId: agent.id,
              sourceMessageRefs: entry.sourceMessageRefs,
              updatedAt: entry.updatedAt,
              content: entry.content,
            },
          ),
        );
      },
    });
    const replaceChatMessageContentForAgent = customAgentHasCapability(agentSettings, "edit_messages")
      ? replaceChatMessageContent
      : undefined;
    if (agent.type === "spotify") {
      resetSpotifyAgentRuntime(agent);
    }

    agent.toolContext = {
      tools: agentTools,
      executeToolCall: async (call) => {
        if (agent.type === "spotify") {
          ((agent as SpotifyRuntimeAgent).__spotifyToolCalls ??= new Set<string>()).add(call.function.name);
        }
        if (!allowedToolNames.has(call.function.name)) {
          return JSON.stringify({
            error: `Tool not allowed for agent ${agent.type}: ${call.function.name}`,
            allowed: Array.from(allowedToolNames),
          });
        }
        const executionContext = {
          ...baseToolExecutionContext,
          // Existing Agent tools keep their text fallback when no vectors are available.
          searchLorebook: searchLorebookForTools,
          saveLorebookEntry,
          replaceChatMessageContent: replaceChatMessageContentForAgent,
        };
        const spotifyAgent = agent as SpotifyRuntimeAgent;
        if (observeSpotifyPlaybackBeforePlay && agent.type === "spotify" && call.function.name === "spotify_play") {
          const beforeRaw = await executeToolCallForModel(
            {
              id: `spotify-before-play-${Date.now()}`,
              type: "function",
              function: { name: "spotify_get_current_playback", arguments: "{}" },
            },
            executionContext,
          );
          try {
            spotifyAgent.__spotifyCurrentBeforePlayUri = readSpotifyPlaybackTrackUri(JSON.parse(beforeRaw));
          } catch {
            spotifyAgent.__spotifyCurrentBeforePlayUri = null;
          }
        }
        const result = await executeToolCallForModel(call, executionContext);
        if (agent.type === "spotify" && call.function.name === "spotify_play") {
          try {
            const parsed = JSON.parse(result) as Record<string, unknown>;
            if (typeof parsed.error === "string") {
              spotifyAgent.__spotifyToolError = parsed.error;
            }
            if (parsed.applied === true) {
              spotifyAgent.__spotifyPlayApplied = true;
              spotifyAgent.__spotifyPlayError = null;
              spotifyAgent.__spotifyPlaybackPending = parsed.playbackPending === true;
              spotifyAgent.__spotifyPlayUris = readSpotifyTrackUris(parsed);
              spotifyAgent.__spotifyCurrentAfterPlayUri = readSpotifyPlaybackTrackUri(parsed);
              spotifyAgent.__spotifyRepeatAfterPlayState =
                readSpotifyStringField(parsed, "repeatState") || readSpotifyStringField(parsed, "repeat") || null;
              spotifyAgent.__spotifyPlayDisplay = readSpotifyStringField(parsed, "display") || null;
              spotifyAgent.__spotifyPlayReason = readSpotifyStringField(parsed, "reason") || null;
              spotifyAgent.__spotifyQueued = readSpotifyNumberField(parsed, "queued");
              spotifyAgent.__spotifyDevice = readSpotifyStringField(parsed, "device") || null;
            } else if (typeof parsed.error === "string") {
              spotifyAgent.__spotifyPlayError = parsed.error;
            }
          } catch {
            spotifyAgent.__spotifyPlayError = "spotify_play returned an unparseable response";
            // Leave the raw tool result for the model; downstream fallback can now stop instead of replaying.
          }
        } else if (agent.type === "spotify" && spotifyToolNames.has(call.function.name)) {
          try {
            const parsed = JSON.parse(result) as Record<string, unknown>;
            rememberSpotifyCandidateTracks(agent as SpotifyRuntimeAgent, parsed);
            if (typeof parsed.error === "string") {
              (agent as SpotifyRuntimeAgent).__spotifyToolError = parsed.error;
            }
          } catch {
            // Non-JSON Spotify tool results are passed through to the model unchanged.
          }
        }
        return result;
      },
    };
  }

  return {
    enableChatTools,
    // An auto-attach name that resolved to nothing (retired tool, typo) leaves the turn
    // exactly as it was before — no tool loop, no allowlist.
    toolsAttached: enableChatTools || (toolDefs?.length ?? 0) > 0,
    chatResolvedToolNames,
    toolDefs,
    baseToolExecutionContext,
    updateChatMetadataForTools,
    async finalizeLorebookWrites() {
      // Pre/parallel tools can write before the assistant exists. Bind them after save,
      // conditionally, so a later human edit or another agent's write keeps ownership.
      for (const write of pendingLorebookWrites.values()) await write();
      pendingLorebookWrites.clear();
    },
  };
}

export async function resolveAgentGenerationTools(
  args: ResolveAgentGenerationToolsArgs,
): Promise<ResolvedGenerationTools> {
  return resolveToolRuntime(args, {
    enableChatTools: false,
    // Agent retries resolve their own tools from agent settings; mode auto-attach is a
    // main-generation concern and never rides along here.
    autoAttachToolNames: [],
    preloadSpotifyPlayback: false,
    restoreSpotifyAgentDefaultTools: args.gameSpotifyMusicEnabled,
  });
}

export async function resolveGenerationTools(args: ResolveGenerationToolsArgs): Promise<ResolvedGenerationTools> {
  const available = args.nativeToolsAvailable !== false;
  const enableChatTools = resolveChatToolsEnabled({
    requestBody: args.requestBody,
    chatMetadata: args.chatMetadata,
    nativeToolsAvailable: available,
  });
  return resolveToolRuntime(args, {
    enableChatTools,
    autoAttachToolNames: available
      ? [
          ...(args.autoAttachToolNames ?? []),
          ...(args.agentContext.chatMode === "game" && booleanText(args.chatMetadata.gameLorebookSearch)
            ? ["search_lorebook"]
            : []),
        ]
      : args.agentContext.chatMode === "roleplay"
        ? (args.autoAttachToolNames ?? []).filter((name) => name === "roll_dice")
        : [],
    preloadSpotifyPlayback: true,
    restoreSpotifyAgentDefaultTools: true,
  });
}
