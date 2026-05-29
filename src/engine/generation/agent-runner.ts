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
  BackgroundAssetInfo,
  GameAssetManifest,
  GameAssetManifestEntry,
  SpriteAssetInfo,
  VisualAssetGateway,
} from "../capabilities/visual-assets";
import type {
  BaseLLMProvider,
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatMessage,
  LLMToolCall,
  LLMToolDefinition,
} from "../generation-core/llm/base-provider";
import { matchCustomAgentActivation, type ActivationScanMessage } from "../agents-runtime/activation";
import { executeKnowledgeRetrieval } from "../agents-runtime/knowledge/knowledge-retrieval";
import { executeKnowledgeRouter } from "../agents-runtime/knowledge/knowledge-router";
import {
  createAgentPipeline,
  type AgentInjection,
  type ResolvedAgent,
} from "../agents-runtime/pipeline/agent-pipeline";
import type { AgentToolContext } from "../agents-runtime/executor/agent-executor";
import type { LorebookEntry } from "../contracts/types/lorebook";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import {
  lorebookEntryPassesContextFilters,
  type GameStateForScanning,
} from "../generation-core/lorebooks/keyword-scanner";
import { resolveGameLorebookScopeExclusions } from "../generation-core/lorebooks/game-lorebook-scope";
import { buildSpriteExpressionChoices } from "../modes/game/prompts/sprite.service";
import { llmParameters } from "./context";
import { loadAgentMemory, secretPlotStateFromMemory } from "./agent-memory-runtime";
import {
  boolish,
  hiddenFromAi,
  isRecord,
  parseRecord,
  readNumber,
  readString,
  stringArray,
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
  hideAutomatedSummarySourceMessages?: boolean;
  regenerateMessageId?: string | null;
  agentInjectionOverrides?: AgentInjection[];
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
  visuals?: VisualAssetGateway;
}

interface ResolvedAgentsResult {
  agents: ResolvedAgent[];
  skippedResults: AgentResult[];
}

const BUILT_IN_AGENT_TYPES = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));
const ILLUSTRATOR_AGENT_TYPE = "illustrator";
const KNOWLEDGE_RETRIEVAL_AGENT_TYPE = "knowledge-retrieval";
const KNOWLEDGE_ROUTER_AGENT_TYPE = "knowledge-router";
const KNOWLEDGE_AGENT_TYPES = new Set([KNOWLEDGE_RETRIEVAL_AGENT_TYPE, KNOWLEDGE_ROUTER_AGENT_TYPE]);
const MAX_ASSISTANT_RUN_INTERVAL = 100;
const MAX_CUSTOM_AGENT_USER_RUN_INTERVAL = 200;
const PROMPT_INJECTABLE_RESULT_TYPES = new Set(["context_injection", "director_event"]);
type AutomaticIntervalMessageRole = "assistant" | "user";
type SpriteDisplayMode = "expressions" | "full-body";

const DEFAULT_SPRITE_DISPLAY_MODES: SpriteDisplayMode[] = ["expressions", "full-body"];
const DEFAULT_ROLEPLAY_EXPRESSIONS = [
  "angry",
  "blushing",
  "confused",
  "crying",
  "determined",
  "disgusted",
  "embarrassed",
  "happy",
  "laughing",
  "neutral",
  "sad",
  "scared",
  "sleepy",
  "smirk",
  "surprised",
  "thinking",
] as const;

function normalizedAgentInjectionOverrides(value: unknown): AgentInjection[] {
  if (!Array.isArray(value)) return [];
  const overrides: AgentInjection[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const agentType = readString(entry.agentType).trim();
    const text = readString(entry.text).trim();
    if (!agentType || !text) continue;
    const agentName = readString(entry.agentName).trim();
    overrides.push({ agentType, ...(agentName ? { agentName } : {}), text });
  }
  return overrides;
}

