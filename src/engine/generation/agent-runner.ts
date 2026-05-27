import {
  BUILT_IN_AGENTS,
  BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS,
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

function activationScanMessages(input: GenerationAgentRuntimeInput): ActivationScanMessage[] {
  return input.storedMessages
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({ content: readString(message.content) }));
}

function isBuiltInAgent(agent: JsonRecord): boolean {
  const type = readString(agent.type || agent.agentType).trim();
  return BUILT_IN_AGENT_TYPES.has(type);
}

function positiveInteger(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function automaticAssistantIntervalAgentType(input: GenerationAgentRuntimeInput, type: string): string | null {
  if (input.agentTypes && input.agentTypes.size > 0) return null;
  return type === ILLUSTRATOR_AGENT_TYPE ? type : null;
}

function runAgentType(run: JsonRecord): string {
  return readString(run.agentType || run.type).trim();
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
  input.storedMessages.forEach((message, index) => {
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
): JsonRecord | null {
  const indexes = messageIndexById(input);
  return (
    runs
      .filter((run) => readString(run.chatId).trim() === chatId)
      .filter((run) => runAgentType(run) === agentType)
      .filter((run) => boolish(run.success, false))
      .filter((run) => agentType !== ILLUSTRATOR_AGENT_TYPE || illustratorRunCountsTowardInterval(run))
      .map((run) => ({ run, messageIndex: indexes.get(readString(run.messageId).trim()) ?? -1 }))
      .filter((entry) => entry.messageIndex >= 0)
      .sort((a, b) => b.messageIndex - a.messageIndex || readString(b.run.createdAt).localeCompare(readString(a.run.createdAt)))[0]
      ?.run ?? null
  );
}

function assistantMessagesSinceRun(input: GenerationAgentRuntimeInput, messageId: string): number | null {
  const index = input.storedMessages.findIndex((message) => readString(message.id).trim() === messageId);
  if (index < 0) return null;
  return input.storedMessages
    .slice(index + 1)
    .filter((message) => !hiddenFromAi(message))
    .filter((message) => readString(message.role).trim() === "assistant").length;
}

async function automaticAssistantIntervalAllowsRun(
  storage: StorageGateway,
  input: GenerationAgentRuntimeInput,
  agentType: string,
  settings: Record<string, unknown>,
): Promise<boolean> {
  const fallback = positiveInteger(
    BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[agentType],
    agentType === ILLUSTRATOR_AGENT_TYPE ? 5 : 1,
    MAX_ASSISTANT_RUN_INTERVAL,
  );
  const runInterval = positiveInteger(settings.runInterval, fallback, MAX_ASSISTANT_RUN_INTERVAL);
  if (runInterval <= 1) return true;
  const chatId = readString(input.chat.id).trim();
  if (!chatId) return true;
  const lastRun = intervalAnchorRun(await storage.list<JsonRecord>("agent-runs"), input, chatId, agentType);
  if (!lastRun) return true;
  const messageId = readString(lastRun.messageId).trim();
  if (!messageId) return true;
  const assistantMessagesSince = assistantMessagesSinceRun(input, messageId);
  if (assistantMessagesSince === null) return true;
  return assistantMessagesSince + 1 >= runInterval;
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
      return customToolExecutor(deps.integrations, call);
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
  const activationMessages = activationScanMessages(input);
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
  let customTools: Map<string, CustomToolRecord> | null = null;
  const resolved: ResolvedAgent[] = [];
  const skippedResults: AgentResult[] = [];
  for (const agent of rows) {
    const type = readString(agent.type || agent.agentType) || "agent";
    const settings = agentSettings(agent);
    if (!input.bypassCustomAgentActivation && !isBuiltInAgent(agent)) {
      const activation = matchCustomAgentActivation(settings, activationMessages);
      if (activation.configured && !activation.matched) continue;
    }
    const assistantIntervalAgentType = automaticAssistantIntervalAgentType(input, type);
    if (
      assistantIntervalAgentType &&
      !(await automaticAssistantIntervalAllowsRun(deps.storage, input, assistantIntervalAgentType, settings))
    ) {
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
