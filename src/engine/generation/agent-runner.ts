import {
  BUILT_IN_AGENTS,
  BUILT_IN_AGENT_IDS,
  BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS,
  DEFAULT_AGENT_TOOLS,
  type AgentContext,
  type AgentResult,
} from "../contracts/types/agent";
import { getDefaultAgentPrompt } from "../contracts/constants/agent-prompts";
import type { HapticDevice, HapticStatus } from "../contracts/types/haptic";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type {
  BackgroundAssetInfo,
  GameAssetManifest,
  GameAssetManifestEntry,
  SpriteAssetInfo,
  SpriteOwnerType,
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
import { resolveLorebookKeeperTarget } from "../generation-core/lorebooks/lorebook-keeper-target";
import { applyAllSegmentEdits } from "../modes/game/state/segment-edits";
import {
  BUILT_IN_AGENT_TYPES,
  buildBuiltInAgentFallback,
  builtInAgentType,
  canonicalAgentActiveIdSet,
  isBuiltInAgent,
} from "./built-in-agent-fallback";
import { llmParameters } from "./context";
import { loadAgentMemory, secretPlotStateFromMemory } from "./agent-memory-runtime";
import {
  buildAvailableSpriteCharacter,
  normalizeSpriteDisplayModes,
  type AvailableSpriteCharacter,
  type SpriteDisplayMode,
} from "./sprite-expression-validation";
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
  activatedLorebookEntries: Array<{
    id: string;
    name: string;
    content: string;
    tag: string;
    matchedKeys?: string[];
    keys?: string[];
    secondaryKeys?: string[];
  }>;
  chatSummary: string | null;
  embeddingSource?: { embed(texts: string[]): Promise<number[][] | null> } | null;
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
  signal?: AbortSignal;
  forCharacterId?: string | null;
  agentTypes?: Set<string>;
  bypassCustomAgentActivation?: boolean;
  hideAutomatedSummarySourceMessages?: boolean;
  regenerateMessageId?: string | null;
  agentInjectionOverrides?: AgentInjection[];
  spotifyDjManualRetry?: boolean;
  spotifyDjForceFreshPick?: boolean;
}

export interface GenerationAgentRuntime {
  preInjections: AgentInjection[];
  preResults: AgentResult[];
  agentData: Record<string, string>;
  availableSprites: AvailableSpriteCharacter[];
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
  staticInjections: AgentInjection[];
}

const DIRECTOR_AGENT_TYPE = "director";
const ILLUSTRATOR_AGENT_TYPE = "illustrator";
const CARD_EVOLUTION_AUDITOR_AGENT_TYPE = "card-evolution-auditor";
const CHAT_SUMMARY_AGENT_TYPE = "chat-summary";
const HAPTIC_AGENT_TYPE = "haptic";
const KNOWLEDGE_RETRIEVAL_AGENT_TYPE = "knowledge-retrieval";
const KNOWLEDGE_ROUTER_AGENT_TYPE = "knowledge-router";
const KNOWLEDGE_AGENT_TYPES = new Set([KNOWLEDGE_RETRIEVAL_AGENT_TYPE, KNOWLEDGE_ROUTER_AGENT_TYPE]);
const ASSISTANT_INTERVAL_AGENT_TYPES = new Set([
  DIRECTOR_AGENT_TYPE,
  ILLUSTRATOR_AGENT_TYPE,
  CARD_EVOLUTION_AUDITOR_AGENT_TYPE,
]);
const USER_INTERVAL_AGENT_TYPES = new Set([CHAT_SUMMARY_AGENT_TYPE]);
const STATIC_CONTEXT_INJECTION_AGENT_TYPES = new Set<string>([BUILT_IN_AGENT_IDS.HTML]);
const TRACKER_AGENT_TYPES = new Set(
  BUILT_IN_AGENTS.filter((agent) => agent.category === "tracker").map((agent) => agent.id),
);
const MAX_ASSISTANT_RUN_INTERVAL = 100;
const MAX_CUSTOM_AGENT_USER_RUN_INTERVAL = 200;
const MAX_AGENT_PARALLEL_JOBS = 16;
const MAX_ILLUSTRATOR_REFERENCE_IMAGES = 8;
const IMAGE_REFERENCE_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;
const PROMPT_INJECTABLE_RESULT_TYPES = new Set(["context_injection", "director_event"]);
type AutomaticIntervalMessageRole = "assistant" | "user";

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

