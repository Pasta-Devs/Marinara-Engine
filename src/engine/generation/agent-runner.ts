import { BUILT_IN_TOOLS, type AgentContext, type AgentResult } from "../contracts/types/agent";
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
import { createAgentPipeline, type AgentInjection, type ResolvedAgent } from "../agents-runtime/pipeline/agent-pipeline";
import type { AgentToolContext } from "../agents-runtime/executor/agent-executor";
import { appendChatSummaryEntryToMetadata } from "../shared/text/chat-summary-entries";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import {
  boolish,
  hiddenFromAi,
  isRecord,
  newId,
  nowIso,
  parseRecord,
  readNumber,
  readString,
  type JsonRecord,
} from "./runtime-records";

export interface GenerationAgentRuntimeInput {
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  activatedLorebookEntries: Array<{ id: string; name: string; content: string; tag: string }>;
  chatSummary: string | null;
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
  signal?: AbortSignal;
  agentTypes?: Set<string>;
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

interface CustomToolRecord extends JsonRecord {
  name: string;
  description: string;
  parametersSchema: unknown;
  executionType: string;
  webhookUrl: string | null;
  staticResult: string | null;
  enabled: string | boolean;
}

function normalizeToolCall(value: unknown): LLMToolCall | null {
  if (!isRecord(value)) return null;
  const rawFunction = isRecord(value.function) ? value.function : value;
  const name = readString(rawFunction.name || value.name).trim();
  if (!name) return null;
  const args = readString(rawFunction.arguments || value.arguments, "{}");
  return {
    id: readString(value.id) || `tool-${name}-${Date.now().toString(36)}`,
    name,
    arguments: args,
    function: {
      name,
      arguments: args,
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

async function loadAgentMemory(storage: StorageGateway, agentId: string, chatId: string): Promise<Record<string, unknown>> {
  const rows = await storage.list<JsonRecord>("agent-memory");
  const memory: Record<string, unknown> = {};
  for (const row of rows) {
    if (readString(row.agentConfigId) !== agentId || readString(row.chatId) !== chatId) continue;
    const key = readString(row.key);
    if (!key) continue;
    const value = row.value;
    memory[key] = typeof value === "string" ? parseMaybeJson(value) : value;
  }
  return memory;
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

function parseToolParameters(value: unknown): unknown {
  if (!value) return { type: "object", properties: {} };
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { type: "object", properties: {} };
    }
  }
  return value;
}

function customToolRecord(row: JsonRecord): CustomToolRecord | null {
  const name = readString(row.name).trim();
  if (!name || !boolish(row.enabled, false)) return null;
  const executionType = readString(row.executionType, "static");
  if (executionType !== "static" && executionType !== "webhook") return null;
  return {
    ...row,
    name,
    description: readString(row.description),
    parametersSchema: parseToolParameters(row.parametersSchema),
    executionType,
    webhookUrl: readString(row.webhookUrl).trim() || null,
    staticResult: readString(row.staticResult),
    enabled: row.enabled as string | boolean,
  };
}

async function loadCustomTools(storage: StorageGateway): Promise<Map<string, CustomToolRecord>> {
  const tools = new Map<string, CustomToolRecord>();
  for (const row of await storage.list<JsonRecord>("custom-tools")) {
    const tool = customToolRecord(row);
    if (tool) tools.set(tool.name, tool);
  }
  return tools;
}

function customToolDefinition(tool: CustomToolRecord): LLMToolDefinition {
  return {
    name: tool.name,
    description: tool.description || `Run custom tool ${tool.name}.`,
    parameters: tool.parametersSchema,
  };
}

const BUILT_IN_TOOL_MAP = new Map(BUILT_IN_TOOLS.map((tool) => [tool.name, tool]));

function builtInToolDefinition(name: string): LLMToolDefinition | null {
  const tool = BUILT_IN_TOOL_MAP.get(name);
  if (!tool) return null;
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.result === "string") return value.result;
  return JSON.stringify(value ?? null);
}

function toolArguments(call: LLMToolCall): JsonRecord {
  const raw = call.function?.arguments || call.arguments || "{}";
  if (typeof raw === "string") return parseRecord(raw);
  return parseRecord(raw);
}

function stringArg(args: JsonRecord, key: string, fallback = ""): string {
  return readString(args[key], fallback).trim();
}

function numberArg(args: JsonRecord, key: string, fallback: number): number {
  return readNumber(args[key], fallback);
}

function stringArrayArg(args: JsonRecord, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item).trim()).filter(Boolean);
}