function agentDataFromInjections(injections: AgentInjection[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (const injection of injections) {
    if (injection.text.trim()) data[injection.agentType] = injection.text.trim();
  }
  return data;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = readString(value).trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function normalizeSpriteDisplayModes(value: unknown): SpriteDisplayMode[] {
  const rawModes = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const modes: SpriteDisplayMode[] = [];

  for (const mode of rawModes) {
    const normalized = mode === "fullBody" || mode === "full_body" ? "full-body" : mode;
    if (normalized === "expressions" && !modes.includes("expressions")) {
      modes.push("expressions");
    } else if (normalized === "full-body" && !modes.includes("full-body")) {
      modes.push("full-body");
    }
  }

  return modes.length > 0 ? modes : [...DEFAULT_SPRITE_DISPLAY_MODES];
}

function isFullBodySpriteExpression(expression: string): boolean {
  return expression.toLowerCase().startsWith("full_");
}

function spriteExpressionsForAgent(sprites: SpriteAssetInfo[], displayModes: readonly SpriteDisplayMode[]): string[] {
  const customExpressions = sprites.map((sprite) => readString(sprite.expression).trim()).filter(Boolean);
  const expressions = displayModes.includes("expressions")
    ? [
        ...DEFAULT_ROLEPLAY_EXPRESSIONS,
        ...customExpressions.filter((expression) => !isFullBodySpriteExpression(expression)),
      ]
    : [];
  const fullBody = displayModes.includes("full-body")
    ? customExpressions.filter((expression) => isFullBodySpriteExpression(expression))
    : [];

  return uniqueStrings([...expressions, ...fullBody]);
}

function buildAvailableSpriteCharacter(
  characterId: string,
  characterName: string,
  sprites: SpriteAssetInfo[],
  displayModes: readonly SpriteDisplayMode[],
): { characterId: string; characterName: string; expressions: string[]; expressionChoices: string[] } | null {
  const expressions = spriteExpressionsForAgent(sprites, displayModes);
  if (expressions.length === 0) return null;
  return {
    characterId,
    characterName,
    expressions,
    expressionChoices: buildSpriteExpressionChoices(expressions),
  };
}

interface AutomaticIntervalGate {
  agentId: string;
  agentType: string;
  messageRole: AutomaticIntervalMessageRole;
  includePendingMessage: boolean;
  runInterval: number;
}

function llmProvider(
  llm: LlmGateway,
  connectionId: string | null,
  baseParameters: Record<string, unknown>,
): BaseLLMProvider {
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
      const parameters = { ...baseParameters };
      if (typeof options.temperature === "number") parameters.temperature = options.temperature;
      if (typeof options.maxTokens === "number") parameters.maxTokens = options.maxTokens;
      for await (const chunk of llm.stream(
        {
          connectionId,
          model: options.model,
          messages: requestMessages,
          parameters,
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

async function loadDefaultAgentConnection(storage: StorageGateway): Promise<JsonRecord | null> {
  const connections = await storage.list<JsonRecord>("connections");
  return (
    connections.find(
      (connection) =>
        readString(connection.provider).trim() !== "image_generation" && boolish(connection.defaultForAgents, false),
    ) ?? null
  );
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

function chatActiveLorebookIds(input: GenerationAgentRuntimeInput): Set<string> {
  return new Set([...stringSet(chatMetadata(input).activeLorebookIds), ...stringSet(input.chat.activeLorebookIds)]);
}

function lorebookExcludedByAgentScope(lorebook: JsonRecord, input: GenerationAgentRuntimeInput): boolean {
  const scopeExclusions = resolveGameLorebookScopeExclusions(
    readString(input.chat.mode || input.chat.chatMode),
    chatMetadata(input),
  );
  const lorebookId = readString(lorebook.id).trim();
  if (scopeExclusions.excludedLorebookIds.includes(lorebookId)) return true;
  if (scopeExclusions.excludedSourceAgentIds.includes(readString(lorebook.sourceAgentId).trim())) return true;
  return false;
}

function lorebookAppliesToAgentContext(lorebook: JsonRecord, input: GenerationAgentRuntimeInput): boolean {
  if (!boolish(lorebook.enabled, true)) return false;
  if (lorebookExcludedByAgentScope(lorebook, input)) return false;

  if (boolish(lorebook.isGlobal ?? lorebook.global, false)) return true;

  const lorebookId = readString(lorebook.id).trim();
  if (lorebookId && chatActiveLorebookIds(input).has(lorebookId)) return true;

  const chatId = readString(input.chat.id).trim();
  if (chatId && readString(lorebook.chatId).trim() === chatId) return true;
  if (chatId && stringArray(lorebook.chatIds).includes(chatId)) return true;

  const activeCharacterIds = new Set(input.characters.map((character) => character.id));
  const lorebookCharacterIds = new Set([
    ...stringArray(lorebook.characterIds),
    readString(lorebook.characterId).trim(),
  ]);
  for (const characterId of lorebookCharacterIds) {
    if (characterId && activeCharacterIds.has(characterId)) return true;
  }

  const personaId = readString(input.chat.personaId).trim();
  if (personaId) {
    const lorebookPersonaIds = new Set([...stringArray(lorebook.personaIds), readString(lorebook.personaId).trim()]);
    if (lorebookPersonaIds.has(personaId)) return true;
  }

  return false;
}

function normalizeKnowledgeSourceLorebookIds(settings: Record<string, unknown>, scopedLorebookIds: string[]): string[] {
  const manualIds = stringArray(settings.sourceLorebookIds);
  if (manualIds.length > 0) return manualIds;
  if (settings.useChatActiveLorebooks === false) return [];
  return scopedLorebookIds;
}

function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = readNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKnowledgeLorebookEntry(entry: JsonRecord, lorebook?: JsonRecord): LorebookEntry | null {
  const id = readString(entry.id).trim();
  const lorebookId = readString(entry.lorebookId).trim() || readString(lorebook?.id).trim();
  const content = readString(entry.content).trim();
  if (!id || !lorebookId || !content) return null;
  return {
    id,
    lorebookId,
    name: readString(entry.name).trim() || "Untitled",
    content,
    description: readString(entry.description).trim(),
    keys: stringArray(entry.keys),
    secondaryKeys: stringArray(entry.secondaryKeys),
    enabled: boolish(entry.enabled, true),
    constant: boolish(entry.constant, false),
    selective: boolish(entry.selective, false),
    selectiveLogic: readString(entry.selectiveLogic, "and") as LorebookEntry["selectiveLogic"],
    probability: optionalNumber(entry.probability),
    scanDepth: optionalNumber(entry.scanDepth),
    matchWholeWords: boolish(entry.matchWholeWords, false),
    caseSensitive: boolish(entry.caseSensitive, false),
    useRegex: boolish(entry.useRegex, false),
    characterFilterMode: readString(entry.characterFilterMode, "any") as LorebookEntry["characterFilterMode"],
    characterFilterIds: stringArray(entry.characterFilterIds),
    characterTagFilterMode: readString(entry.characterTagFilterMode, "any") as LorebookEntry["characterTagFilterMode"],
    characterTagFilters: stringArray(entry.characterTagFilters),
    generationTriggerFilterMode: readString(
      entry.generationTriggerFilterMode,
      "any",
    ) as LorebookEntry["generationTriggerFilterMode"],
    generationTriggerFilters: stringArray(entry.generationTriggerFilters),
    additionalMatchingSources: stringArray(
      entry.additionalMatchingSources,
    ) as LorebookEntry["additionalMatchingSources"],
    position: readNumber(entry.position, 0),
    depth: readNumber(entry.depth, 0),
    order: readNumber(entry.order ?? entry.sortOrder, 0),
    role: readString(entry.role, "system") as LorebookEntry["role"],
    sticky: optionalNumber(entry.sticky),
    cooldown: optionalNumber(entry.cooldown),
    delay: optionalNumber(entry.delay),
    ephemeral: optionalNumber(entry.ephemeral),
    group: readString(entry.group).trim(),
    groupWeight: optionalNumber(entry.groupWeight),
    folderId: readString(entry.folderId).trim() || null,
    locked: boolish(entry.locked, false),
    preventRecursion: boolish(entry.preventRecursion, false),
    tag: readString(entry.tag).trim(),
    relationships: parseRecord(entry.relationships) as Record<string, string>,
    dynamicState: parseRecord(entry.dynamicState),
    activationConditions: Array.isArray(entry.activationConditions)
      ? (entry.activationConditions as LorebookEntry["activationConditions"])
      : [],
    schedule: isRecord(entry.schedule) ? (entry.schedule as unknown as LorebookEntry["schedule"]) : null,
    excludeFromVectorization: boolish(
      entry.excludeFromVectorization,
      boolish(lorebook?.excludeFromVectorization, false),
    ),
    embedding: Array.isArray(entry.embedding)
      ? entry.embedding.filter((item): item is number => typeof item === "number")
      : null,
    createdAt: readString(entry.createdAt).trim(),
    updatedAt: readString(entry.updatedAt).trim(),
  };
}

async function loadKnowledgeSourceLorebookEntries(
  storage: StorageGateway,
  input: GenerationAgentRuntimeInput,
  settings: Record<string, unknown>,
): Promise<LorebookEntry[]> {
  const lorebooks = await storage.list<JsonRecord>("lorebooks");
  const scopedLorebooks = lorebooks.filter((lorebook) => lorebookAppliesToAgentContext(lorebook, input));
  const lorebookById = new Map(lorebooks.map((lorebook) => [readString(lorebook.id).trim(), lorebook]));
  const sourceIds = normalizeKnowledgeSourceLorebookIds(
    settings,
    scopedLorebooks.map((lorebook) => readString(lorebook.id).trim()).filter(Boolean),
  ).filter((lorebookId) => {
    const lorebook = lorebookById.get(lorebookId);
    return !lorebook || !lorebookExcludedByAgentScope(lorebook, input);
  });
  if (sourceIds.length === 0) return [];

  const rows = await Promise.all(
    [...new Set(sourceIds)].map(async (lorebookId) => {
      const lorebook = lorebookById.get(lorebookId);
      const entries = await storage.listLorebookEntries<JsonRecord>(lorebookId);
      return entries.map((entry) => normalizeKnowledgeLorebookEntry(entry, lorebook));
    }),
  );
  return rows
    .flat()
    .filter((entry): entry is LorebookEntry => entry !== null)
    .filter((entry) => entry.enabled && entry.content.trim());
}

function knowledgeEntryPassesContext(entry: LorebookEntry, input: GenerationAgentRuntimeInput): boolean {
  return lorebookEntryPassesContextFilters(entry, {
    activeCharacterIds: input.characters.map((character) => character.id),
    activeCharacterTags: input.characters.flatMap((character) => character.tags),
    generationTriggers: ["chat", readString(input.chat.mode).trim()].filter(Boolean),
  });
}

function formatKnowledgeSourceMaterial(entries: LorebookEntry[]): string {
  return entries.map((entry) => `### ${entry.name}\n${entry.content}`).join("\n\n");
}

async function runKnowledgePreGenerationAgents(
  deps: AgentDeps,
  input: GenerationAgentRuntimeInput,
  context: AgentContext,
  agents: ResolvedAgent[],
  onResult?: (result: AgentResult) => void,
): Promise<{ injections: AgentInjection[]; results: AgentResult[] }> {
  const knowledgeAgents = agents.filter(
    (agent) => agent.phase === "pre_generation" && KNOWLEDGE_AGENT_TYPES.has(agent.type),
  );
  if (knowledgeAgents.length === 0) return { injections: [], results: [] };

  const results: AgentResult[] = [];
  const injections: AgentInjection[] = [];
  const activatedEntryIds = new Set(input.activatedLorebookEntries.map((entry) => entry.id));

  for (const agent of knowledgeAgents) {
    const entries = await loadKnowledgeSourceLorebookEntries(deps.storage, input, agent.settings);
    const scopedEntries =
      agent.type === KNOWLEDGE_ROUTER_AGENT_TYPE
        ? entries.filter((entry) => !entry.constant && knowledgeEntryPassesContext(entry, input))
        : entries;
    if (scopedEntries.length === 0) continue;

    const result =
      agent.type === KNOWLEDGE_ROUTER_AGENT_TYPE
        ? await executeKnowledgeRouter(agent, context, agent.provider, agent.model, scopedEntries, {
            activatedEntries: scopedEntries.filter((entry) => activatedEntryIds.has(entry.id)),
            keywordScanEntries: scopedEntries.filter((entry) => !activatedEntryIds.has(entry.id)),
            scanMessages: context.recentMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            scanOptions: {
              gameState: context.gameState as GameStateForScanning | null,
              activeCharacterIds: input.characters.map((character) => character.id),
              activeCharacterTags: input.characters.flatMap((character) => character.tags),
              generationTriggers: ["chat", context.chatMode].filter(Boolean),
            },
          })
        : await executeKnowledgeRetrieval(
            agent,
            context,
            agent.provider,
            agent.model,
            formatKnowledgeSourceMaterial(scopedEntries),
          );

    results.push(result);
    onResult?.(result);
    const text = resultText(result);
    if (text) injections.push({ agentType: agent.type, agentName: agent.name, text });
  }

  return { injections, results };
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
    const fallback = positiveInteger(BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[type], 5, MAX_ASSISTANT_RUN_INTERVAL);
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
      .sort(
        (a, b) =>
          b.messageIndex - a.messageIndex || readString(b.run.createdAt).localeCompare(readString(a.run.createdAt)),
      )[0]?.run ?? null
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
  const selectedNames = enabledToolNames(settings).filter(
    (name) => scopedToolIds.size === 0 || scopedToolIds.has(name),
  );
  const selectedBuiltIns = selectedNames.map(builtInToolDefinition).filter((tool): tool is LLMToolDefinition => !!tool);
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

function suppressAgentForTurn(input: GenerationAgentRuntimeInput, type: string): boolean {
  const isRegeneration = !!readString(input.regenerateMessageId).trim();
  return isRegeneration && type === "echo-chamber";
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
    if (
      !requestedExplicitly &&
      (!requestedAgentTypes || requestedAgentTypes.size === 0) &&
      type === "lorebook-keeper"
    ) {
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
  let defaultAgentConnection: JsonRecord | null | undefined;
  for (const agent of rows) {
    const type = readString(agent.type || agent.agentType) || "agent";
    if (suppressAgentForTurn(input, type)) continue;
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
    if (!requestedConnectionId && defaultAgentConnection === undefined) {
      defaultAgentConnection = await loadDefaultAgentConnection(deps.storage);
    }
    const fallbackConnection = defaultAgentConnection ?? input.connection;
    const fallbackConnectionId = readString(fallbackConnection.id).trim() || null;
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
      connection = fallbackConnection;
    }
    const model = readString(agent.model).trim() || readString(connection.model).trim();
    if (!model) continue;
    const parameters = llmParameters(connection, {}, input.chat);
    customTools ??= await loadCustomTools(deps.storage);
    resolved.push({
      id: readString(agent.id) || readString(agent.type) || "agent",
      type,
      name: readString(agent.name) || readString(agent.type) || "Agent",
      phase: normalizePhase(agent),
      promptTemplate: readString(agent.promptTemplate),
      connectionId,
      settings,
      provider: llmProvider(deps.llm, connectionId, parameters),
      model,
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
  const sourceType = normalizeSpotifyDjSourceType(isGame ? chatMeta.gameSpotifySourceType : chatMeta.spotifySourceType);
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

function lorebookKeeperActiveForContext(input: GenerationAgentRuntimeInput): boolean {
  if (input.agentTypes?.has("lorebook-keeper")) return true;
  const activeAgentIds = chatActiveAgentIds(input);
  return activeAgentIds.has("lorebook-keeper");
}

async function loadLorebookKeeperEntries(
  storage: StorageGateway,
  chatMeta: JsonRecord,
): Promise<Array<{ id: string; name: string; content: string; keys: string[]; locked: boolean }> | null> {
  const configuredLorebookId = readString(chatMeta.lorebookKeeperTargetLorebookId).trim();
  const activeLorebookIds = stringSet(chatMeta.activeLorebookIds);
  let lorebookId = configuredLorebookId || [...activeLorebookIds][0] || "";

  if (!lorebookId) {
    const lorebook = (await storage.list<JsonRecord>("lorebooks").catch(() => [])).find((row) =>
      boolish(row.enabled, true),
    );
    lorebookId = readString(lorebook?.id).trim();
  }

  if (!lorebookId) return null;
  const entries = await storage.list<JsonRecord>("lorebook-entries", { filters: { lorebookId } }).catch(() => []);
  return entries.map((entry) => ({
    id: readString(entry.id).trim(),
    name: readString(entry.name).trim() || "Unnamed",
    content: readString(entry.content).trim(),
    keys: Array.isArray(entry.keys) ? entry.keys.map((key) => readString(key).trim()).filter(Boolean) : [],
    locked: boolish(entry.locked, false),
  }));
}

function agentTypeActive(agents: ResolvedAgent[], type: string): boolean {
  return agents.some((agent) => agent.type === type);
}

async function loadAgentAvailableSprites(
  visuals: VisualAssetGateway,
  input: GenerationAgentRuntimeInput,
  context: AgentContext,
  chatMeta: JsonRecord,
): Promise<void> {
  const spriteDisplayModes = normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes);
  const selectedSpriteIds = stringSet(chatMeta.spriteCharacterIds);
  const restrictToSelectedSprites = selectedSpriteIds.size > 0;
  const perCharacter = await Promise.all(
    context.characters
      .filter((character) => !restrictToSelectedSprites || selectedSpriteIds.has(character.id))
      .map(async (character) => {
        const sprites = await visuals.listSprites(character.id).catch(() => []);
        return buildAvailableSpriteCharacter(character.id, character.name, sprites, spriteDisplayModes);
      }),
  );

  const personaId = readString(input.chat.personaId).trim();
  if (personaId && input.persona && (!restrictToSelectedSprites || selectedSpriteIds.has(personaId))) {
    const sprites = await visuals.listSprites(personaId).catch(() => []);
    const spritePersona = buildAvailableSpriteCharacter(personaId, input.persona.name, sprites, spriteDisplayModes);
    if (spritePersona) perCharacter.push(spritePersona);
  }

  const availableSprites = perCharacter.filter(
    (spriteCharacter): spriteCharacter is NonNullable<typeof spriteCharacter> => Boolean(spriteCharacter),
  );
  if (availableSprites.length > 0) {
    context.memory._availableSprites = availableSprites;
  }
}

function gameAssetBackgrounds(manifest: GameAssetManifest | null): GameAssetManifestEntry[] {
  const backgrounds = manifest?.byCategory?.backgrounds;
  return Array.isArray(backgrounds) ? backgrounds : [];
}

function backgroundEntryFromUserAsset(background: BackgroundAssetInfo): {
  filename: string;
  originalName: string | null;
  tags: string[];
  source: "user" | "game_asset";
} | null {
  const filename =
    readString(background.filename).trim() || readString(background.name).trim() || readString(background.path).trim();
  if (!filename) return null;
  return {
    filename,
    originalName: readString(background.originalName).trim() || null,
    tags: stringArray(background.tags),
    source: background.source === "game_asset" ? "game_asset" : "user",
  };
}

function backgroundEntryFromGameAsset(asset: GameAssetManifestEntry): {
  filename: string;
  originalName: string | null;
  tags: string[];
  source: "game_asset";
} | null {
  const path = readString(asset.path).trim();
  if (!path || path.startsWith("__user_bg__/")) return null;
  return {
    filename: `gameAsset:${path}`,
    originalName: readString(asset.tag).trim() || readString(asset.name).trim() || null,
    tags: stringArray([asset.subcategory, asset.category]).filter(Boolean),
    source: "game_asset",
  };
}

async function loadAgentAvailableBackgrounds(
  visuals: VisualAssetGateway,
  context: AgentContext,
  chatMeta: JsonRecord,
  backgroundAgent: ResolvedAgent,
): Promise<void> {
  context.memory._availableBackgrounds = [];
  context.memory._currentBackground = chatMeta.background ?? null;
  if (backgroundAgent.settings.autoGenerateBackgrounds === true) {
    context.memory._backgroundGenerationEnabled = true;
  }

  const userBackgrounds = await visuals.listBackgrounds().catch(() => []);
  const entries = userBackgrounds.map(backgroundEntryFromUserAsset).filter(
    (
      background,
    ): background is {
      filename: string;
      originalName: string | null;
      tags: string[];
      source: "user" | "game_asset";
    } => !!background,
  );

  if (visuals.gameAssetsManifest) {
    const manifest = await visuals.gameAssetsManifest().catch(() => null);
    entries.push(
      ...gameAssetBackgrounds(manifest)
        .map(backgroundEntryFromGameAsset)
        .filter(
          (
            background,
          ): background is { filename: string; originalName: string | null; tags: string[]; source: "game_asset" } =>
            !!background,
        ),
    );
  }

  context.memory._availableBackgrounds = entries;
}

async function populateAgentVisualContext(
  deps: AgentDeps,
  input: GenerationAgentRuntimeInput,
  context: AgentContext,
  chatMeta: JsonRecord,
  agents: ResolvedAgent[],
): Promise<void> {
  if (!deps.visuals) return;
  if (agentTypeActive(agents, "expression")) {
    await loadAgentAvailableSprites(deps.visuals, input, context, chatMeta);
  }

  const backgroundAgent = agents.find((agent) => agent.type === "background");
  if (backgroundAgent) {
    await loadAgentAvailableBackgrounds(deps.visuals, context, chatMeta, backgroundAgent);
  }
}

async function buildAgentContext(
  deps: AgentDeps,
  input: GenerationAgentRuntimeInput,
  agents: ResolvedAgent[],
): Promise<AgentContext> {
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
  if (lorebookKeeperActiveForContext(input)) {
    const existingLorebookEntries = await loadLorebookKeeperEntries(deps.storage, chatMeta);
    if (existingLorebookEntries) memory._existingLorebookEntries = existingLorebookEntries;
  }
  const context: AgentContext = {
    chatId,
    chatMode,
    recentMessages: input.storedMessages
      .filter((message) => !hiddenFromAi(message))
      .slice(-60)
      .map((message) => ({
        role: readString(message.role, "user"),
        content: readString(message.content),
        characterId: readString(message.characterId).trim() || undefined,
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
  await populateAgentVisualContext(deps, input, context, chatMeta, agents);
  return context;
}

function resultText(result: AgentResult): string | null {
  if (!result.success) return null;
  if (!PROMPT_INJECTABLE_RESULT_TYPES.has(result.type)) return null;
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
  const overrideInjections = normalizedAgentInjectionOverrides(input.agentInjectionOverrides);
  const agentData: Record<string, string> = agentDataFromInjections(overrideInjections);
  for (const result of skippedResults) {
    onResult?.(result);
  }
  if (agents.length === 0) {
    return {
      preInjections: overrideInjections,
      preResults,
      agentData,
      runParallel: async () => [],
      runPost: async () => [],
    };
  }

  const context = await buildAgentContext(deps, input, agents);
  const pipelineAgents = agents.filter((agent) => !KNOWLEDGE_AGENT_TYPES.has(agent.type));
  const pipeline = createAgentPipeline(pipelineAgents, context, (result) => {
    const text = resultText(result);
    if (text) agentData[result.agentType] = text;
    onResult?.(resultEventData(result));
  });

  if (overrideInjections.length > 0) {
    return {
      preInjections: overrideInjections,
      preResults,
      agentData,
      runParallel: async () => pipeline.runParallel(),
      runPost: async (mainResponse) => pipeline.postGenerate(mainResponse, { preGenInjections: overrideInjections }),
    };
  }

  const [pipelinePreInjections, knowledgePre] = await Promise.all([
    pipeline.preGenerate((type) => type !== "prompt-reviewer"),
    runKnowledgePreGenerationAgents(deps, input, context, agents, (result) => {
      const text = resultText(result);
      if (text) agentData[result.agentType] = text;
      onResult?.(resultEventData(result));
    }),
  ]);
  const preInjections = [...pipelinePreInjections, ...knowledgePre.injections];
  for (const result of pipeline.results) {
    if (result.agentType && !preResults.includes(result)) preResults.push(result);
  }
  for (const result of knowledgePre.results) {
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