function mergeAgentInjections(...groups: AgentInjection[][]): AgentInjection[] {
  const merged: AgentInjection[] = [];
  const indexByType = new Map<string, number>();
  for (const group of groups) {
    for (const injection of group) {
      const text = injection.text.trim();
      if (!injection.agentType || !text) continue;
      const next = { ...injection, text };
      const index = indexByType.get(injection.agentType);
      if (index == null) {
        indexByType.set(injection.agentType, merged.length);
        merged.push(next);
      } else {
        merged[index] = next;
      }
    }
  }
  return merged;
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

function buildAvailableSpriteCharacterFromAssets(
  characterId: string,
  characterName: string,
  sprites: SpriteAssetInfo[],
  displayModes: readonly SpriteDisplayMode[],
): AvailableSpriteCharacter | null {
  return buildAvailableSpriteCharacter(characterId, characterName, spriteExpressionsForAgent(sprites, displayModes));
}

function estimateImageReferenceBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return new TextEncoder().encode(dataUrl).length;
  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function supportedImageMimeType(value: unknown): string | null {
  const normalized = readString(value).trim().toLowerCase().split(";")[0] ?? "";
  if (normalized === "image/jpg") return "image/jpeg";
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(normalized)) return normalized;
  return null;
}

function referenceImageFallbackMimeType(value: unknown): string | null {
  return readString(value).trim() ? supportedImageMimeType(value) : "image/png";
}

function imageDataUrl(value: unknown, fallbackMimeType: string | null = "image/png"): string {
  const text = readString(value).trim();
  if (!text) return "";
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(text)) return text;
  const wrapped = text.match(/^[a-z][a-z0-9+.-]*:\/\/(data:image\/(?:png|jpe?g|webp|gif);base64,.*)$/i);
  if (wrapped?.[1]) return wrapped[1];
  const base64 = text.replace(/\s+/g, "");
  if (fallbackMimeType && /^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 80) {
    return `data:${fallbackMimeType};base64,${base64}`;
  }
  return "";
}

function usableImageReference(value: unknown, fallbackMimeType: string | null = "image/png"): string {
  const dataUrl = imageDataUrl(value, fallbackMimeType);
  if (!dataUrl) return "";
  return estimateImageReferenceBytes(dataUrl) <= IMAGE_REFERENCE_PROVIDER_BYTE_LIMIT ? dataUrl : "";
}

function firstUsableReference(fallbackMimeType: string | null, ...values: unknown[]): string {
  for (const value of values) {
    const image = usableImageReference(value, fallbackMimeType);
    if (image) return image;
  }
  return "";
}

async function resolveReferenceImage(
  visuals: VisualAssetGateway | undefined,
  source: {
    image?: unknown;
    url?: unknown;
    base64?: unknown;
    mimeType?: unknown;
    avatarFilePath?: unknown;
    avatarFilename?: unknown;
  },
): Promise<string> {
  const fallbackMimeType = referenceImageFallbackMimeType(source.mimeType);
  const inline = firstUsableReference(fallbackMimeType, source.image, source.url, source.base64);
  if (inline) return inline;
  const resolved = visuals?.resolveReferenceImage
    ? await visuals
        .resolveReferenceImage({
          image: readString(source.image).trim() || null,
          url: readString(source.url).trim() || null,
          base64: readString(source.base64).trim() || null,
          mimeType: readString(source.mimeType).trim() || null,
          avatarFilePath: readString(source.avatarFilePath).trim() || null,
          avatarFilename: readString(source.avatarFilename).trim() || null,
        })
        .catch(() => null)
    : null;
  return usableImageReference(resolved, fallbackMimeType);
}

async function fullBodySpriteReference(
  visuals: VisualAssetGateway | undefined,
  sprites: Array<Record<string, unknown>>,
): Promise<string> {
  const fullBody = sprites.filter((sprite) => readString(sprite.expression).trim().toLowerCase().startsWith("full_"));
  const preferred =
    fullBody.find((sprite) =>
      ["full_idle", "full_neutral", "full_default"].includes(readString(sprite.expression).trim().toLowerCase()),
    ) ?? fullBody[0];
  return preferred ? resolveReferenceImage(visuals, preferred) : "";
}