function toolError(message: string): never {
  throw new Error(message);
}

function requireChatId(input: GenerationAgentRuntimeInput): string {
  const chatId = readString(input.chat.id).trim();
  if (!chatId) toolError("Tool requires a persisted chat id.");
  return chatId;
}

async function updateChatMetadata(
  storage: StorageGateway,
  input: GenerationAgentRuntimeInput,
  updater: (metadata: JsonRecord) => JsonRecord,
): Promise<JsonRecord> {
  const chatId = requireChatId(input);
  const metadata = updater({ ...parseRecord(input.chat.metadata) });
  await storage.update("chats", chatId, { metadata });
  input.chat.metadata = metadata;
  return metadata;
}

function rollDiceNotation(notation: string) {
  const match = notation.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) toolError("Dice notation must look like 1d20, 2d6, or 3d8+2.");
  const count = Math.max(1, Math.min(100, Number(match[1] || "1")));
  const sides = Math.max(2, Math.min(1000, Number(match[2])));
  const modifier = Number(match[3] || "0");
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return {
    notation: `${count}d${sides}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : modifier}`,
    rolls,
    modifier,
    total: rolls.reduce((sum, value) => sum + value, 0) + modifier,
  };
}

async function searchLorebookTool(storage: StorageGateway, input: GenerationAgentRuntimeInput, args: JsonRecord) {
  const query = stringArg(args, "query").toLowerCase();
  if (!query) toolError("query is required.");
  const category = stringArg(args, "category").toLowerCase();
  const tokens = query.split(/\s+/).filter((token) => token.length > 1);
  const rows = await storage.list<JsonRecord>("lorebook-entries").catch(() => []);
  const activated = input.activatedLorebookEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    content: entry.content,
    tag: entry.tag,
    source: "activated",
  }));
  const stored = rows.map((entry) => ({
    id: readString(entry.id),
    name: readString(entry.name || entry.comment || entry.title, "Lorebook entry"),
    content: readString(entry.content),
    tag: readString(entry.tag || entry.category || entry.position),
    source: "stored",
  }));
  const seen = new Set<string>();
  const scored = [...activated, ...stored]
    .filter((entry) => {
      if (!entry.id || seen.has(entry.id)) return false;
      seen.add(entry.id);
      if (category && !`${entry.name} ${entry.tag}`.toLowerCase().includes(category)) return false;
      return true;
    })
    .map((entry) => {
      const haystack = `${entry.name} ${entry.tag} ${entry.content}`.toLowerCase();
      const score =
        (haystack.includes(query) ? 10 : 0) +
        tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      tag: entry.tag || null,
      source: entry.source,
      score: entry.score,
      content: entry.content.slice(0, 4000),
    }));
  return { query, entries: scored };
}

