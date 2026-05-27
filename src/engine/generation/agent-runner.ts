import {
  BUILT_IN_AGENTS,
  BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultBuiltInAgentSettings,
  type AgentContext,
  type AgentResult,
} from "../contracts/types/agent";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type {
  BaseLLMProvider,
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatMessage,
  LLMToolCall,
  LLMToolDefinition,
} from "../generation-core/llm/base-provider";
import { matchCustomAgentActivation, type ActivationScanMessage } from "../agents-runtime/activation";
import { createAgentPipeline, type AgentInjection, type ResolvedAgent } from "../agents-runtime/pipeline/agent-pipeline";
import type { AgentToolContext } from "../agents-runtime/executor/agent-executor";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import { loadAgentMemory, secretPlotStateFromMemory } from "./agent-memory-runtime";
import {
  boolish,
  hiddenFromAi,
  isRecord,
  parseRecord,
  readString,
  type JsonRecord,
} from "./runtime-records";
import {
  BUILT_IN_TOOL_MAP,
  builtInToolDefinition,
  customToolDefinition,
  customToolExecutor,
  executeBuiltInTool,
  loadCustomTools,
  normalizeToolCall,
  stringifyToolResult,
  type CustomToolRecord,
} from "./tools-runtime";

export interface GenerationAgentRuntimeInput {
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  cadenceMessages?: JsonRecord[];
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  activatedLorebookEntries: Array<{ id: string; name: string; content: string; tag: string }>;
  chatSummary: string | null;
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
  signal?: AbortSignal;
  agentTypes?: Set<string>;
  bypassCustomAgentActivation?: boolean;
}

export interface GenerationAgentRuntime {
  preInjections: AgentInjection[];
  preResults: AgentResult[];
  agentData: Record<string, string>;
  runParallel(): Promise<AgentResult[]>;
  runPost(mainResponse: string): Promise<AgentResult[]>;
}

interface AgentDeps {
  storage: StorageGateway;
  llm: LlmGateway;
  integrations: IntegrationGateway;
}

interface ResolvedAgentsResult {
  agents: ResolvedAgent[];
  skippedResults: AgentResult[];
}

const BUILT_IN_AGENT_TYPES = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));
const ILLUSTRATOR_AGENT_TYPE = "illustrator";
const MAX_ASSISTANT_RUN_INTERVAL = 100;
const MAX_CUSTOM_AGENT_USER_RUN_INTERVAL = 200;
type AutomaticIntervalMessageRole = "assistant" | "user";

interface AutomaticIntervalGate {
  agentId: string;
  agentType: string;
  messageRole: AutomaticIntervalMessageRole;
  includePendingMessage: boolean;
  runInterval: number;
}

function llmProvider(llm: LlmGateway, connectionId: string | null): BaseLLMProvider {
  return {
    maxTokensOverrideValue: null,
    async chatComplete(messages: ChatMessage[], options: ChatCompleteOptions): Promise<ChatCompleteResult> {
      let content = "";
      const requestMessages: LlmMessage[] = messages.map((message) => ({
        role:
          message.role === "system" || message.role === "assistant" || message.role === "tool" ? message.role : "user",
        content: message.content,
        name: typeof message.name === "string" ? message.name : undefined,
        tool_call_id: typeof message.tool_call_id === "string" ? message.tool_call_id : undefined,
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
      }));
      const toolCalls: LLMToolCall[] = [];
      for await (const chunk of llm.stream(
        {
          connectionId,
          model: options.model,
          messages: requestMessages,
          parameters: {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
          tools: options.tools as never,
        },
        options.signal,
      )) {
        if (chunk.type === "token" && chunk.text) {
          content += chunk.text;
          options.onToken?.(chunk.text);
        } else if (chunk.type === "tool_call") {
          const toolCall = normalizeToolCall(chunk.data);
          if (toolCall) toolCalls.push(toolCall);
        }
      }
      return { content, toolCalls };
    },
  };
}

function agentSettings(agent: JsonRecord): Record<string, unknown> {
  return parseRecord(agent.settings);
}

function normalizePhase(agent: JsonRecord): string {
  const phase = readString(agent.phase || agentSettings(agent).phase || "pre_generation");
  return phase.replace(/-/g, "_");
}

async function loadConnection(storage: StorageGateway, connectionId: string | null): Promise<JsonRecord | null> {
  if (!connectionId) return null;
  const connection = await storage.get<JsonRecord>("connections", connectionId);
  return isRecord(connection) ? connection : null;
}

function enabledToolNames(settings: Record<string, unknown>): string[] {
  const value = settings.enabledTools;
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item).trim()).filter(Boolean);
}

function stringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map((item) => readString(item).trim()).filter(Boolean));
}

function chatMetadata(input: GenerationAgentRuntimeInput): JsonRecord {
  return parseRecord(input.chat.metadata);
}

function chatAgentsEnabled(input: GenerationAgentRuntimeInput): boolean {
  if (input.agentTypes && input.agentTypes.size > 0) return true;
  if (chatActiveAgentIds(input).size > 0) return true;
  return boolish(chatMetadata(input).enableAgents, false);
}

function chatActiveAgentIds(input: GenerationAgentRuntimeInput): Set<string> {
  return stringSet(chatMetadata(input).activeAgentIds);
}

function chatToolsEnabled(input: GenerationAgentRuntimeInput): boolean {
  return boolish(chatMetadata(input).enableTools, false);
}

function chatActiveToolIds(input: GenerationAgentRuntimeInput): Set<string> {
  return stringSet(chatMetadata(input).activeToolIds);
}

function activationScanMessages(input: GenerationAgentRuntimeInput): ActivationScanMessage[] {
  return input.storedMessages
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({ content: readString(message.content) }));
}

function isBuiltInAgent(agent: JsonRecord): boolean {
  const type = readString(agent.type || agent.agentType).trim();
  return BUILT_IN_AGENT_TYPES.has(type);
}

function builtInAgentType(agent: JsonRecord): string {
  return readString(agent.type || agent.agentType).trim();
}

function builtInAgentMeta(type: string) {
  return BUILT_IN_AGENTS.find((agent) => agent.id === type) ?? null;
}

function builtInAgentFallback(type: string): JsonRecord | null {
  const meta = builtInAgentMeta(type);
  if (!meta) return null;
  const settings = {
    ...getDefaultBuiltInAgentSettings(type),
    enabledTools: DEFAULT_AGENT_TOOLS[type] ?? [],
  };
  return {
    id: `builtin:${type}`,
    type,
    name: meta.name,
    description: meta.description,
    enabled: true,
    phase: meta.phase,
    connectionId: null,
    promptTemplate: "",
    settings,
  };
}