function illustratorUsesAvatarReferences(agent: ResolvedAgent | undefined, chatMeta: JsonRecord): boolean {
  if (!agent) return false;
  return (
    (agent.settings.useAvatarReferences === undefined || agent.settings.useAvatarReferences === null
      ? true
      : boolish(agent.settings.useAvatarReferences, false)) || boolish(chatMeta.illustrationUseAvatarReferences, false)
  );
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
        images: Array.isArray(message.images)
          ? message.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
          : undefined,
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

function normalizeMaxParallelJobs(value: unknown): number {
  const parsed = readNumber(value, 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_AGENT_PARALLEL_JOBS, Math.trunc(parsed)));
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

function enabledAgentToolNames(agentType: string, settings: Record<string, unknown>): string[] {
  const configured = enabledToolNames(settings);
  if (configured.length > 0) return configured;
  if (agentType === "spotify") return DEFAULT_AGENT_TOOLS.spotify ?? [];
  return configured;
}

function stringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map((item) => readString(item).trim()).filter(Boolean));
}

function chatMetadata(input: GenerationAgentRuntimeInput): JsonRecord {
  return parseRecord(input.chat.metadata);
}

function chatToolsEnabled(input: GenerationAgentRuntimeInput): boolean {
  return boolish(chatMetadata(input).enableTools, false);
}

function chatActiveToolIds(input: GenerationAgentRuntimeInput): Set<string> {
  return stringSet(chatMetadata(input).activeToolIds);
}

function chatHasActiveAgents(input: GenerationAgentRuntimeInput): boolean {
  if (input.agentTypes && input.agentTypes.size > 0) return true;
  return chatActiveAgentIds(input).size > 0;
}

function chatActiveAgentIds(input: GenerationAgentRuntimeInput): Set<string> {
  return canonicalAgentActiveIdSet(chatMetadata(input).activeAgentIds);
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

async function loadKnowledgeSourceFileMaterial(
  storage: StorageGateway,
  settings: Record<string, unknown>,
): Promise<string> {
  const readKnowledgeSourceText = storage.knowledgeSourceText;
  if (!readKnowledgeSourceText) return "";
  const fileIds = stringArray(settings.sourceFileIds);
  if (fileIds.length === 0) return "";

  const parts = await Promise.all(
    uniqueStrings(fileIds).map(async (fileId) => {
      const source = await readKnowledgeSourceText<unknown>(fileId).catch(() => null);
      const sourceRecord = parseRecord(source);
      const text = readString(sourceRecord.text || source).trim();
      if (!text) return "";
      const name = readString(sourceRecord.originalName).trim() || fileId;
      return `### ${name}\n${text}`;
    }),
  );
  return parts.filter(Boolean).join("\n\n");
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
    let result: AgentResult | null = null;

    if (agent.type === KNOWLEDGE_ROUTER_AGENT_TYPE) {
      const scopedEntries = entries.filter((entry) => !entry.constant && knowledgeEntryPassesContext(entry, input));
      if (scopedEntries.length === 0) continue;
      result = await executeKnowledgeRouter(agent, context, agent.provider, agent.model, scopedEntries, {
        activatedEntries: scopedEntries.filter((entry) => activatedEntryIds.has(entry.id)),
        keywordScanEntries: scopedEntries.filter((entry) => !activatedEntryIds.has(entry.id)),
        embeddingSource: input.embeddingSource,
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
      });
    } else {
      const sourceMaterial = [
        formatKnowledgeSourceMaterial(entries),
        await loadKnowledgeSourceFileMaterial(deps.storage, agent.settings),
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!sourceMaterial) continue;
      result = await executeKnowledgeRetrieval(agent, context, agent.provider, agent.model, sourceMaterial);
    }

    if (!result) continue;

    results.push(result);
    onResult?.(result);
    const text = resultText(result);
    if (text) injections.push({ agentType: agent.type, agentName: agent.name, text });
  }

  return { injections, results };
}

function promptVisibleStoredMessages(
  input: GenerationAgentRuntimeInput,
  chatMode = readString(input.chat.mode || input.chat.chatMode, "roleplay"),
  chatMeta = parseRecord(input.chat.metadata),
): JsonRecord[] {
  return chatMode === "game" ? applyAllSegmentEdits(input.storedMessages, chatMeta) : input.storedMessages;
}