async function executeBuiltInTool(
  deps: Pick<AgentDeps, "storage" | "integrations">,
  input: GenerationAgentRuntimeInput,
  agent: JsonRecord,
  call: LLMToolCall,
): Promise<unknown> {
  const { storage, integrations } = deps;
  const toolName = call.function?.name || call.name;
  const args = toolArguments(call);
  const chatId = requireChatId(input);

  switch (toolName) {
    case "roll_dice": {
      const notation = stringArg(args, "notation");
      if (!notation) toolError("notation is required.");
      return { ...rollDiceNotation(notation), reason: stringArg(args, "reason") || null };
    }
    case "update_game_state": {
      const update = {
        id: newId("game_state_update"),
        createdAt: nowIso(),
        type: stringArg(args, "type"),
        target: stringArg(args, "target"),
        key: stringArg(args, "key"),
        value: stringArg(args, "value"),
        description: stringArg(args, "description"),
      };
      if (!update.type || !update.target || !update.key) toolError("type, target, and key are required.");
      const metadata = parseRecord(input.chat.metadata);
      const updates = Array.isArray(metadata.agentGameStateUpdates) ? metadata.agentGameStateUpdates : [];
      metadata.agentGameStateUpdates = [...updates, update].slice(-100);
      const gameState = isRecord(input.chat.gameState) ? { ...input.chat.gameState } : {};
      if (update.type === "location_change") gameState.location = update.value;
      if (update.type === "time_advance") gameState.time = update.value;
      await storage.update("chats", chatId, { metadata, gameState });
      input.chat.metadata = metadata;
      input.chat.gameState = gameState;
      return { success: true, update, gameState };
    }
    case "set_expression": {
      const characterName = stringArg(args, "characterName");
      const expression = stringArg(args, "expression");
      if (!characterName || !expression) toolError("characterName and expression are required.");
      const metadata = await updateChatMetadata(storage, input, (current) => {
        const expressions = parseRecord(current.agentExpressions);
        expressions[characterName] = expression;
        return { ...current, agentExpressions: expressions };
      });
      return { success: true, characterName, expression, expressions: metadata.agentExpressions };
    }
    case "trigger_event": {
      const event = {
        id: newId("agent_event"),
        createdAt: nowIso(),
        eventType: stringArg(args, "eventType"),
        description: stringArg(args, "description"),
        involvedCharacters: stringArrayArg(args, "involvedCharacters"),
      };
      if (!event.eventType || !event.description) toolError("eventType and description are required.");
      await updateChatMetadata(storage, input, (current) => {
        const events = Array.isArray(current.agentEvents) ? current.agentEvents : [];
        return { ...current, agentEvents: [...events, event].slice(-100) };
      });
      return { success: true, event };
    }
    case "search_lorebook":
      return searchLorebookTool(storage, input, args);
    case "read_chat_summary":
      return { summary: (input.chatSummary ?? readString(parseRecord(input.chat.metadata).summary)) || null };
    case "append_chat_summary": {
      const text = stringArg(args, "text");
      if (!text) toolError("text is required.");
      const now = nowIso();
      const metadata = parseRecord(input.chat.metadata);
      const appended = appendChatSummaryEntryToMetadata(
        metadata,
        {
          content: text,
          origin: "automated",
          sourceMode: "agent",
          title: "Agent memory",
        },
        { now, createId: () => newId("summary") },
      );
      metadata.summaryEntries = appended.entries;
      metadata.summary = appended.summary;
      await storage.update("chats", chatId, { metadata });
      input.chat.metadata = metadata;
      input.chatSummary = appended.summary;
      return { success: true, entry: appended.entry, summary: appended.summary };
    }
    case "read_chat_variable": {
      const key = stringArg(args, "key");
      if (!key) toolError("key is required.");
      const variables = parseRecord(parseRecord(input.chat.metadata).agentVariables);
      return { key, value: typeof variables[key] === "string" ? variables[key] : null };
    }
    case "write_chat_variable": {
      const key = stringArg(args, "key");
      const value = stringArg(args, "value");
      if (!key) toolError("key is required.");
      await updateChatMetadata(storage, input, (current) => {
        const variables = parseRecord(current.agentVariables);
        variables[key] = value;
        return { ...current, agentVariables: variables };
      });
      return { success: true, key, value };
    }
    case "spotify_get_current_playback":
      return integrations.spotify.player({ agentId: spotifyAgentId(agent) });
    case "spotify_get_playlists": {
      const limit = Math.max(1, Math.min(50, Math.trunc(numberArg(args, "limit", 20))));
      return integrations.spotify.playlists({ agentId: spotifyAgentId(agent), limit });
    }
    case "spotify_get_playlist_tracks": {
      const playlistId = stringArg(args, "playlistId");
      if (!playlistId) toolError("playlistId is required.");
      const body: JsonRecord = {
        agentId: spotifyAgentId(agent),
        playlistId,
        query: stringArg(args, "query"),
        mood: stringArg(args, "mood"),
        limit: Math.max(1, Math.min(80, Math.trunc(numberArg(args, "candidateLimit", numberArg(args, "limit", 50))))),
      };
      const offset = numberArg(args, "offset", Number.NaN);
      if (Number.isFinite(offset)) body.offset = Math.max(0, Math.trunc(offset));
      return integrations.spotify.playlistTracks(body);
    }
    case "spotify_search":
      return integrations.spotify.searchTracks({
        agentId: spotifyAgentId(agent),
        query: stringArg(args, "query"),
        limit: Math.max(1, Math.min(50, Math.trunc(numberArg(args, "limit", 10)))),
      });
    case "spotify_play": {
      const uri = stringArg(args, "uri");
      const uris = stringArrayArg(args, "uris");
      if (!uri && uris.length === 0) toolError("uri or uris is required.");
      const body: JsonRecord = { agentId: spotifyAgentId(agent) };
      if (uris.length > 0) body.uris = uris;
      else if (uri.startsWith("spotify:track:")) body.uri = uri;
      else body.contextUri = uri;
      return integrations.spotify.play(body);
    }
    case "spotify_set_volume":
      return integrations.spotify.volume({
        agentId: spotifyAgentId(agent),
        volume: Math.max(0, Math.min(100, Math.trunc(numberArg(args, "volume", 50)))),
      });
    default:
      return null;
  }
}