function positiveInteger(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function automaticIntervalGate(
  input: GenerationAgentRuntimeInput,
  id: string,
  type: string,
  settings: Record<string, unknown>,
  builtInAgent: boolean,
): AutomaticIntervalGate | null {
  if (input.agentTypes && input.agentTypes.size > 0) return null;
  if (type === ILLUSTRATOR_AGENT_TYPE) {
    const fallback = positiveInteger(
      BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[type],
      5,
      MAX_ASSISTANT_RUN_INTERVAL,
    );
    const runInterval = positiveInteger(settings.runInterval, fallback, MAX_ASSISTANT_RUN_INTERVAL);
    return runInterval > 1
      ? {
          agentId: id,
          agentType: type,
          messageRole: "assistant",
          includePendingMessage: true,
          runInterval,
        }
      : null;
  }
  if (!builtInAgent) {
    const runInterval = positiveInteger(settings.runInterval, 1, MAX_CUSTOM_AGENT_USER_RUN_INTERVAL);
    return runInterval > 1
      ? {
          agentId: id,
          agentType: type,
          messageRole: "user",
          includePendingMessage: false,
          runInterval,
        }
      : null;
  }
  return null;
}

function runAgentType(run: JsonRecord): string {
  return readString(run.agentType || run.type).trim();
}

function runAgentId(run: JsonRecord): string {
  return readString(run.agentId || run.agentConfigId).trim();
}

function runMatchesAgent(run: JsonRecord, agentType: string, agentId: string): boolean {
  const type = runAgentType(run);
  if (type) return type === agentType;
  const id = runAgentId(run);
  return !!agentId && id === agentId;
}

function illustratorRunCountsTowardInterval(run: JsonRecord): boolean {
  const resultType = readString(run.resultType).trim();
  if (resultType && resultType !== "image_prompt") return false;
  const data = parseRecord(run.resultData);
  if (boolish(data.parseError, false)) return false;
  if (data.shouldGenerate !== true) return false;
  return readString(data.prompt).trim().length > 0;
}

function messageIndexById(input: GenerationAgentRuntimeInput): Map<string, number> {
  const indexes = new Map<string, number>();
  const messages = input.cadenceMessages ?? input.storedMessages;
  messages.forEach((message, index) => {
    const id = readString(message.id).trim();
    if (id) indexes.set(id, index);
  });
  return indexes;
}

function intervalAnchorRun(
  runs: JsonRecord[],
  input: GenerationAgentRuntimeInput,
  chatId: string,
  agentType: string,
  agentId: string,
): JsonRecord | null {
  const indexes = messageIndexById(input);
  return (
    runs
      .filter((run) => readString(run.chatId).trim() === chatId)
      .filter((run) => runMatchesAgent(run, agentType, agentId))
      .filter((run) => boolish(run.success, false))
      .filter((run) => agentType !== ILLUSTRATOR_AGENT_TYPE || illustratorRunCountsTowardInterval(run))
      .map((run) => ({ run, messageIndex: indexes.get(readString(run.messageId).trim()) ?? -1 }))
      .filter((entry) => entry.messageIndex >= 0)
      .sort((a, b) => b.messageIndex - a.messageIndex || readString(b.run.createdAt).localeCompare(readString(a.run.createdAt)))[0]
      ?.run ?? null
  );
}

function visibleMessagesSinceRun(
  input: GenerationAgentRuntimeInput,
  messageId: string,
  role: AutomaticIntervalMessageRole,
): number | null {
  const messages = input.cadenceMessages ?? input.storedMessages;
  const index = messages.findIndex((message) => readString(message.id).trim() === messageId);
  if (index < 0) return null;
  return messages
    .slice(index + 1)
    .filter((message) => !hiddenFromAi(message))
    .filter((message) => readString(message.role).trim() === role).length;
}

async function automaticIntervalAllowsRun(
  storage: StorageGateway,
  input: GenerationAgentRuntimeInput,
  gate: AutomaticIntervalGate,
): Promise<boolean> {
  const chatId = readString(input.chat.id).trim();
  if (!chatId) return true;
  const lastRun = intervalAnchorRun(
    await storage.list<JsonRecord>("agent-runs"),
    input,
    chatId,
    gate.agentType,
    gate.agentId,
  );
  if (!lastRun) return true;
  const messageId = readString(lastRun.messageId).trim();
  if (!messageId) return true;
  const messagesSince = visibleMessagesSinceRun(input, messageId, gate.messageRole);
  if (messagesSince === null) return true;
  return messagesSince + (gate.includePendingMessage ? 1 : 0) >= gate.runInterval;
}

// Tool-runtime helpers live in ./tools-runtime.ts and are imported above.
// Keep both call sites on that single source of truth when merging upstream.
function buildAgentToolContext(
  deps: Pick<AgentDeps, "storage" | "integrations">,
  input: GenerationAgentRuntimeInput,
  agent: JsonRecord,
  settings: Record<string, unknown>,
  customTools: Map<string, CustomToolRecord>,
): AgentToolContext | undefined {
  if (!chatToolsEnabled(input)) return undefined;
  const scopedToolIds = chatActiveToolIds(input);
  const selectedNames = enabledToolNames(settings).filter((name) => scopedToolIds.size === 0 || scopedToolIds.has(name));
  const selectedBuiltIns = selectedNames
    .map(builtInToolDefinition)
    .filter((tool): tool is LLMToolDefinition => !!tool);
  const selectedCustomTools = selectedNames
    .map((name) => customTools.get(name))
    .filter((tool): tool is CustomToolRecord => !!tool && !BUILT_IN_TOOL_MAP.has(tool.name));
  if (selectedBuiltIns.length === 0 && selectedCustomTools.length === 0) return undefined;

  return {
    tools: [...selectedBuiltIns, ...selectedCustomTools.map(customToolDefinition)],
    executeToolCall: async (call: LLMToolCall) => {
      const toolName = call.function?.name || call.name;
      if (BUILT_IN_TOOL_MAP.has(toolName)) {
        return stringifyToolResult(await executeBuiltInTool(deps, input, agent, call));
      }
      return customToolExecutor(deps.integrations, call, customTools.get(toolName));
    },
  };
}

function skippedDanglingConnectionResult(agent: JsonRecord, connectionId: string): AgentResult {
  const type = readString(agent.type || agent.agentType) || "agent";
  const name = readString(agent.name) || type;
  return {
    agentId: readString(agent.id) || type,
    agentType: type,
    type: "context_injection",
    data: {
      code: "dangling_agent_connection",
      connectionId,
      agentName: name,
    },
    tokensUsed: 0,
    durationMs: 0,
    success: false,
    error: `${name} references an API connection that no longer exists. Marinara skipped this agent for this turn. Open Agent settings and choose a valid connection.`,
  };
}

async function resolveAgents(deps: AgentDeps, input: GenerationAgentRuntimeInput): Promise<ResolvedAgentsResult> {
  if (!chatAgentsEnabled(input)) return { agents: [], skippedResults: [] };
  const scopedAgentIds = chatActiveAgentIds(input);
  const activationMessages = activationScanMessages(input);
  const requestedAgentTypes = input.agentTypes ?? null;
  const explicitAgentTypes = requestedAgentTypes ?? scopedAgentIds;
  const rows = (await deps.storage.list<JsonRecord>("agents")).filter((agent) => {
    const type = builtInAgentType(agent);
    const id = readString(agent.id);
    const requestedExplicitly = requestedAgentTypes && (requestedAgentTypes.has(type) || requestedAgentTypes.has(id));
    const scopedToChat = scopedAgentIds.size > 0 && (scopedAgentIds.has(type) || scopedAgentIds.has(id));
    if (!requestedExplicitly && (!requestedAgentTypes || requestedAgentTypes.size === 0) && type === "lorebook-keeper") {
      return false;
    }
    if (requestedAgentTypes && requestedAgentTypes.size > 0) return Boolean(requestedExplicitly);
    if (scopedAgentIds.size > 0) return scopedToChat;
    return boolish(agent.enabled, false);
  });
  const resolvedBuiltInTypes = new Set(rows.map(builtInAgentType).filter((type) => BUILT_IN_AGENT_TYPES.has(type)));
  const fallbackRows = [...explicitAgentTypes]
    .filter((type) => BUILT_IN_AGENT_TYPES.has(type))
    .filter((type) => !resolvedBuiltInTypes.has(type))
    .filter((type) => requestedAgentTypes || type !== "lorebook-keeper")
    .map(builtInAgentFallback)
    .filter((agent): agent is JsonRecord => !!agent);
  rows.push(...fallbackRows);
  let customTools: Map<string, CustomToolRecord> | null = null;
  const resolved: ResolvedAgent[] = [];
  const skippedResults: AgentResult[] = [];
  for (const agent of rows) {
    const type = readString(agent.type || agent.agentType) || "agent";
    const id = readString(agent.id) || type;
    const settings = agentSettings(agent);
    const builtInAgent = isBuiltInAgent(agent);
    if (!input.bypassCustomAgentActivation && !builtInAgent) {
      const activation = matchCustomAgentActivation(settings, activationMessages);
      if (activation.configured && !activation.matched) continue;
    }
    const intervalGate = automaticIntervalGate(input, id, type, settings, builtInAgent);
    if (intervalGate && !(await automaticIntervalAllowsRun(deps.storage, input, intervalGate))) {
      continue;
    }
    const requestedConnectionId = readString(agent.connectionId).trim();
    const fallbackConnectionId = readString(input.connection.id).trim() || null;
    const connectionId = requestedConnectionId || fallbackConnectionId;
    let connection: JsonRecord;
    if (requestedConnectionId) {
      const loadedConnection = await loadConnection(deps.storage, requestedConnectionId);
      if (!loadedConnection) {
        skippedResults.push(skippedDanglingConnectionResult(agent, requestedConnectionId));
        continue;
      }
      connection = loadedConnection;
    } else {
      connection = input.connection;
    }
    const model = readString(agent.model).trim() || readString(connection.model).trim();
    if (!model) continue;
    customTools ??= await loadCustomTools(deps.storage);
    resolved.push({
      id: readString(agent.id) || readString(agent.type) || "agent",
      type,
      name: readString(agent.name) || readString(agent.type) || "Agent",
      phase: normalizePhase(agent),
      promptTemplate: readString(agent.promptTemplate),
      connectionId,
      settings,
      provider: llmProvider(deps.llm, connectionId),
      model,
      maxParallelJobs: typeof settings.maxParallelJobs === "number" ? settings.maxParallelJobs : undefined,
      toolContext: buildAgentToolContext(deps, input, agent, settings, customTools),
    });
  }
  return { agents: resolved, skippedResults };
}

type SpotifyDjSourceType = "liked" | "playlist" | "artist" | "any";

function normalizeSpotifyDjSourceType(value: unknown): SpotifyDjSourceType {
  return value === "playlist" || value === "artist" || value === "any" ? value : "liked";
}

function cleanOptionalString(value: unknown): string | null {
  const text = readString(value).trim();
  return text || null;
}

function buildSpotifyDjConstraints(chatMode: string, chatMeta: JsonRecord): Record<string, unknown> {
  const isGame = chatMode === "game";
  const sourceType = normalizeSpotifyDjSourceType(
    isGame ? chatMeta.gameSpotifySourceType : chatMeta.spotifySourceType,
  );
  const playlistId = cleanOptionalString(isGame ? chatMeta.gameSpotifyPlaylistId : chatMeta.spotifyPlaylistId);
  const playlistName = cleanOptionalString(isGame ? chatMeta.gameSpotifyPlaylistName : chatMeta.spotifyPlaylistName);
  const artist = cleanOptionalString(isGame ? chatMeta.gameSpotifyArtist : chatMeta.spotifyArtist);
  const constraints: Record<string, unknown> = {
    mode: isGame ? "game" : "roleplay",
    replaceBuiltInMusic: isGame && chatMeta.gameUseSpotifyMusic === true,
    sourceType,
    playlistId: sourceType === "liked" ? "liked" : sourceType === "playlist" ? playlistId : null,
    playlistName: sourceType === "playlist" ? playlistName : null,
    artist: sourceType === "artist" ? artist : null,
  };

  if (sourceType === "liked") {
    constraints.note =
      "Use the user's Liked Songs first by calling spotify_get_playlist_tracks with playlistId='liked'. Search wider only when no fitting liked track exists.";
  } else if (sourceType === "playlist") {
    constraints.note = playlistId
      ? "Use this configured playlist first by calling spotify_get_playlist_tracks with the provided playlistId. Search wider only if the playlist has no fitting track."
      : "Playlist source is selected, but no playlist ID is configured. Call spotify_get_playlists to inspect available playlists, then fall back to Liked Songs if needed.";
  } else if (sourceType === "artist") {
    constraints.note = artist
      ? `Search around this artist first. Prefer queries using artist:${artist}.`
      : "Artist source is selected, but no artist is configured. Fall back to Liked Songs if needed.";
  } else {
    constraints.note =
      "Spotify catalogue search is allowed. Still inspect current playback first and prefer the user's library when it fits.";
  }

  return constraints;
}

async function buildAgentContext(deps: AgentDeps, input: GenerationAgentRuntimeInput): Promise<AgentContext> {
  const chatId = readString(input.chat.id);
  const chatMode = readString(input.chat.mode || input.chat.chatMode, "roleplay");
  const chatMeta = parseRecord(input.chat.metadata);
  const memoryRows = await Promise.all(
    (await deps.storage.list<JsonRecord>("agents"))
      .filter((agent) => readString(agent.id).trim())
      .map((agent) => loadAgentMemory(deps.storage, readString(agent.id), chatId)),
  );
  const memory = Object.assign({}, ...memoryRows);
  const secretPlotState = secretPlotStateFromMemory(memory);
  if (secretPlotState) memory._secretPlotState = secretPlotState;
  memory._spotifyDjConstraints = buildSpotifyDjConstraints(chatMode, chatMeta);
  return {
    chatId,
    chatMode,
    recentMessages: input.storedMessages
      .filter((message) => !hiddenFromAi(message))
      .slice(-60)
      .map((message) => ({
        role: readString(message.role, "user"),
        content: readString(message.content),
      })),
    mainResponse: null,
    gameState: isRecord(input.chat.gameState) ? (input.chat.gameState as unknown as AgentContext["gameState"]) : null,
    characters: input.characters.map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      creatorNotes: character.creatorNotes,
      systemPrompt: character.systemPrompt,
      backstory: character.backstory,
      appearance: character.appearance,
      mesExample: character.mesExample,
      firstMes: character.firstMes,
      postHistoryInstructions: character.postHistoryInstructions,
    })),
    persona: input.persona,
    memory,
    activatedLorebookEntries: input.activatedLorebookEntries,
    writableLorebookIds: null,
    chatSummary: input.chatSummary,
    debugMode: input.debugMode === true,
    debugSink: input.debugSink,
    streaming: true,
    signal: input.signal,
  };
}