function activationScanMessages(input: GenerationAgentRuntimeInput): ActivationScanMessage[] {
  return promptVisibleStoredMessages(input)
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({ content: readString(message.content) }));
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
  if (builtInAgent && (ASSISTANT_INTERVAL_AGENT_TYPES.has(type) || USER_INTERVAL_AGENT_TYPES.has(type))) {
    const messageRole: AutomaticIntervalMessageRole = USER_INTERVAL_AGENT_TYPES.has(type) ? "user" : "assistant";
    const maxInterval = messageRole === "user" ? MAX_CUSTOM_AGENT_USER_RUN_INTERVAL : MAX_ASSISTANT_RUN_INTERVAL;
    const fallback = positiveInteger(BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[type], 5, maxInterval);
    const runInterval = positiveInteger(settings.runInterval, fallback, maxInterval);
    return runInterval > 1
      ? {
          agentId: id,
          agentType: type,
          messageRole,
          includePendingMessage: messageRole === "assistant",
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
  return readString(run.agentType || run.agent_type || run.type).trim();
}

function runAgentId(run: JsonRecord): string {
  return readString(run.agentId || run.agentConfigId || run.agent_config_id).trim();
}

function runChatId(run: JsonRecord): string {
  return readString(run.chatId || run.chat_id).trim();
}

function runMessageId(run: JsonRecord): string {
  return readString(run.messageId || run.message_id).trim();
}

function runCreatedAt(run: JsonRecord): string {
  return readString(run.created_at || run.createdAt).trim();
}

function runMatchesAgent(run: JsonRecord, agentType: string, agentId: string): boolean {
  const type = runAgentType(run);
  if (type) return type === agentType;
  const id = runAgentId(run);
  return !!agentId && id === agentId;
}

function illustratorRunCountsTowardInterval(run: JsonRecord): boolean {
  const resultType = readString(run.resultType || run.result_type).trim();
  if (resultType && resultType !== "image_prompt") return false;
  const data = parseRecord(run.resultData ?? run.result_data);
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
      .filter((run) => runChatId(run) === chatId)
      .filter((run) => runMatchesAgent(run, agentType, agentId))
      .filter((run) => boolish(run.success, false))
      .filter((run) => agentType !== ILLUSTRATOR_AGENT_TYPE || illustratorRunCountsTowardInterval(run))
      .map((run) => ({ run, messageIndex: indexes.get(runMessageId(run)) ?? -1 }))
      .filter((entry) => entry.messageIndex >= 0)
      .sort((a, b) => b.messageIndex - a.messageIndex || runCreatedAt(b.run).localeCompare(runCreatedAt(a.run)))[0]
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
  const messageId = runMessageId(lastRun);
  if (!messageId) return true;
  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  if (regenerateMessageId && regenerateMessageId === messageId) return true;
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
  const agentType = readString(agent.type || agent.agentType).trim();
  const scopedToolIds = chatActiveToolIds(input);
  const selectedNames = enabledAgentToolNames(agentType, settings).filter(
    (name) => scopedToolIds.size === 0 || scopedToolIds.has(name),
  );
  const selectedBuiltIns = selectedNames.map(builtInToolDefinition).filter((tool): tool is LLMToolDefinition => !!tool);
  const selectedCustomTools = selectedNames
    .map((name) => customTools.get(name))
    .filter((tool): tool is CustomToolRecord => !!tool && !BUILT_IN_TOOL_MAP.has(tool.name));
  if (selectedBuiltIns.length === 0 && selectedCustomTools.length === 0) return undefined;
  const allowedToolNames = new Set([
    ...selectedBuiltIns.map((tool) => tool.name),
    ...selectedCustomTools.map((tool) => tool.name),
  ]);

  return {
    tools: [...selectedBuiltIns, ...selectedCustomTools.map(customToolDefinition)],
    executeToolCall: async (call: LLMToolCall) => {
      const toolName = call.function?.name || call.name;
      if (!allowedToolNames.has(toolName)) {
        return stringifyToolResult({ error: `Tool not enabled for this agent: ${toolName}` });
      }
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

function skippedLorebookKeeperTargetResult(agent: JsonRecord): AgentResult {
  const name = readString(agent.name) || "Lorebook Keeper";
  return {
    agentId: readString(agent.id) || "lorebook-keeper",
    agentType: "lorebook-keeper",
    type: "lorebook_update",
    data: {
      code: "missing_lorebook_keeper_target",
      agentName: name,
    },
    tokensUsed: 0,
    durationMs: 0,
    success: false,
    error:
      "Lorebook Keeper needs a target lorebook. Choose a Target Lorebook in Chat Settings or activate a chat, character, or persona lorebook for this chat.",
  };
}

function suppressAgentForTurn(input: GenerationAgentRuntimeInput, type: string): boolean {
  const isRegeneration = !!readString(input.regenerateMessageId).trim();
  if (isRegeneration && type === "echo-chamber") return true;
  if (!input.agentTypes && boolish(chatMetadata(input).manualTrackers, false) && TRACKER_AGENT_TYPES.has(type))
    return true;
  if (type === HAPTIC_AGENT_TYPE) return !boolish(chatMetadata(input).enableHapticFeedback, false);
  return false;
}

async function resolveLorebookKeeperRuntimeTarget(
  storage: StorageGateway,
  input: GenerationAgentRuntimeInput,
): Promise<ReturnType<typeof resolveLorebookKeeperTarget>> {
  const lorebooks = await storage.list<JsonRecord>("lorebooks");
  return resolveLorebookKeeperTarget(lorebooks, {
    chat: input.chat,
    characters: input.characters.map((character) => ({ id: character.id })),
    persona: readString(input.chat.personaId) ? { id: input.chat.personaId } : null,
  });
}

async function resolveAgents(deps: AgentDeps, input: GenerationAgentRuntimeInput): Promise<ResolvedAgentsResult> {
  if (!chatHasActiveAgents(input)) return { agents: [], skippedResults: [], staticInjections: [] };
  const scopedAgentIds = chatActiveAgentIds(input);
  const activationMessages = activationScanMessages(input);
  const requestedAgentTypes = input.agentTypes ?? null;
  const explicitAgentTypes = requestedAgentTypes ?? scopedAgentIds;
  const agentRows = await deps.storage.list<JsonRecord>("agents");
  const configuredBuiltInTypes = new Set(
    agentRows.map(builtInAgentType).filter((type) => BUILT_IN_AGENT_TYPES.has(type)),
  );
  const rows = agentRows.filter((agent) => {
    const type = builtInAgentType(agent);
    const id = readString(agent.id);
    if (!boolish(agent.enabled, true)) return false;
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
    return true;
  });
  const resolvedBuiltInTypes = new Set(rows.map(builtInAgentType).filter((type) => BUILT_IN_AGENT_TYPES.has(type)));
  const fallbackRows = [...explicitAgentTypes]
    .filter((type) => BUILT_IN_AGENT_TYPES.has(type))
    .filter((type) => !resolvedBuiltInTypes.has(type))
    .filter((type) => !configuredBuiltInTypes.has(type))
    .filter((type) => requestedAgentTypes || type !== "lorebook-keeper")
    .map((type) => buildBuiltInAgentFallback(type, { allowDisabled: true }))
    .filter((agent): agent is JsonRecord => !!agent);
  rows.push(...fallbackRows);
  let customTools: Map<string, CustomToolRecord> | null = null;
  const resolved: ResolvedAgent[] = [];
  const skippedResults: AgentResult[] = [];
  const staticInjections: AgentInjection[] = [];
  let defaultAgentConnection: JsonRecord | null | undefined;
  for (const agent of rows) {
    const type = readString(agent.type || agent.agentType) || "agent";
    if (suppressAgentForTurn(input, type)) continue;
    const id = readString(agent.id) || type;
    const settings = agentSettings(agent);
    if (type === "lorebook-keeper" && !(await resolveLorebookKeeperRuntimeTarget(deps.storage, input))) {
      skippedResults.push(skippedLorebookKeeperTargetResult(agent));
      continue;
    }
    const builtInAgent = isBuiltInAgent(agent);
    if (!input.bypassCustomAgentActivation && !builtInAgent) {
      const activation = matchCustomAgentActivation(settings, activationMessages);
      if (activation.configured && !activation.matched) continue;
    }
    const intervalGate = automaticIntervalGate(input, id, type, settings, builtInAgent);
    if (intervalGate && !(await automaticIntervalAllowsRun(deps.storage, input, intervalGate))) {
      continue;
    }
    if (STATIC_CONTEXT_INJECTION_AGENT_TYPES.has(type) && normalizePhase(agent) === "pre_generation") {
      const text = readString(agent.promptTemplate).trim() || getDefaultAgentPrompt(type).trim();
      if (text) {
        staticInjections.push({
          agentType: type,
          agentName: readString(agent.name).trim() || readString(agent.type).trim() || type,
          text,
        });
      }
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
      maxParallelJobs: normalizeMaxParallelJobs(connection.maxParallelJobs),
      toolContext: buildAgentToolContext(deps, input, agent, settings, customTools),
    });
  }
  return { agents: resolved, skippedResults, staticInjections };
}

type SpotifyDjSourceType = "liked" | "playlist" | "artist" | "any";

function normalizeSpotifyDjSourceType(value: unknown): SpotifyDjSourceType {
  return value === "playlist" || value === "artist" || value === "any" ? value : "liked";
}

function cleanOptionalString(value: unknown): string | null {
  const text = readString(value).trim();
  return text || null;
}

function buildSpotifyDjConstraints(
  chatMode: string,
  chatMeta: JsonRecord,
  options: { manualRetry?: boolean; forceFreshPick?: boolean } = {},
): Record<string, unknown> {
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

  if (options.manualRetry) constraints.manualRetry = true;
  if (options.forceFreshPick) constraints.forceFreshPick = true;

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

  if (options.manualRetry || options.forceFreshPick) {
    constraints.retryNote = isGame
      ? "This is a manual Spotify DJ retry from game mode. Pick a fresh fitting track now and call spotify_play unless Spotify playback is unavailable; do not keep the current track merely because it still fits."
      : "This is a manual Spotify DJ retry from roleplay. Pick a fresh fitting queue now and call spotify_play unless Spotify playback is unavailable.";
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
  input: GenerationAgentRuntimeInput,
): Promise<Array<{ id: string; name: string; content: string; keys: string[]; locked: boolean }> | null> {
  const target = await resolveLorebookKeeperRuntimeTarget(storage, input);

  if (!target) return null;
  const entries = await storage.listLorebookEntries<JsonRecord>(target.id).catch(() => []);
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

function selectedSpriteOwners(value: unknown): {
  restrict: boolean;
  characterIds: Set<string>;
  personaIds: Set<string>;
} {
  const ownerKeys = stringSet(value);
  const characterIds = new Set<string>();
  const personaIds = new Set<string>();

  for (const ownerKey of ownerKeys) {
    if (ownerKey.startsWith("character:")) {
      const id = ownerKey.slice("character:".length).trim();
      if (id) characterIds.add(id);
      continue;
    }
    if (ownerKey.startsWith("persona:")) {
      const id = ownerKey.slice("persona:".length).trim();
      if (id) personaIds.add(id);
      continue;
    }
    characterIds.add(ownerKey);
    personaIds.add(ownerKey);
  }

  return { restrict: ownerKeys.size > 0, characterIds, personaIds };
}

async function loadAgentAvailableSprites(
  visuals: VisualAssetGateway,
  input: GenerationAgentRuntimeInput,
  context: AgentContext,
  chatMeta: JsonRecord,
): Promise<void> {
  const spriteDisplayModes = normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes);
  const selectedSprites = selectedSpriteOwners(chatMeta.spriteCharacterIds);
  const perCharacter = await Promise.all(
    context.characters
      .filter((character) => !selectedSprites.restrict || selectedSprites.characterIds.has(character.id))
      .map(async (character) => {
        const sprites = await visuals.listSprites(character.id, "character").catch(() => []);
        return buildAvailableSpriteCharacterFromAssets(character.id, character.name, sprites, spriteDisplayModes);
      }),
  );

  const personaId = readString(input.chat.personaId).trim();
  if (personaId && input.persona && (!selectedSprites.restrict || selectedSprites.personaIds.has(personaId))) {
    const sprites = await visuals.listSprites(personaId, "persona").catch(() => []);
    const spritePersona = buildAvailableSpriteCharacterFromAssets(
      personaId,
      input.persona.name,
      sprites,
      spriteDisplayModes,
    );
    if (spritePersona) perCharacter.push(spritePersona);
  }

  const availableSprites = perCharacter.filter(
    (spriteCharacter): spriteCharacter is NonNullable<typeof spriteCharacter> => Boolean(spriteCharacter),
  );
  if (availableSprites.length > 0) {
    context.memory._availableSprites = availableSprites;
  }
}

async function loadAgentIllustratorReferences(
  visuals: VisualAssetGateway | undefined,
  input: GenerationAgentRuntimeInput,
  context: AgentContext,
): Promise<void> {
  const references: Array<{ name: string; ownerType: SpriteOwnerType; image: string }> = [];
  const pushReference = (name: string, ownerType: SpriteOwnerType, image: string) => {
    if (!name.trim() || !image) return;
    if (references.some((reference) => reference.image === image)) return;
    references.push({ name: name.trim(), ownerType, image });
  };

  const subjects: Array<{
    id: string;
    name: string;
    ownerType: SpriteOwnerType;
    avatarUrl?: string | null;
    avatarFilePath?: string | null;
    avatarFilename?: string | null;
  }> = context.characters.map((character) => ({
    id: character.id,
    name: character.name,
    ownerType: "character",
    avatarUrl: character.avatarUrl,
    avatarFilePath: character.avatarFilePath,
    avatarFilename: character.avatarFilename,
  }));

  const personaId = readString(input.chat.personaId).trim();
  if (personaId && context.persona) {
    subjects.push({
      id: personaId,
      name: context.persona.name,
      ownerType: "persona",
      avatarUrl: context.persona.avatarUrl,
      avatarFilePath: context.persona.avatarFilePath,
      avatarFilename: context.persona.avatarFilename,
    });
  }

  const limitedSubjects =
    personaId && context.persona && subjects.length > MAX_ILLUSTRATOR_REFERENCE_IMAGES
      ? [...subjects.slice(0, MAX_ILLUSTRATOR_REFERENCE_IMAGES - 1), subjects[subjects.length - 1]!]
      : subjects.slice(0, MAX_ILLUSTRATOR_REFERENCE_IMAGES);

  for (const subject of limitedSubjects) {
    const sprites = visuals ? await visuals.listSprites(subject.id, subject.ownerType).catch(() => []) : [];
    const spriteReference = await fullBodySpriteReference(visuals, sprites as Array<Record<string, unknown>>);
    const avatarReference =
      spriteReference ||
      (await resolveReferenceImage(visuals, {
        image: subject.avatarUrl,
        url: subject.avatarUrl,
        avatarFilePath: subject.avatarFilePath,
        avatarFilename: subject.avatarFilename,
      }));
    pushReference(subject.name, subject.ownerType, avatarReference);
  }

  if (references.length > 0) {
    context.memory._illustratorReferenceImages = references;
  }
}

function availableSpritesFromContext(context: AgentContext): AvailableSpriteCharacter[] {
  const sprites = context.memory._availableSprites;
  return Array.isArray(sprites) ? (sprites as AvailableSpriteCharacter[]) : [];
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
  const illustratorAgent = agents.find((agent) => agent.type === ILLUSTRATOR_AGENT_TYPE);
  if (illustratorUsesAvatarReferences(illustratorAgent, chatMeta)) {
    await loadAgentIllustratorReferences(deps.visuals, input, context);
  }

  if (!deps.visuals) return;
  if (agentTypeActive(agents, "expression")) {
    await loadAgentAvailableSprites(deps.visuals, input, context, chatMeta);
  }

  const backgroundAgent = agents.find((agent) => agent.type === "background");
  if (backgroundAgent) {
    await loadAgentAvailableBackgrounds(deps.visuals, context, chatMeta, backgroundAgent);
  }
}

function hapticAgentActive(agents: ResolvedAgent[]): boolean {
  return agents.some((agent) => agent.type === HAPTIC_AGENT_TYPE);
}

function normalizedHapticDevices(status: HapticStatus | null): HapticDevice[] {
  if (!status?.connected || !Array.isArray(status.devices)) return [];
  return status.devices
    .filter((device): device is HapticDevice => {
      return typeof device.index === "number" && typeof device.name === "string" && Array.isArray(device.capabilities);
    })
    .map((device) => ({
      index: device.index,
      name: device.name,
      capabilities: device.capabilities.filter(
        (capability): capability is HapticDevice["capabilities"][number] => typeof capability === "string",
      ),
    }));
}

async function hapticStatusWithAutoConnect(
  integrations: IntegrationGateway,
  chatMeta: JsonRecord,
): Promise<HapticStatus | null> {
  const current = await integrations.haptic.status<HapticStatus>().catch(() => null);
  if (current?.connected && normalizedHapticDevices(current).length > 0) return current;
  const url = readString(chatMeta.hapticIntifaceUrl).trim();
  return integrations.haptic.connect<HapticStatus>(url ? { url } : undefined).catch(() => current);
}

async function populateHapticDeviceContext(
  integrations: IntegrationGateway,
  agents: ResolvedAgent[],
  memory: Record<string, unknown>,
  chatMeta: JsonRecord,
): Promise<void> {
  if (!hapticAgentActive(agents) || !boolish(chatMeta.enableHapticFeedback, false)) return;
  const status = await hapticStatusWithAutoConnect(integrations, chatMeta);
  const devices = normalizedHapticDevices(status);
  if (devices.length > 0) memory._connectedDevices = devices;
}

async function buildAgentContext(
  deps: AgentDeps,
  input: GenerationAgentRuntimeInput,
  agents: ResolvedAgent[],
): Promise<AgentContext> {
  const chatId = readString(input.chat.id);
  const chatMode = readString(input.chat.mode || input.chat.chatMode, "roleplay");
  const chatMeta = parseRecord(input.chat.metadata);
  const recentSourceMessages = promptVisibleStoredMessages(input, chatMode, chatMeta);
  const memoryRows = await Promise.all(
    (await deps.storage.list<JsonRecord>("agents"))
      .filter((agent) => readString(agent.id).trim())
      .map((agent) => loadAgentMemory(deps.storage, readString(agent.id), chatId)),
  );
  const memory = Object.assign({}, ...memoryRows);
  const secretPlotState = secretPlotStateFromMemory(memory);
  if (secretPlotState) memory._secretPlotState = secretPlotState;
  memory._spotifyDjConstraints = buildSpotifyDjConstraints(chatMode, chatMeta, {
    manualRetry: input.spotifyDjManualRetry === true,
    forceFreshPick: input.spotifyDjForceFreshPick === true,
  });
  if (lorebookKeeperActiveForContext(input)) {
    const existingLorebookEntries = await loadLorebookKeeperEntries(deps.storage, input);
    if (existingLorebookEntries) memory._existingLorebookEntries = existingLorebookEntries;
  }
  await populateHapticDeviceContext(deps.integrations, agents, memory, chatMeta);
  const context: AgentContext = {
    chatId,
    chatMode,
    recentMessages: recentSourceMessages
      .filter((message) => !hiddenFromAi(message))
      .slice(-60)
      .map((message) => ({
        role: readString(message.role, "user"),
        content: readString(message.content),
        characterId: readString(message.characterId).trim() || undefined,
      })),
    mainResponse: null,
    mainResponseCharacterId: readString(input.forCharacterId).trim() || null,
    gameState: isRecord(input.chat.gameState) ? (input.chat.gameState as unknown as AgentContext["gameState"]) : null,
    characters: input.characters.map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      avatarUrl: character.avatarUrl,
      avatarFilePath: character.avatarFilePath,
      avatarFilename: character.avatarFilename,
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
  const { agents, skippedResults, staticInjections } = await resolveAgents(deps, input);
  const preResults: AgentResult[] = [...skippedResults];
  const overrideInjections = normalizedAgentInjectionOverrides(input.agentInjectionOverrides);
  const initialInjections = mergeAgentInjections(staticInjections, overrideInjections);
  const agentData: Record<string, string> = agentDataFromInjections(initialInjections);
  for (const result of skippedResults) {
    onResult?.(result);
  }
  if (agents.length === 0) {
    return {
      preInjections: initialInjections,
      preResults,
      agentData,
      availableSprites: [],
      runParallel: async () => [],
      runPost: async () => [],
    };
  }

  const context = await buildAgentContext(deps, input, agents);
  const availableSprites = availableSpritesFromContext(context);
  const pipelineAgents = agents.filter((agent) => !KNOWLEDGE_AGENT_TYPES.has(agent.type));
  const pipeline = createAgentPipeline(pipelineAgents, context, (result) => {
    const text = resultText(result);
    if (text) agentData[result.agentType] = text;
    onResult?.(resultEventData(result));
  });

  if (overrideInjections.length > 0) {
    return {
      preInjections: initialInjections,
      preResults,
      agentData,
      availableSprites,
      runParallel: async () => pipeline.runParallel(),
      runPost: async (mainResponse) => pipeline.postGenerate(mainResponse, { preGenInjections: initialInjections }),
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
  const preInjections = mergeAgentInjections(initialInjections, pipelinePreInjections, knowledgePre.injections);
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
    availableSprites,
    runParallel: async () => pipeline.runParallel(),
    runPost: async (mainResponse) => pipeline.postGenerate(mainResponse, { preGenInjections: preInjections }),
  };
}