function spotifyAgentId(agent: JsonRecord): string {
  const settings = agentSettings(agent);
  return readString(settings.spotifyAgentId).trim() || readString(agent.id).trim() || "spotify";
}

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
    .filter((tool): tool is CustomToolRecord => !!tool);
  if (selectedBuiltIns.length === 0 && selectedCustomTools.length === 0) return undefined;

  return {
    tools: [...selectedBuiltIns, ...selectedCustomTools.map(customToolDefinition)],
    executeToolCall: async (call: LLMToolCall) => {
      const toolName = call.function?.name || call.name;
      if (BUILT_IN_TOOL_MAP.has(toolName)) {
        return stringifyToolResult(await executeBuiltInTool(deps, input, agent, call));
      }
      return stringifyToolResult(
        await deps.integrations.customTools.execute({
          toolName,
          arguments: toolArguments(call),
        }),
      );
    },
  };
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
  const rows = (await deps.storage.list<JsonRecord>("agents"))
    .filter((agent) => boolish(agent.enabled, false))
    .filter((agent) => {
      const type = readString(agent.type || agent.agentType);
      const id = readString(agent.id);
      if ((!input.agentTypes || input.agentTypes.size === 0) && type === "lorebook-keeper") return false;
      if (scopedAgentIds.size > 0 && !scopedAgentIds.has(type) && !scopedAgentIds.has(id)) return false;
      if (!input.agentTypes || input.agentTypes.size === 0) return true;
      return input.agentTypes.has(type);
    });
  const customTools = await loadCustomTools(deps.storage);
  const resolved: ResolvedAgent[] = [];
  const skippedResults: AgentResult[] = [];
  for (const agent of rows) {
    const settings = agentSettings(agent);
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
    resolved.push({
      id: readString(agent.id) || readString(agent.type) || "agent",
      type: readString(agent.type || agent.agentType) || "agent",
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

async function buildAgentContext(deps: AgentDeps, input: GenerationAgentRuntimeInput): Promise<AgentContext> {
  const chatId = readString(input.chat.id);
  const memoryRows = await Promise.all(
    (await deps.storage.list<JsonRecord>("agents"))
      .filter((agent) => readString(agent.id).trim())
      .map((agent) => loadAgentMemory(deps.storage, readString(agent.id), chatId)),
  );
  const memory = Object.assign({}, ...memoryRows);
  return {
    chatId,
    chatMode: readString(input.chat.mode || input.chat.chatMode, "roleplay"),
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
  const context = await buildAgentContext(deps, input);
  const preResults: AgentResult[] = [...skippedResults];
  const agentData: Record<string, string> = {};
  for (const result of skippedResults) {
    onResult?.(result);
  }
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