function resultText(result: AgentResult): string | null {
  if (!result.success) return null;
  if (typeof result.data === "string") return result.data;
  if (!isRecord(result.data)) return null;
  const text = result.data.text ?? result.data.direction ?? result.data.summary ?? result.data.raw;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

function resultEventData(result: AgentResult): AgentResult {
  return result;
}

export async function createGenerationAgentRuntime(
  deps: AgentDeps,
  input: GenerationAgentRuntimeInput,
  onResult?: (result: AgentResult) => void,
): Promise<GenerationAgentRuntime> {
  const { agents, skippedResults } = await resolveAgents(deps, input);
  const preResults: AgentResult[] = [...skippedResults];
  const agentData: Record<string, string> = {};
  for (const result of skippedResults) {
    onResult?.(result);
  }
  if (agents.length === 0) {
    return {
      preInjections: [],
      preResults,
      agentData,
      runParallel: async () => [],
      runPost: async () => [],
    };
  }

  const context = await buildAgentContext(deps, input);
  const pipeline = createAgentPipeline(agents, context, (result) => {
    const text = resultText(result);
    if (text) agentData[result.agentType] = text;
    onResult?.(resultEventData(result));
  });

  const preInjections = await pipeline.preGenerate((type) => type !== "prompt-reviewer");
  for (const result of pipeline.results) {
    if (result.agentType && !preResults.includes(result)) preResults.push(result);
  }
  for (const injection of preInjections) {
    if (injection.text.trim()) agentData[injection.agentType] = injection.text.trim();
  }

  return {
    preInjections,
    preResults,
    agentData,
    runParallel: async () => pipeline.runParallel(),
    runPost: async (mainResponse) => pipeline.postGenerate(mainResponse, { preGenInjections: preInjections }),
  };
}
