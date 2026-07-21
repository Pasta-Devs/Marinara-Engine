// ──────────────────────────────────────────────
// Agent Executor — Single & Batched LLM execution
// ──────────────────────────────────────────────
import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import type { BaseLLMProvider, ChatMessage, LLMToolDefinition, LLMToolCall, LLMUsage } from "../llm/base-provider.js";
import type {
  AgentResult,
  AgentContext,
  AgentResultType,
  AgentCallDebugEvent,
  MacroContext,
  PresentCharacter,
  TrackerHiddenFields,
  WrapFormat,
} from "@marinara-engine/shared";
import {
  characterTrackerLockKey,
  compactQuestProgressForContext,
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_MAX_TOKENS,
  isTrackerFieldHidden,
  MIN_AGENT_MAX_TOKENS,
  normalizeTrackerHiddenFields,
  normalizeCustomAgentCapabilities,
  getDefaultAgentPrompt,
  normalizeRpgStatPools,
  resolveMacros,
} from "@marinara-engine/shared";
import { getMaxToolRounds, isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger } from "../../lib/logger.js";
import { wrapContent } from "../prompt/format-engine.js";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
import { settleAgentJobsWithConcurrencyLimit } from "./agent-concurrency.js";
import { getAssetManifest } from "../game/asset-manifest.service.js";

const MAX_AGENT_CONTEXT_MESSAGES = 200;
const EXPRESSION_AGENT_RECENT_CONTEXT_MESSAGES = 2;
const EXPRESSION_AGENT_CONTEXT_CHAR_LIMIT = 1200;
const EXPRESSION_AGENT_RESPONSE_CHAR_LIMIT = 6000;
const CHARACTER_LORE_DESCRIPTION_LIMIT = 2000;
const CHARACTER_LORE_FIELD_LIMIT = 1200;
const DEFAULT_AGENT_TEMPERATURE = 0.3;
const DEFAULT_AGENT_CALL_TIMEOUT_MS = 5 * 60_000;
const ILLUSTRATOR_AGENT_CALL_TIMEOUT_MS = 30 * 60_000;
const AGENT_BATCH_FALLBACK_MAX_CONCURRENT = 4;

/** Strip HTML/XML-style tags (e.g. <div style="..."> <br> <speaker>) from text to save tokens. */
function stripHtmlTags(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Minimal agent config needed for execution. */
export interface AgentExecConfig {
  id: string;
  type: string;
  name: string;
  phase: string;
  promptTemplate: string;
  connectionId: string | null;
  settings: Record<string, unknown>;
  customParameters?: Record<string, unknown>;
  maxOutputTokens?: number | null;
  enableCaching?: boolean;
  anthropicExtendedCacheTtl?: boolean;
  cachingAtDepth?: number;
}

/** Optional tool context for agents that need function calling. */
export interface AgentToolContext {
  tools: LLMToolDefinition[];
  executeToolCall: (call: LLMToolCall) => Promise<string>;
}

type MusicProvider = "spotify" | "youtube" | "custom";
type CustomMusicSource = "game-assets" | "folder";
const LOCAL_MUSIC_PATH_PREFIX = "local-music:";
const LOCAL_MUSIC_AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".webm"]);

function getMusicProvider(settings: Record<string, unknown> | null | undefined): MusicProvider {
  const raw = settings?.musicProvider ?? settings?.musicPlayerSource;
  if (raw === "custom") return "custom";
  return raw === "youtube" ? "youtube" : "spotify";
}

function getCustomMusicSource(settings: Record<string, unknown> | null | undefined): CustomMusicSource {
  const source = settings?.customMusicSource ?? settings?.localMusicSource;
  return source === "folder" ? "folder" : "game-assets";
}

function normalizeAgentContextWrapFormat(value: unknown): WrapFormat {
  return value === "markdown" || value === "none" || value === "xml" ? value : "xml";
}

function formatAgentContextBlock(content: string, sectionName: string, format: WrapFormat): string {
  if (format === "none") return `${sectionName}\n${content.trim()}`;
  return wrapContent(content, sectionName, format);
}

function musicDjUsesYoutube(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  return config.type === "spotify" && getMusicProvider(config.settings) === "youtube";
}

function musicDjUsesCustom(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  return config.type === "spotify" && getMusicProvider(config.settings) === "custom";
}

function musicDjUsesJsonOnlyProvider(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  return musicDjUsesYoutube(config) || musicDjUsesCustom(config);
}

function getDefaultPromptForAgent(config: Pick<AgentExecConfig, "type" | "settings">): string {
  if (musicDjUsesYoutube(config)) return getDefaultAgentPrompt("youtube");
  if (musicDjUsesCustom(config)) return getDefaultAgentPrompt("local-music");
  return getDefaultAgentPrompt(config.type);
}

function stringifyAgentSettingMacroValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyAgentSettingMacroValue(entry))
      .filter(Boolean)
      .join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readAgentSettingPath(settings: Record<string, unknown>, path: string): { found: boolean; value: unknown } {
  const parts = path.split(".");
  let cursor: unknown = settings;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return { found: false, value: undefined };
    if (!Object.prototype.hasOwnProperty.call(cursor, part)) return { found: false, value: undefined };
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return { found: true, value: cursor };
}

function renderAgentSettingsMacros(
  template: string,
  settings: Record<string, unknown>,
  options: { escapeValues?: boolean } = {},
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    const { found, value } = readAgentSettingPath(settings, key);
    if (!found) return match;
    const rendered = stringifyAgentSettingMacroValue(value);
    return options.escapeValues ? escapeXml(rendered) : rendered;
  });
}

function renderAgentMacroValue(value: string | null | undefined, options: { escapeValues?: boolean }): string {
  const text = value ?? "";
  return options.escapeValues ? escapeXml(text) : text;
}

export function buildAgentPromptMacroContext(
  context: AgentContext,
  options: { escapeValues?: boolean } = {},
): MacroContext {
  const characters = context.characters.map((character) => character.name.trim()).filter(Boolean);
  const firstCharacter = context.characters[0] ?? null;
  const latestUserMessage = findLatestUserMessage(context);
  const value = (entry: string | null | undefined) => renderAgentMacroValue(entry, options);

  return {
    user: value(context.persona?.name?.trim() || "User"),
    char: value(characters.join(", ") || "Assistant"),
    characters: characters.map(value),
    variables: {},
    lastInput: latestUserMessage ? value(latestUserMessage.content) : "",
    chatId: value(context.chatId),
    characterProfiles: context.characters.map((character) => ({
      name: value(character.name),
      description: value(character.description),
      personality: value(character.personality),
      backstory: value(character.backstory),
      appearance: value(character.appearance),
      scenario: value(character.scenario),
      example: value(character.mesExample),
      systemPrompt: value(character.systemPrompt),
      postHistoryInstructions: value(character.postHistoryInstructions),
    })),
    characterFields: firstCharacter
      ? {
          description: value(firstCharacter.description),
          personality: value(firstCharacter.personality),
          backstory: value(firstCharacter.backstory),
          appearance: value(firstCharacter.appearance),
          scenario: value(firstCharacter.scenario),
          example: value(firstCharacter.mesExample),
          systemPrompt: value(firstCharacter.systemPrompt),
          postHistoryInstructions: value(firstCharacter.postHistoryInstructions),
        }
      : undefined,
    personaFields: context.persona
      ? {
          description: value(context.persona.description),
          personality: value(context.persona.personality),
          backstory: value(context.persona.backstory),
          appearance: value(context.persona.appearance),
          scenario: value(context.persona.scenario),
        }
      : undefined,
  };
}

export function renderAgentPromptTemplate(
  template: string,
  settings: Record<string, unknown>,
  context: AgentContext,
  options: { escapeValues?: boolean } = {},
): string {
  const withSettingMacros = renderAgentSettingsMacros(template, settings, options);
  return resolveMacros(withSettingMacros, buildAgentPromptMacroContext(context, options), { trimResult: false });
}

export function normalizeAgentContextSize(value: unknown, fallback = DEFAULT_AGENT_CONTEXT_SIZE): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : fallback;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.max(1, Math.min(MAX_AGENT_CONTEXT_MESSAGES, Math.trunc(parsed)));
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(token|secret|password|api[_-]?key|authorization|cookie|credential)/i.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    redacted[key] = redactSensitiveValue(entry);
  }
  return redacted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function shouldIncludeQuestContext(agentTypes: string[]): boolean {
  return agentTypes.includes("quest");
}

function compactQuestPlayerStatsForContext(playerStats: unknown, agentTypes: string[]): unknown {
  if (!isRecord(playerStats) || playerStats.activeQuests === undefined) {
    return playerStats;
  }

  if (!shouldIncludeQuestContext(agentTypes)) {
    return Object.fromEntries(Object.entries(playerStats).filter(([key]) => key !== "activeQuests"));
  }

  return {
    ...playerStats,
    activeQuests: compactQuestProgressForContext(playerStats.activeQuests),
  };
}

function omitQuestFieldLocksForContext(fieldLocks: unknown): unknown {
  if (!isRecord(fieldLocks)) return fieldLocks;

  let changed = false;
  const nextEntries = Object.entries(fieldLocks).filter(([key]) => {
    const keep = !key.startsWith("quests.");
    if (!keep) changed = true;
    return keep;
  });

  return changed ? Object.fromEntries(nextEntries) : fieldLocks;
}

const HIDEABLE_CHARACTER_TRACKER_FIELDS = ["mood", "appearance", "outfit", "thoughts"] as const;

function compactPresentCharactersForHiddenFields(
  presentCharacters: unknown,
  hiddenFields: TrackerHiddenFields,
): unknown {
  if (!Array.isArray(presentCharacters) || Object.keys(hiddenFields).length === 0) return presentCharacters;

  let changed = false;
  const compacted = presentCharacters.map((character, index) => {
    if (!isRecord(character)) return character;
    let next: Record<string, unknown> | null = null;

    for (const field of HIDEABLE_CHARACTER_TRACKER_FIELDS) {
      const key = characterTrackerLockKey(character as Pick<PresentCharacter, "characterId" | "name">, index, field);
      if (field in character && isTrackerFieldHidden(hiddenFields, key)) {
        next ??= { ...character };
        delete next[field];
        changed = true;
      }
    }

    return next ?? character;
  });

  return changed ? compacted : presentCharacters;
}

function omitHiddenFieldLocksForContext(fieldLocks: unknown, hiddenFields: TrackerHiddenFields): unknown {
  if (!isRecord(fieldLocks) || Object.keys(hiddenFields).length === 0) return fieldLocks;

  let changed = false;
  const nextEntries = Object.entries(fieldLocks).filter(([key]) => {
    const keep = !isTrackerFieldHidden(hiddenFields, key);
    if (!keep) changed = true;
    return keep;
  });

  return changed ? Object.fromEntries(nextEntries) : fieldLocks;
}

export function compactGameStateForAgentContext(gameState: unknown, agentTypes: string[]): unknown {
  if (!isRecord(gameState)) {
    return gameState;
  }

  const hiddenFields = normalizeTrackerHiddenFields(gameState.hiddenTrackerFields);
  const presentCharacters = compactPresentCharactersForHiddenFields(gameState.presentCharacters, hiddenFields);
  const playerStats = compactQuestPlayerStatsForContext(gameState.playerStats, agentTypes);
  const visibleFieldLocks = omitHiddenFieldLocksForContext(gameState.fieldLocks, hiddenFields);
  const fieldLocks = shouldIncludeQuestContext(agentTypes) ? visibleFieldLocks : omitQuestFieldLocksForContext(visibleFieldLocks);

  if (
    presentCharacters === gameState.presentCharacters &&
    playerStats === gameState.playerStats &&
    fieldLocks === gameState.fieldLocks &&
    gameState.hiddenTrackerFields === undefined
  ) {
    return gameState;
  }

  const next = { ...gameState };
  delete next.hiddenTrackerFields;
  if (presentCharacters !== gameState.presentCharacters) next.presentCharacters = presentCharacters;
  if (playerStats !== gameState.playerStats) next.playerStats = playerStats;
  if (fieldLocks !== gameState.fieldLocks) next.fieldLocks = fieldLocks;
  return next;
}

type RenderedAgentTemplateMap = Map<string, string>;

function renderAgentTemplatesForOutput(
  configs: AgentExecConfig[],
  context: AgentContext,
  options: { escapeValues?: boolean } = {},
): RenderedAgentTemplateMap {
  const templates: RenderedAgentTemplateMap = new Map();
  const renderOptions = options.escapeValues === undefined ? {} : { escapeValues: options.escapeValues };
  for (const config of configs) {
    templates.set(
      config.type,
      renderAgentPromptTemplate(
        config.promptTemplate || getDefaultPromptForAgent(config),
        config.settings,
        context,
        renderOptions,
      ),
    );
  }
  return templates;
}

function getAgentOutputTemplate(
  config: AgentExecConfig,
  context: AgentContext,
  renderedTemplates?: RenderedAgentTemplateMap,
): string {
  return (
    renderedTemplates?.get(config.type) ??
    renderAgentPromptTemplate(config.promptTemplate || getDefaultPromptForAgent(config), config.settings, context, {
      escapeValues: normalizeAgentContextWrapFormat(context.wrapFormat) === "xml",
    })
  );
}

function buildAgentOutputFormatBody(
  configs: AgentExecConfig[],
  context: AgentContext,
  renderedTemplates?: RenderedAgentTemplateMap,
): string {
  if (configs.length === 0) return "";

  const parts: string[] = [];
  if (configs.length > 1) {
    const quotedAgentIds = configs.map((config) => JSON.stringify(config.type)).join(", ");
    parts.push("Return ONLY one valid JSON object with one property per active agent ID.");
    parts.push(`Active agent IDs in this request: ${quotedAgentIds}.`);
    parts.push("Use this exact top-level property layout; replace each null with that agent's output:");
    parts.push("{");
    configs.forEach((config, index) => {
      const comma = index === configs.length - 1 ? "" : ",";
      parts.push(`  ${JSON.stringify(config.type)}: null${comma}`);
    });
    parts.push("}");
    parts.push("When an agent asks for JSON, put that requested JSON directly as that agent property's value.");
    parts.push("Do not add properties for agents not listed above.");
  } else {
    const config = configs[0]!;
    const jsonInstruction = agentResponseIsJson(config)
      ? "Return ONLY one valid JSON object"
      : "Return ONLY the requested output";
    parts.push(`${jsonInstruction} for active agent ${JSON.stringify(config.type)}.`);
  }

  parts.push("Do not include markdown fences, commentary, explanations, or any text outside the requested output.");
  parts.push("");
  parts.push("Active agent output contracts:");

  for (const config of configs) {
    const template = getAgentOutputTemplate(config, context, renderedTemplates).trim();
    parts.push("");
    parts.push(`Agent ${JSON.stringify(config.type)} (${config.name}):`);
    parts.push(template || "Return the requested output for this agent.");
  }

  return parts.join("\n");
}

export function buildAgentOutputFormatBlock(
  configs: AgentExecConfig[],
  context: AgentContext,
  renderedTemplates?: RenderedAgentTemplateMap,
): string {
  const wrapFormat = normalizeAgentContextWrapFormat(context.wrapFormat);
  const body = buildAgentOutputFormatBody(configs, context, renderedTemplates);
  // The contract contains trusted, user-authored prompt-template markup. Escape
  // interpolated macro values when rendering the template, but preserve literal
  // tags such as <chat_summary> and <existing_entries> in the contract itself.
  const formattedBody = wrapFormat === "xml" ? body : sanitizePromptLeaf(body, wrapFormat);
  return wrapContent(formattedBody, "Output Format", wrapFormat);
}

export function formatToolPayloadForLog(payload: string, maxLength = 400): string {
  const truncate = (value: string) => (value.length > maxLength ? `${value.slice(0, maxLength)}...` : value);
  const scrubSensitiveText = (value: string) =>
    value
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
      .replace(/((?:access|refresh|id)?[_-]?token["'\s:=]+)([^,\s"']+)/gi, "$1[REDACTED]")
      .replace(
        /((?:api[_-]?key|password|secret|authorization|cookie|credential)["'\s:=]+)([^,\s"']+)/gi,
        "$1[REDACTED]",
      );

  try {
    const parsed = JSON.parse(payload);
    const formatted = JSON.stringify(redactSensitiveValue(parsed));
    return truncate(scrubSensitiveText(formatted));
  } catch {
    const scrubbed = scrubSensitiveText(payload);
    return truncate(scrubbed);
  }
}

function normalizeAgentMaxTokens(value: unknown, fallback = DEFAULT_AGENT_MAX_TOKENS): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(parsed));
}

function normalizeAgentTemperature(value: unknown, fallback = DEFAULT_AGENT_TEMPERATURE): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(2, parsed));
}

function agentCustomParameters(config: AgentExecConfig): Record<string, unknown> | undefined {
  return config.customParameters && Object.keys(config.customParameters).length > 0
    ? config.customParameters
    : undefined;
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const activeSignals = signals.filter((signal) => !signal.aborted);
  const abortedSignal = signals.find((signal) => signal.aborted);
  if (abortedSignal) return abortedSignal;
  if (activeSignals.length === 1) return activeSignals[0]!;
  if (typeof AbortSignal.any === "function") return AbortSignal.any(activeSignals);

  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of activeSignals) {
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

function agentCallSignal(parentSignal?: AbortSignal, agentType?: "illustrator"): AbortSignal {
  const timeoutMs = agentType === "illustrator" ? ILLUSTRATOR_AGENT_CALL_TIMEOUT_MS : DEFAULT_AGENT_CALL_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return parentSignal ? combineAbortSignals([parentSignal, timeoutSignal]) : timeoutSignal;
}

function applyProviderMaxTokensOverride(provider: BaseLLMProvider, maxTokens: number): number {
  return provider.maxTokensOverrideValue !== null ? Math.min(maxTokens, provider.maxTokensOverrideValue) : maxTokens;
}

function applyAgentMaxTokensCaps(provider: BaseLLMProvider, maxTokens: number, modelMaxOutput: unknown): number {
  const cappedByConnection = applyProviderMaxTokensOverride(provider, maxTokens);
  if (typeof modelMaxOutput !== "number" || !Number.isFinite(modelMaxOutput) || modelMaxOutput <= 0) {
    return cappedByConnection;
  }
  return Math.min(cappedByConnection, Math.floor(modelMaxOutput));
}

function debugMessages(messages: ChatMessage[]): AgentCallDebugEvent["messages"] {
  return messages.map((message) => {
    const next: NonNullable<AgentCallDebugEvent["messages"]>[number] = {
      role: message.role,
      content: message.content,
    };
    const name = (message as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) next.name = name;
    return next;
  });
}

function debugToolNames(tools?: LLMToolDefinition[]): string[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => tool.function.name);
}

function debugUsage(usage?: LLMUsage): Partial<AgentCallDebugEvent> {
  if (!usage) return {};
  const fields: Partial<AgentCallDebugEvent> = {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
  if (typeof usage.completionReasoningTokens === "number") {
    fields.reasoningTokens = usage.completionReasoningTokens;
  }
  return fields;
}

function emitAgentDebug(context: AgentContext, event: AgentCallDebugEvent): void {
  try {
    context.agentDebug?.(event);
  } catch (err) {
    logger.warn(err, "[agent-debug] Failed to emit debug event for %s", event.agentType);
  }
}

function agentDebugBase(
  config: AgentExecConfig,
  model: string,
  temperature: number,
  maxTokens: number,
): Pick<AgentCallDebugEvent, "agentId" | "agentType" | "agentName" | "phase" | "model" | "temperature" | "maxTokens"> {
  return {
    agentId: config.id,
    agentType: config.type,
    agentName: config.name,
    phase: config.phase,
    model,
    temperature,
    maxTokens,
  };
}

function responseDebugFields(response: string): Pick<AgentCallDebugEvent, "response" | "responsePreview"> {
  return {
    response,
    responsePreview: response.length > 1200 ? `${response.slice(0, 1200)}...` : response,
  };
}

/**
 * Execute a single agent: build prompt → call LLM → parse response.
 * If toolContext is provided, the agent can make tool calls in a loop.
 */
export async function executeAgent(
  config: AgentExecConfig,
  context: AgentContext,
  provider: BaseLLMProvider,
  model: string,
  toolContext?: AgentToolContext,
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const template = renderAgentPromptTemplate(
      config.promptTemplate || getDefaultPromptForAgent(config),
      config.settings,
      context,
      { escapeValues: normalizeAgentContextWrapFormat(context.wrapFormat) === "xml" },
    );
    if (!template) {
      return makeError(config, "No prompt template configured", startTime);
    }

    const messages =
      config.type === "expression"
        ? buildExpressionAgentMessages(config, template, context)
        : config.type === "knowledge-retrieval"
          ? buildKnowledgeRetrievalAgentMessages(config, template, context)
          : config.type === "spotify"
            ? buildSpotifyAgentMessages(config, template, context)
            : buildStandardAgentMessages(config, template, context);

    // Agents use lower temperature for reliability
    const temperature = normalizeAgentTemperature(config.settings.temperature);
    const maxTokens = applyAgentMaxTokensCaps(
      provider,
      normalizeAgentMaxTokens(config.settings.maxTokens),
      config.maxOutputTokens,
    );
    const streamResponses = context.streaming !== false;
    const customParameters = agentCustomParameters(config);

    // If tools are available, use the tool call loop.
    // `await` so a rethrow from the tool loop is caught by this function's
    // catch below and converted into a failed AgentResult for THIS agent only,
    // instead of rejecting the promise and corrupting co-grouped agents in the
    // pipeline (see executeGroup's Promise.all).
    if (toolContext && toolContext.tools.length > 0) {
      return await executeAgentWithTools(
        config,
        messages,
        provider,
        model,
        temperature,
        maxTokens,
        toolContext,
        streamResponses,
        startTime,
        context,
      );
    }

    // Call LLM (streaming to avoid proxy timeouts, no tools)
    logger.info(`[agent] ${config.type} (${config.name}) — ${model}`);
    for (const msg of messages) {
      logger.debug(`[agent] [${msg.role}] ${msg.content}`);
    }
    logger.debug(`[agent] ═══ END PROMPT — temperature=${temperature} maxTokens=${maxTokens} ═══\n`);
    emitAgentDebug(context, {
      stage: "request",
      ...agentDebugBase(config, model, temperature, maxTokens),
      messageCount: messages.length,
      messages: debugMessages(messages),
    });

    let responseText = "";
    const result = await provider.chatComplete(messages, {
      model,
      temperature,
      maxTokens,
      enableCaching: config.enableCaching,
      anthropicExtendedCacheTtl: config.anthropicExtendedCacheTtl,
      cachingAtDepth: config.cachingAtDepth,
      customParameters,
      stream: streamResponses,
      onToken: streamResponses
        ? (chunk) => {
            responseText += chunk;
          }
        : undefined,
      signal: agentCallSignal(context.signal, config.type === "illustrator" ? "illustrator" : undefined),
    });

    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    logger.info(`[agent] ${config.type} done (${responseText.length} chars, ${Date.now() - startTime}ms)`);
    logger.debug(`[agent] ${config.type} raw response: ${responseText.slice(0, 500)}`);
    emitAgentDebug(context, {
      stage: "response",
      ...agentDebugBase(config, model, temperature, maxTokens),
      messageCount: messages.length,
      durationMs: Date.now() - startTime,
      finishReason: result.finishReason,
      ...debugUsage(result.usage),
      ...responseDebugFields(responseText),
    });

    // Parse the result based on agent type
    let parsed = parseAgentResponse(config, responseText);
    let invalidJson = shouldFailInvalidJsonResult(config, parsed.data);
    let totalTokens = result.usage?.totalTokens ?? 0;

    if (invalidJson && shouldRetryInvalidJsonAgent(config) && !context.signal?.aborted) {
      logger.warn("[agent] %s returned invalid JSON; retrying once with strict JSON reminder", config.type);
      const retryMessages = buildInvalidJsonRetryMessages(messages, parsed.type, responseText);
      emitAgentDebug(context, {
        stage: "retry_request",
        ...agentDebugBase(config, model, temperature, maxTokens),
        messageCount: retryMessages.length,
        messages: debugMessages(retryMessages),
      });
      let retryResponseText = "";
      const retryResult = await provider.chatComplete(retryMessages, {
        model,
        temperature,
        maxTokens,
        enableCaching: config.enableCaching,
        anthropicExtendedCacheTtl: config.anthropicExtendedCacheTtl,
        cachingAtDepth: config.cachingAtDepth,
        customParameters,
        stream: streamResponses,
        onToken: streamResponses
          ? (chunk) => {
              retryResponseText += chunk;
            }
          : undefined,
        signal: agentCallSignal(context.signal, config.type === "illustrator" ? "illustrator" : undefined),
      });
      totalTokens += retryResult.usage?.totalTokens ?? 0;
      if (!retryResponseText && retryResult.content) retryResponseText = retryResult.content;
      responseText = retryResponseText.trim();
      logger.info(
        "[agent] %s JSON retry done (%d chars, %dms)",
        config.type,
        responseText.length,
        Date.now() - startTime,
      );
      logger.debug("[agent] %s JSON retry raw response: %s", config.type, responseText.slice(0, 500));
      emitAgentDebug(context, {
        stage: "retry_response",
        ...agentDebugBase(config, model, temperature, maxTokens),
        messageCount: retryMessages.length,
        durationMs: Date.now() - startTime,
        finishReason: retryResult.finishReason,
        ...debugUsage(retryResult.usage),
        ...responseDebugFields(responseText),
      });
      parsed = parseAgentResponse(config, responseText);
      invalidJson = shouldFailInvalidJsonResult(config, parsed.data);
    }

    return {
      agentId: config.id,
      agentType: config.type,
      type: parsed.type,
      data: parsed.data,
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
      success: !invalidJson,
      error: invalidJson ? invalidJsonAgentError(parsed.type) : null,
    };
  } catch (err) {
    emitAgentDebug(context, {
      stage: "error",
      ...agentDebugBase(
        config,
        model,
        normalizeAgentTemperature(config.settings.temperature),
        normalizeAgentMaxTokens(config.settings.maxTokens),
      ),
      messageCount: 0,
      durationMs: Date.now() - startTime,
      error: extractErrorMessage(err),
    });
    return makeError(config, extractErrorMessage(err), startTime);
  }
}

/**
 * Execute an agent with tool-calling support.
 * Loops: call LLM → handle tool calls → feed results back → repeat until final response.
 */
async function executeAgentWithTools(
  config: AgentExecConfig,
  initialMessages: ChatMessage[],
  provider: BaseLLMProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  toolContext: AgentToolContext,
  streamResponses: boolean,
  startTime: number,
  context: AgentContext,
): Promise<AgentResult> {
  const maxToolRounds = getMaxToolRounds();
  const loopMessages = [...initialMessages];
  let totalTokens = 0;
  const debugAgentsEnabled = isDebugAgentsEnabled() && logger.isLevelEnabled("debug");
  const customParameters = agentCustomParameters(config);
  const toolLoopSignal = agentCallSignal(context.signal, config.type === "illustrator" ? "illustrator" : undefined);

  for (let round = 0; round < maxToolRounds; round++) {
    emitAgentDebug(context, {
      stage: "request",
      ...agentDebugBase(config, model, temperature, maxTokens),
      messageCount: loopMessages.length,
      messages: debugMessages(loopMessages),
      tools: debugToolNames(toolContext.tools),
      round: round + 1,
    });
    const result = await provider.chatComplete(loopMessages, {
      model,
      temperature,
      maxTokens,
      enableCaching: config.enableCaching,
      anthropicExtendedCacheTtl: config.anthropicExtendedCacheTtl,
      cachingAtDepth: config.cachingAtDepth,
      customParameters,
      stream: streamResponses,
      tools: toolContext.tools,
      signal: toolLoopSignal,
    });

    totalTokens += result.usage?.totalTokens ?? 0;
    emitAgentDebug(context, {
      stage: "response",
      ...agentDebugBase(config, model, temperature, maxTokens),
      messageCount: loopMessages.length,
      tools: debugToolNames(toolContext.tools),
      round: round + 1,
      durationMs: Date.now() - startTime,
      finishReason: result.finishReason,
      ...debugUsage(result.usage),
      ...responseDebugFields(result.content?.trim() ?? ""),
    });

    // No tool calls → final response
    if (!result.toolCalls || result.toolCalls.length === 0) {
      const responseText = result.content?.trim() ?? "";
      const parsed = parseAgentResponse(config, responseText);
      const invalidJson = shouldFailInvalidJsonResult(config, parsed.data);
      return {
        agentId: config.id,
        agentType: config.type,
        type: parsed.type,
        data: parsed.data,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        success: !invalidJson,
        error: invalidJson ? invalidJsonAgentError(parsed.type) : null,
      };
    }

    // Append assistant message with tool calls
    loopMessages.push({
      role: "assistant",
      content: result.content ?? "",
      tool_calls: result.toolCalls,
      ...(result.providerMetadata ? { providerMetadata: result.providerMetadata } : {}),
    });

    // Execute each tool call and append results
    for (const tc of result.toolCalls) {
      logger.info("[agent-tools] %s calling: %s", config.type, tc.function.name);
      if (debugAgentsEnabled) {
        logger.debug("[agent-tools] %s args: %s", config.type, formatToolPayloadForLog(tc.function.arguments));
      }
      let toolResult: string;
      try {
        toolResult = await toolContext.executeToolCall(tc);
      } catch (err) {
        logger.error(err, "[agent-tools] %s %s failed", config.type, tc.function.name);
        throw err;
      }
      logger.info("[agent-tools] %s %s completed", config.type, tc.function.name);
      if (debugAgentsEnabled) {
        logger.debug("[agent-tools] %s result: %s", config.type, formatToolPayloadForLog(toolResult));
      }
      loopMessages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: tc.id,
      });
    }
  }

  // Exhausted tool rounds — make one final call without tools to get JSON response
  emitAgentDebug(context, {
    stage: "request",
    ...agentDebugBase(config, model, temperature, maxTokens),
    messageCount: loopMessages.length,
    messages: debugMessages(loopMessages),
    round: maxToolRounds + 1,
  });
  const finalResult = await provider.chatComplete(loopMessages, {
    model,
    temperature,
    maxTokens,
    enableCaching: config.enableCaching,
    anthropicExtendedCacheTtl: config.anthropicExtendedCacheTtl,
    cachingAtDepth: config.cachingAtDepth,
    customParameters,
    stream: streamResponses,
    signal: toolLoopSignal,
  });
  totalTokens += finalResult.usage?.totalTokens ?? 0;
  const responseText = finalResult.content?.trim() ?? "";
  emitAgentDebug(context, {
    stage: "response",
    ...agentDebugBase(config, model, temperature, maxTokens),
    messageCount: loopMessages.length,
    round: maxToolRounds + 1,
    durationMs: Date.now() - startTime,
    finishReason: finalResult.finishReason,
    ...debugUsage(finalResult.usage),
    ...responseDebugFields(responseText),
  });
  const parsed = parseAgentResponse(config, responseText);
  const invalidJson = shouldFailInvalidJsonResult(config, parsed.data);
  return {
    agentId: config.id,
    agentType: config.type,
    type: parsed.type,
    data: parsed.data,
    tokensUsed: totalTokens,
    durationMs: Date.now() - startTime,
    success: !invalidJson,
    error: invalidJson ? invalidJsonAgentError(parsed.type) : null,
  };
}

// ──────────────────────────────────────────────
// Batched Execution — Multiple agents in one LLM call
// ──────────────────────────────────────────────

/**
 * Execute multiple agents in a single LLM call.
 * Combines all agent prompts into one request and asks for a raw JSON map,
 * then parses the combined response back into individual AgentResults.
 *
 * All agents in the batch MUST share the same provider+model.
 * Falls back to individual calls if the batch response can't be parsed.
 */
export async function executeAgentBatch(
  configs: AgentExecConfig[],
  context: AgentContext,
  provider: BaseLLMProvider,
  model: string,
): Promise<AgentResult[]> {
  if (configs.length === 0) return [];
  const isolatedConfigs = configs.filter(shouldRunAgentIndividually);
  if (isolatedConfigs.length === configs.length) {
    logger.info(
      "[agent-batch] Running %d isolated agent(s) individually: [%s]",
      isolatedConfigs.length,
      isolatedConfigs.map((c) => c.type).join(", "),
    );
    if (isolatedConfigs.length > AGENT_BATCH_FALLBACK_MAX_CONCURRENT) {
      logger.warn(
        "[agent-batch] Limiting %d isolated agent request(s) to %d concurrent request(s)",
        isolatedConfigs.length,
        AGENT_BATCH_FALLBACK_MAX_CONCURRENT,
      );
    }
    const isolatedSettled = await settleAgentJobsWithConcurrencyLimit(
      isolatedConfigs,
      AGENT_BATCH_FALLBACK_MAX_CONCURRENT,
      (config) => executeAgent(config, context, provider, model),
    );
    return isolatedSettled.map((entry, index) =>
      entry.status === "fulfilled"
        ? entry.value
        : makeError(
            isolatedConfigs[index]!,
            entry.reason instanceof Error ? entry.reason.message : "Agent execution failed",
            Date.now(),
          ),
    );
  }
  if (isolatedConfigs.length > 0 && isolatedConfigs.length < configs.length) {
    logger.info(
      "[agent-batch] Running %d compact agent(s) outside batch: [%s]",
      isolatedConfigs.length,
      isolatedConfigs.map((c) => c.type).join(", "),
    );
    const batchedConfigs = configs.filter((config) => !shouldRunAgentIndividually(config));
    const [batchedResults, isolatedSettled] = await Promise.all([
      executeAgentBatch(batchedConfigs, context, provider, model),
      settleAgentJobsWithConcurrencyLimit(isolatedConfigs, AGENT_BATCH_FALLBACK_MAX_CONCURRENT, (config) =>
        executeAgent(config, context, provider, model),
      ),
    ]);
    const isolatedResults = isolatedSettled.map((entry, index) =>
      entry.status === "fulfilled"
        ? entry.value
        : makeError(
            isolatedConfigs[index]!,
            entry.reason instanceof Error ? entry.reason.message : "Agent execution failed",
            Date.now(),
          ),
    );
    return [...batchedResults, ...isolatedResults];
  }
  if (configs.length === 1) {
    logger.info(`[agent-batch] Only 1 agent (${configs[0]!.type}), running individually`);
    return [await executeAgent(configs[0]!, context, provider, model)];
  }

  logger.info(`[agent-batch] Batching ${configs.length} agents: [${configs.map((c) => c.type).join(", ")}]`);

  const startTime = Date.now();
  const perAgentTokens = configs.map((c) => normalizeAgentMaxTokens(c.settings.maxTokens));
  const temperature = Math.min(...configs.map((c) => normalizeAgentTemperature(c.settings.temperature)));
  const customParameters = agentCustomParameters(configs[0]!);
  const enableCaching = configs[0]!.enableCaching;
  const anthropicExtendedCacheTtl = configs[0]!.anthropicExtendedCacheTtl;
  const cachingAtDepth = configs[0]!.cachingAtDepth;
  const rawBatchMaxTokens = perAgentTokens.reduce((sum, tokens) => sum + tokens, 0);
  const modelMaxOutput = configs[0]!.maxOutputTokens;
  const batchMaxTokens = applyAgentMaxTokensCaps(provider, rawBatchMaxTokens, modelMaxOutput);

  try {
    // Build merged system prompt (includes lore + agent extras)
    const renderedTemplates = renderAgentTemplatesForOutput(configs, context, { escapeValues: true });
    const systemPrompt = buildBatchSystemPrompt(configs, context, renderedTemplates);
    // Batch uses the max contextSize among its members
    const batchContextSize = Math.max(...configs.map((c) => normalizeAgentContextSize(c.settings.contextSize)));
    const messages = buildAgentMessages(
      systemPrompt,
      context,
      "__batch__",
      batchContextSize,
      configs.map((config) => config.type),
      { outputFormatBlock: buildAgentOutputFormatBlock(configs, context, renderedTemplates) },
    );

    // Each agent reserves its own configured output budget. The context fitter
    // may still reduce this further if the prompt needs more room.
    const streamResponses = context.streaming !== false;
    const capDetails = [
      provider.maxTokensOverrideValue !== null ? `connection cap=${provider.maxTokensOverrideValue}` : null,
      modelMaxOutput ? `model cap=${modelMaxOutput}` : null,
    ].filter(Boolean);
    const capSuffix = capDetails.length ? `, ${capDetails.join(", ")}` : "";
    logger.info(
      "[agent-batch] maxTokens: %d (sum=%d from [%s]%s)",
      batchMaxTokens,
      rawBatchMaxTokens,
      perAgentTokens.join(", "),
      capSuffix,
    );

    logger.debug(`\n[agent-batch] ═══ BATCH PROMPT — [${configs.map((c) => c.type).join(", ")}] — ${model} ═══`);
    for (const msg of messages) {
      logger.debug(`[agent-batch] [${msg.role}] ${msg.content}`);
    }
    logger.debug(`[agent-batch] ═══ END BATCH PROMPT — temperature=${temperature} maxTokens=${batchMaxTokens} ═══\n`);
    emitAgentDebug(context, {
      stage: "request",
      agentId: "__batch__",
      agentType: "__batch__",
      agentName: `Agent Batch (${configs.length})`,
      phase: "batch",
      model,
      temperature,
      maxTokens: batchMaxTokens,
      messageCount: messages.length,
      messages: debugMessages(messages),
      batchedAgentTypes: configs.map((config) => config.type),
    });

    // Use streaming (onToken) to keep the connection alive — avoids proxy
    // timeouts (e.g. Cloudflare 524) on large batch responses.
    let responseText = "";
    const result = await provider.chatComplete(messages, {
      model,
      temperature,
      maxTokens: batchMaxTokens,
      enableCaching,
      anthropicExtendedCacheTtl,
      cachingAtDepth,
      customParameters,
      stream: streamResponses,
      onToken: streamResponses
        ? (chunk) => {
            responseText += chunk;
          }
        : undefined,
      signal: agentCallSignal(context.signal, configs.some((config) => config.type === "illustrator") ? "illustrator" : undefined),
    });

    // chatComplete also accumulates content, but streaming via onToken is
    // the primary path — use whichever is populated.
    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    const durationMs = Date.now() - startTime;
    const totalTokens = result.usage?.totalTokens ?? 0;

    logger.info(`[agent-batch] Got response (${responseText.length} chars, ${durationMs}ms, ${totalTokens} tokens)`);
    logger.debug(`[agent-batch] ${responseText}`);
    emitAgentDebug(context, {
      stage: "response",
      agentId: "__batch__",
      agentType: "__batch__",
      agentName: `Agent Batch (${configs.length})`,
      phase: "batch",
      model,
      temperature,
      maxTokens: batchMaxTokens,
      messageCount: messages.length,
      durationMs,
      finishReason: result.finishReason,
      ...debugUsage(result.usage),
      ...responseDebugFields(responseText),
      batchedAgentTypes: configs.map((config) => config.type),
    });

    // Parse the batched response into individual results
    const { parsed, failed } = parseBatchResponse(configs, responseText, durationMs, totalTokens);

    logger.info(
      "[agent-batch] Batch parse: %d parsed, %d failed %s",
      parsed.length,
      failed.length,
      failed.length > 0 ? `Failed: [${failed.map((f) => f.type).join(", ")}]` : "",
    );

    // Retry failed agents individually (batch fallback)
    if (failed.length > 0) {
      logger.info(`[agent-batch] Retrying ${failed.length} failed agents individually...`);
      if (failed.length > AGENT_BATCH_FALLBACK_MAX_CONCURRENT) {
        logger.warn(
          "[agent-batch] Limiting %d individual fallback retry request(s) to %d concurrent request(s)",
          failed.length,
          AGENT_BATCH_FALLBACK_MAX_CONCURRENT,
        );
      }
      const retrySettled = await settleAgentJobsWithConcurrencyLimit(
        failed,
        AGENT_BATCH_FALLBACK_MAX_CONCURRENT,
        (config) => executeAgent(config, context, provider, model),
      );
      const retries: AgentResult[] = [];
      for (let i = 0; i < retrySettled.length; i++) {
        const entry = retrySettled[i]!;
        if (entry.status === "fulfilled") {
          retries.push(entry.value);
        } else {
          // Individual retry also failed — produce error result
          logger.error(entry.reason, "[agent-batch] Individual retry FAILED for %s", failed[i]!.type);
          retries.push(
            makeError(failed[i]!, entry.reason instanceof Error ? entry.reason.message : "Retry failed", startTime),
          );
        }
      }
      return [...parsed, ...retries];
    }

    return parsed;
  } catch (err) {
    // On failure, return errors for all agents in the batch
    const errMsg = err instanceof Error ? err.message : "Batch execution failed";
    emitAgentDebug(context, {
      stage: "error",
      agentId: "__batch__",
      agentType: "__batch__",
      agentName: `Agent Batch (${configs.length})`,
      phase: "batch",
      model,
      temperature,
      maxTokens: batchMaxTokens,
      messageCount: 0,
      durationMs: Date.now() - startTime,
      error: errMsg,
      batchedAgentTypes: configs.map((config) => config.type),
    });
    logger.error(err, "[agent-batch] Batch call FAILED: %s", errMsg);
    return configs.map((c) => makeError(c, errMsg, startTime));
  }
}

/**
 * Build a combined system prompt for a batch of agents.
 * Structure: <role> + <lore> + <agents> + extras
 */
function buildBatchSystemPrompt(
  configs: AgentExecConfig[],
  context: AgentContext,
  renderedTemplates?: RenderedAgentTemplateMap,
): string {
  const parts: string[] = [];

  // ── Role ──
  parts.push(`<role>`);
  parts.push(
    `You are a collection of ${configs.length} specialized agents. Fulfill all tasks and return all requested outputs.`,
  );
  parts.push(
    `You MUST return one valid JSON object with one property per agent ID. Output ALL ${configs.length} agent properties.`,
  );
  parts.push(`</role>`);

  // ── Lore ──
  parts.push(``);
  parts.push(buildLoreBlock(context));

  // ── Agents ──
  parts.push(``);
  parts.push(`<agents>`);
  parts.push(`Fulfill each of the requested tasks here and return the outputs in the formats they're specified:`);
  for (const config of configs) {
    const template = getAgentOutputTemplate(config, context, renderedTemplates);
    parts.push(``);
    parts.push(`<agent_task id="${escapeXmlAttribute(config.type)}" name="${escapeXmlAttribute(config.name)}">`);
    parts.push(template);
    parts.push(`</agent_task>`);
  }
  parts.push(`</agents>`);

  // ── Agent-specific extras (sprites, backgrounds, etc.) ──
  const extras = buildAgentExtras(
    context,
    configs.map((c) => c.type),
  );
  if (extras) {
    parts.push(``);
    parts.push(extras);
  }

  return parts.join("\n");
}

/**
 * Parse a batched LLM response into individual AgentResults.
 * Prefers the raw JSON map requested by buildBatchSystemPrompt, with legacy
 * result-tag parsing kept only as a fallback for older/stale responses.
 */
function parseBatchResponse(
  configs: AgentExecConfig[],
  responseText: string,
  totalDurationMs: number,
  totalTokens: number = 0,
): { parsed: AgentResult[]; failed: AgentExecConfig[] } {
  const perAgentDuration = Math.round(totalDurationMs / configs.length);
  const perAgentTokens = Math.round(totalTokens / configs.length);
  const parsed: AgentResult[] = [];
  const failed: AgentExecConfig[] = [];
  const expectedAgentTypes = new Set(configs.map((config) => config.type));
  const jsonResults = extractBatchJsonResults(configs, responseText);
  const resultBlocks = extractResultBlocks(responseText);
  const explicitResults = new Map<string, string>();
  for (const block of resultBlocks) {
    if (!expectedAgentTypes.has(block.agent) || explicitResults.has(block.agent)) continue;
    explicitResults.set(block.agent, block.content.trim());
  }
  const residualText = removeSpans(
    responseText,
    resultBlocks.map((block) => [block.start, block.end] as const),
  );

  for (const config of configs) {
    const matchedOutput =
      jsonResults?.get(config.type) ??
      explicitResults.get(config.type) ??
      matchLegacyResultTag(config.type, residualText);

    if (matchedOutput !== null) {
      const parsedResult = parseAgentResponse(config, matchedOutput);
      const invalidJson = shouldFailInvalidJsonResult(config, parsedResult.data);
      if (invalidJson && shouldRetryInvalidJsonAgent(config)) {
        logger.warn(
          "[agent-batch] %s returned invalid JSON inside batch; retrying individually with strict JSON reminder",
          config.type,
        );
        failed.push(config);
        continue;
      }
      parsed.push({
        agentId: config.id,
        agentType: config.type,
        type: parsedResult.type,
        data: parsedResult.data,
        tokensUsed: perAgentTokens,
        durationMs: perAgentDuration,
        success: !invalidJson,
        error: invalidJson ? invalidJsonAgentError(parsedResult.type) : null,
      });
    } else {
      // Could not find this agent's output — mark for individual retry
      failed.push(config);
    }
  }

  return { parsed, failed };
}

function extractBatchJsonResults(configs: AgentExecConfig[], responseText: string): Map<string, string> | null {
  try {
    const parsed = JSON.parse(extractJson(responseText)) as unknown;
    const container = isRecord(parsed) && isRecord(parsed.results) ? parsed.results : parsed;
    if (!isRecord(container)) return null;

    const results = new Map<string, string>();
    for (const config of configs) {
      if (!Object.prototype.hasOwnProperty.call(container, config.type)) continue;
      const value = container[config.type];
      if (value === null || value === undefined) continue;
      results.set(config.type, typeof value === "string" ? value : JSON.stringify(value));
    }
    return results.size > 0 ? results : null;
  } catch {
    return null;
  }
}

type ExtractedResultBlock = {
  agent: string;
  content: string;
  start: number;
  end: number;
};

function extractResultBlocks(responseText: string): ExtractedResultBlock[] {
  const tokenRegex = /<result\b([^>]*)>|<\/result\s*>/gi;
  type Token = { index: number; length: number; isClose: boolean; attributes: string };
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(responseText))) {
    const isClose = match[0][1] === "/";
    tokens.push({
      index: match.index,
      length: match[0].length,
      isClose,
      attributes: isClose ? "" : (match[1] ?? ""),
    });
  }

  const blocks: ExtractedResultBlock[] = [];

  let i = 0;
  while (i < tokens.length) {
    const open = tokens[i]!;
    if (open.isClose) {
      i++;
      continue;
    }
    const agent = readResultAgentAttribute(open.attributes);
    if (!agent) {
      i++;
      continue;
    }

    const contentStart = open.index + open.length;
    let depth = 1;
    let selectedCloseIdx = -1;
    let j = i + 1;
    while (j < tokens.length) {
      const token = tokens[j]!;
      if (token.isClose) {
        depth--;
        if (depth <= 0) {
          selectedCloseIdx = j;
          break;
        }
      } else {
        depth++;
      }
      j++;
    }
    if (selectedCloseIdx === -1) {
      i++;
      continue;
    }

    const close = tokens[selectedCloseIdx]!;
    blocks.push({
      agent,
      content: responseText.slice(contentStart, close.index),
      start: open.index,
      end: close.index + close.length,
    });
    i = selectedCloseIdx + 1;
  }

  return blocks;
}

function readResultAgentAttribute(attributes: string): string | null {
  const match = attributes.match(/\bagent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw ? decodeXmlAttribute(raw).trim() : null;
}

function decodeXmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function removeSpans(value: string, spans: ReadonlyArray<readonly [number, number]>): string {
  if (spans.length === 0) return value;
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start > cursor) parts.push(value.slice(cursor, start));
    cursor = Math.max(cursor, end);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.join("");
}

function matchLegacyResultTag(agentType: string, residualText: string): string | null {
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(agentType)) return null;
  const escaped = escapeRegex(agentType);
  const match = residualText.match(new RegExp(`<result_${escaped}>([\\s\\S]*?)</result_${escaped}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Helpers ──

function makeError(config: AgentExecConfig, error: string, startTime: number): AgentResult {
  return {
    agentId: config.id,
    agentType: config.type,
    type: resolveAgentResultType(config),
    data: null,
    tokensUsed: 0,
    durationMs: Date.now() - startTime,
    success: false,
    error,
  };
}

function shouldFailInvalidJsonResult(config: Pick<AgentExecConfig, "type" | "settings">, data: unknown): boolean {
  return (
    (config.type !== "spotify" || musicDjUsesJsonOnlyProvider(config)) &&
    !!data &&
    typeof data === "object" &&
    (data as { parseError?: unknown }).parseError === true
  );
}

function invalidJsonAgentError(resultType: AgentResultType): string {
  return `Agent returned invalid JSON instead of the requested ${resultType} format. Check this agent's model/connection settings and try again.`;
}

function shouldRetryInvalidJsonAgent(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  return (config.type !== "spotify" || musicDjUsesJsonOnlyProvider(config)) && agentResponseIsJson(config);
}

function buildInvalidJsonRetryMessages(
  messages: ChatMessage[],
  resultType: AgentResultType,
  rawResponse: string,
): ChatMessage[] {
  const rawPreview = rawResponse.trim().slice(0, 4000);
  return [
    ...messages,
    ...(rawPreview ? [{ role: "assistant" as const, content: rawPreview }] : []),
    {
      role: "user",
      content: [
        `Your previous response was not valid JSON for the requested ${resultType} format.`,
        "Return ONLY one valid JSON object that matches the required output format.",
        "Do not include markdown fences, XML tags, commentary, explanations, or any text before or after the JSON.",
      ].join("\n"),
    },
  ];
}

function shouldRunAgentIndividually(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  // These agents either need compact prompts or carry large private extras that
  // must not be merged into unrelated batched agent requests.
  return (
    config.type === "illustrator" ||
    config.type === "lorebook-keeper" ||
    resolveAgentResultType(config) === "text_rewrite" ||
    musicDjUsesJsonOnlyProvider(config)
  );
}

function buildCustomAgentCapabilityBlock(config: AgentExecConfig, context: AgentContext): string {
  const capabilities = normalizeCustomAgentCapabilities(config.settings);
  const enabled = Object.entries(capabilities)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  if (enabled.length === 0) return "";

  const parts: string[] = ["<custom_agent_abilities>"];
  parts.push(`Enabled ability toggles: ${enabled.join(", ")}.`);
  parts.push(
    `Only use these abilities when your selected output format or available tools explicitly support the action.`,
  );

  if (capabilities.edit_messages) {
    parts.push(
      `Message editing is enabled. For Text Rewrite, replace only the assistant response provided in <assistant_response>.`,
    );
  }

  if (capabilities.edit_trackers) {
    parts.push(
      `Tracker editing is enabled. Return a tracker result type only when you intend to update the matching tracker state.`,
    );
  }

  if (capabilities.change_frontend_styling) {
    parts.push(
      `Frontend styling is enabled. Return CSS in the configured result format only for deliberate temporary visual effects.`,
    );
  }

  if (capabilities.edit_main_prompt) {
    parts.push(
      `Main prompt editing is enabled. Return prompt patch JSON instead of ordinary prose when you need to alter the outbound prompt.`,
    );
    const promptPreview =
      typeof context.memory._mainPromptPreview === "string" ? context.memory._mainPromptPreview : "";
    if (promptPreview.trim()) {
      parts.push(`<main_generation_prompt_preview>`);
      parts.push(escapeXml(promptPreview));
      parts.push(`</main_generation_prompt_preview>`);
    }
  }

  if (capabilities.access_vectors) {
    parts.push(
      `Vector and embedding access is enabled for this agent's configuration. Use available source material and tools rather than inventing vector search results.`,
    );
  }

  parts.push("</custom_agent_abilities>");
  return parts.join("\n");
}

function buildStandardAgentMessages(config: AgentExecConfig, template: string, context: AgentContext): ChatMessage[] {
  // Build the agent's system prompt with <role> + <lore> + <agents> + extras
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(`You are a specialized agent. Fulfill your task and return the requested output.`);
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(buildLoreBlock(context));
  systemParts.push(``);
  systemParts.push(`<agents>`);
  systemParts.push(`Fulfill the requested task here and return the output in the format specified:`);
  systemParts.push(template);
  systemParts.push(`</agents>`);
  const extras = buildAgentExtras(context, [config.type]);
  if (extras) {
    systemParts.push(``);
    systemParts.push(extras);
  }
  const customCapabilityBlock = buildCustomAgentCapabilityBlock(config, context);
  if (customCapabilityBlock) {
    systemParts.push(``);
    systemParts.push(customCapabilityBlock);
  }

  // Build multi-turn message array for this agent (sliced to its own contextSize)
  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize);
  const resultType = resolveAgentResultType(config);
  const renderedTemplates = new Map([[config.type, template]]);
  return buildAgentMessages(systemParts.join("\n"), context, config.type, agentContextSize, [config.type], {
    includeMessageIds: normalizeCustomAgentCapabilities(config.settings).edit_messages === true,
    preserveAssistantResponseMarkup: resultType === "text_rewrite",
    outputFormatBlock: buildAgentOutputFormatBlock([config], context, renderedTemplates),
  });
}

export function buildKnowledgeRetrievalAgentMessagesForTest(
  config: AgentExecConfig,
  template: string,
  context: AgentContext,
): ChatMessage[] {
  return buildKnowledgeRetrievalAgentMessages(config, template, context);
}

function buildKnowledgeRetrievalAgentMessages(
  config: AgentExecConfig,
  template: string,
  context: AgentContext,
): ChatMessage[] {
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(
    `You are a specialized knowledge retrieval agent. Extract relevant facts from source material; do not roleplay, continue the conversation, write dialogue, or answer as any character.`,
  );
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(`<agents>`);
  systemParts.push(template);
  systemParts.push(`</agents>`);
  const extras = buildAgentExtras(context, [config.type]);
  if (extras) {
    systemParts.push(``);
    systemParts.push(extras);
  }

  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize);
  const recent = context.recentMessages.slice(-agentContextSize).filter((message) => message.content.trim());
  const userParts: string[] = [];

  if (recent.length > 0) {
    userParts.push(`<conversation_messages>`);
    for (const message of recent) {
      const speaker = knowledgeRetrievalSpeakerLabel(message, context);
      userParts.push(`${speaker}: ${truncateAgentText(message.content, 2000)}`);
    }
    userParts.push(`</conversation_messages>`);
    userParts.push(``);
  }

  userParts.push(
    `Use the conversation messages only to identify which source-material facts are relevant. Return a concise factual summary from <source_material>. If no source material is relevant, output: "No relevant information found."`,
  );
  userParts.push(`Now return the requested format.`);
  userParts.push(``);
  userParts.push(buildAgentOutputFormatBlock([config], context, new Map([[config.type, template]])));

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

function knowledgeRetrievalSpeakerLabel(
  message: { role: string; characterId?: string },
  context: AgentContext,
): string {
  if (message.role === "user") return context.persona?.name?.trim() || "User";
  if (message.role === "assistant") {
    if (message.characterId) {
      const character = context.characters.find((entry) => entry.id === message.characterId);
      if (character?.name?.trim()) return character.name.trim();
    }
    return context.characters[0]?.name?.trim() || "Assistant";
  }
  return message.role || "Message";
}

function truncateAgentText(text: string, maxChars: number): string {
  const cleaned = stripHtmlTags(text);
  const chars = Array.from(cleaned);
  if (chars.length <= maxChars) return cleaned;

  const marker = "\n\n[Trimmed to keep this agent request compact]\n\n";
  const available = Math.max(0, maxChars - marker.length);
  const head = Math.floor(available * 0.4);
  const tail = available - head;
  return chars.slice(0, head).join("") + marker + chars.slice(-tail).join("");
}

function findLatestAssistantMessage(context: AgentContext): { index: number; content: string } | null {
  for (let index = context.recentMessages.length - 1; index >= 0; index--) {
    const message = context.recentMessages[index]!;
    if (message.role === "assistant" && message.content.trim()) {
      return { index, content: message.content };
    }
  }
  return null;
}

function findLatestUserMessage(
  context: AgentContext,
  beforeIndex = context.recentMessages.length,
): { index: number; content: string } | null {
  const startIndex = Math.min(context.recentMessages.length, beforeIndex) - 1;
  for (let index = startIndex; index >= 0; index--) {
    const message = context.recentMessages[index]!;
    if (message.role === "user" && message.content.trim()) {
      return { index, content: message.content };
    }
  }
  return null;
}

function normalizeCustomMusicFolder(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  const normalized = raw.replace(/^\/+/, "").replace(/\/+$/g, "");
  if (!normalized || normalized.includes("..")) return "music";
  return normalized.startsWith("music") ? normalized : `music/${normalized}`;
}

function formatLocalMusicTrackName(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function encodeLocalMusicPath(path: string): string {
  return Buffer.from(path, "utf8").toString("base64url");
}

function normalizeExternalMusicFolder(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return resolve(trimmed);
}

interface LocalMusicTrack {
  path: string;
  name: string;
  tags: string;
}

function collectExternalLocalMusicTracks(root: string, maxTracks = 120): LocalMusicTrack[] {
  const tracks: LocalMusicTrack[] = [];
  if (!existsSync(root)) return tracks;
  try {
    if (!statSync(root).isDirectory()) return tracks;
  } catch (error) {
    logger.debug(error, "[music-dj] Could not inspect custom music folder");
    return tracks;
  }

  const walk = (dir: string) => {
    if (tracks.length >= maxTracks) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.debug(error, "[music-dj] Could not read custom music folder");
      return;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (tracks.length >= maxTracks || entry.name.startsWith(".")) continue;
      const entryPath = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.isFile() || !LOCAL_MUSIC_AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const relativePath = relative(root, entryPath);
      tracks.push({
        path: `${LOCAL_MUSIC_PATH_PREFIX}${encodeLocalMusicPath(entryPath)}`,
        name: formatLocalMusicTrackName(basename(entry.name, extname(entry.name))),
        tags: relativePath.split(/[\\/]/).slice(0, -1).filter(Boolean).join(", "),
      });
    }
  };

  walk(root);
  return tracks;
}

function buildGameAssetsLocalMusicBlock(settings: Record<string, unknown>): string {
  const folder = normalizeCustomMusicFolder(settings.customMusicFolder ?? settings.localMusicFolder);
  const folderPrefix = folder === "music" ? "music/" : `${folder}/`;
  const tracks = (getAssetManifest().byCategory.music ?? [])
    .filter((entry) => entry.path === folder || entry.path.startsWith(folderPrefix))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 120);

  const parts = [`<available_local_music folder="${escapeXml(folder)}">`];
  if (tracks.length === 0) {
    parts.push(`No tracks found in this Game Assets folder. Return action "none".`);
  } else {
    for (const track of tracks) {
      const pathParts = track.path.split("/");
      const tags = pathParts.slice(1, -1).filter(Boolean).join(", ");
      const display = formatLocalMusicTrackName(track.name);
      parts.push(
        `- path="${escapeXml(track.path)}" name="${escapeXml(display)}"${tags ? ` tags="${escapeXml(tags)}"` : ""}`,
      );
    }
  }
  parts.push(`</available_local_music>`);
  return parts.join("\n");
}

function buildExternalLocalMusicBlock(settings: Record<string, unknown>): string {
  const folder = normalizeExternalMusicFolder(settings.customMusicExternalFolder ?? settings.localMusicExternalFolder);
  const parts = [`<available_local_music source="folder" folder="${escapeXml(folder ?? "")}">`];
  const tracks = folder ? collectExternalLocalMusicTracks(folder) : [];

  if (tracks.length === 0) {
    parts.push(`No tracks found in the selected custom music folder. Return action "none".`);
  } else {
    for (const track of tracks) {
      parts.push(
        `- path="${escapeXml(track.path)}" name="${escapeXml(track.name)}"${
          track.tags ? ` tags="${escapeXml(track.tags)}"` : ""
        }`,
      );
    }
  }
  parts.push(`</available_local_music>`);
  return parts.join("\n");
}

function buildAvailableLocalMusicBlock(settings: Record<string, unknown>): string {
  return getCustomMusicSource(settings) === "folder"
    ? buildExternalLocalMusicBlock(settings)
    : buildGameAssetsLocalMusicBlock(settings);
}

function buildSpotifyAgentMessages(config: AgentExecConfig, template: string, context: AgentContext): ChatMessage[] {
  const isGame = context.chatMode === "game";
  const turnLabel = isGame ? "game" : "roleplay";
  const musicProvider = getMusicProvider(config.settings);
  const systemParts: string[] = [];
  const providerLabel =
    musicProvider === "custom" ? "Custom local music" : musicProvider === "youtube" ? "YouTube" : "Spotify";
  systemParts.push(`<role>`);
  systemParts.push(`You are the Music DJ agent using ${providerLabel} for the current ${turnLabel} turn.`);
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(buildLoreBlock(context));
  systemParts.push(``);
  if (musicProvider === "custom") {
    systemParts.push(buildAvailableLocalMusicBlock(config.settings));
    systemParts.push(``);
  }
  systemParts.push(`<agents>`);
  systemParts.push(`Fulfill the requested task here and return the output in the format specified:`);
  systemParts.push(template);
  systemParts.push(`</agents>`);

  const extras = buildAgentExtras(context, [musicProvider === "custom" ? "custom-music" : musicProvider]);
  if (extras) {
    systemParts.push(``);
    systemParts.push(extras);
  }

  const latestUser = findLatestUserMessage(context);
  const latestGameTurn = context.mainResponse?.trim() || findLatestAssistantMessage(context)?.content || "";
  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize);
  const recentContext = context.recentMessages.slice(-agentContextSize).filter((message) => message.content.trim());
  const userParts: string[] = [];

  if (recentContext.length > 0) {
    userParts.push(`<recent_context>`);
    for (const message of recentContext) {
      const speaker = knowledgeRetrievalSpeakerLabel(message, context);
      userParts.push(`${speaker}: ${truncateAgentText(message.content, 1200)}`);
    }
    userParts.push(`</recent_context>`);
    userParts.push(``);
  }

  if (latestUser?.content) {
    userParts.push(`<last_user_input>`);
    userParts.push(truncateAgentText(latestUser.content, 2000));
    userParts.push(`</last_user_input>`);
    userParts.push(``);
  }

  if (latestGameTurn) {
    userParts.push(isGame ? `<last_game_turn>` : `<last_roleplay_turn>`);
    userParts.push(truncateAgentText(latestGameTurn, 5000));
    userParts.push(isGame ? `</last_game_turn>` : `</last_roleplay_turn>`);
    userParts.push(``);
  }

  if (musicProvider === "custom") {
    userParts.push(
      isGame
        ? `Pick one exact local track path for this game turn only, or return "none" if no listed track fits.`
        : `Pick one exact local track path for this roleplay turn, or return "none" if no listed track fits.`,
    );
  } else {
    userParts.push(
      isGame
        ? `Pick music intent for this game turn only. If Spotify tools are available, you may use them; otherwise return JSON with action, mood, and searchQuery so the server can fetch a real track and apply playback after this response.`
        : `Pick music intent for this roleplay turn. If Spotify tools are available, you may use them; otherwise return JSON with action, mood, and searchQuery so the server can fetch real tracks and apply playback after this response.`,
    );
  }
  userParts.push(`Now return the requested format.`);
  userParts.push(``);
  userParts.push(buildAgentOutputFormatBlock([config], context, new Map([[config.type, template]])));

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

function buildExpressionAgentMessages(config: AgentExecConfig, template: string, context: AgentContext): ChatMessage[] {
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(`You are a specialized expression-selection agent. Keep the request compact and return only JSON.`);
  systemParts.push(
    `Return exactly one expression for every owner in <available_sprites>. Use <latest_user_message> for the active user persona, and still include the persona when listed even if <assistant_response> does not describe their face. Use <assistant_response> for assistant or character expressions.`,
  );
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(`<agents>`);
  systemParts.push(`Fulfill the requested task here and return the output in the format specified:`);
  systemParts.push(template);
  systemParts.push(`</agents>`);

  const spritesBlock = buildAvailableSpritesBlock(context);
  if (spritesBlock) {
    systemParts.push(``);
    systemParts.push(spritesBlock);
  }

  const latestAssistant = findLatestAssistantMessage(context);
  const responseText = context.mainResponse?.trim() || latestAssistant?.content || "";
  const contextEndIndex = context.mainResponse?.trim() ? context.recentMessages.length : (latestAssistant?.index ?? 0);
  const latestUser = findLatestUserMessage(context, contextEndIndex);
  const recentContext = context.recentMessages
    .slice(0, contextEndIndex)
    .slice(-EXPRESSION_AGENT_RECENT_CONTEXT_MESSAGES)
    .filter((message) => message.content.trim());

  const userParts: string[] = [];
  if (recentContext.length > 0) {
    userParts.push(`<recent_context>`);
    for (const message of recentContext) {
      const role = message.role === "assistant" ? "assistant" : "user";
      userParts.push(`[${role}] ${truncateAgentText(message.content, EXPRESSION_AGENT_CONTEXT_CHAR_LIMIT)}`);
    }
    userParts.push(`</recent_context>`);
    userParts.push(``);
  }

  if (latestUser) {
    userParts.push(`<latest_user_message>`);
    userParts.push(truncateAgentText(latestUser.content, EXPRESSION_AGENT_CONTEXT_CHAR_LIMIT));
    userParts.push(`</latest_user_message>`);
    userParts.push(``);
  }

  userParts.push(`<assistant_response>`);
  userParts.push(truncateAgentText(responseText, EXPRESSION_AGENT_RESPONSE_CHAR_LIMIT));
  userParts.push(`</assistant_response>`);
  userParts.push(``);
  userParts.push(
    `Now return the requested format with exactly one expression entry for every owner listed in <available_sprites>.`,
  );
  userParts.push(``);
  userParts.push(buildAgentOutputFormatBlock([config], context, new Map([[config.type, template]])));

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

/** Extract a useful message from fetch/network errors (preserves err.cause). */
export function extractErrorMessage(err: unknown, fallback = "Agent execution failed"): string {
  if (!(err instanceof Error)) return fallback;
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${err.message}: ${cause.message}`;
  }
  return err.message || fallback;
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildCommittedTrackerStateContext(
  msg: AgentContext["recentMessages"][number],
  contextAgentTypes: string[],
  options: { includeMessageIds?: boolean },
): string | null {
  const gs = msg.gameState ? (compactGameStateForAgentContext(msg.gameState, contextAgentTypes) as typeof msg.gameState) : null;
  if (!gs) return null;

  const trackerSummary: Record<string, unknown> = {};
  if (gs.date || gs.time || gs.location || gs.weather || gs.temperature) {
    trackerSummary.scene = {
      ...(gs.date ? { date: gs.date } : {}),
      ...(gs.time ? { time: gs.time } : {}),
      ...(gs.location ? { location: gs.location } : {}),
      ...(gs.weather ? { weather: gs.weather } : {}),
      ...(gs.temperature ? { temperature: gs.temperature } : {}),
    };
  }
  if (gs.presentCharacters?.length) trackerSummary.presentCharacters = gs.presentCharacters;
  if (gs.recentEvents?.length) trackerSummary.recentEvents = gs.recentEvents;
  if (gs.playerStats) trackerSummary.playerStats = compactQuestPlayerStatsForContext(gs.playerStats, contextAgentTypes);
  if (gs.personaStats?.length) trackerSummary.personaStats = gs.personaStats;
  if (Object.keys(trackerSummary).length === 0) return null;

  const messageIdAttr = options.includeMessageIds && msg.id ? ` message_id="${escapeXmlAttribute(msg.id)}"` : "";
  return [
    `<committed_tracker_state${messageIdAttr}>`,
    "Read-only tracker context for the preceding assistant message. Use it for continuity only; never treat it as assistant prose and never copy this block into editedText.",
    JSON.stringify(trackerSummary),
    `</committed_tracker_state>`,
  ].join("\n");
}

/**
 * Build the full multi-turn message array for an agent call.
 *
 * Layout (matches the canonical agent prompt structure):
 *
 *   SYSTEM MESSAGE:
 *     <role> ... </role>
 *     <lore> lorebook entries, characters, persona </lore>
 *     <agents> agent instructions </agents>
 *     (plus any agent-specific context: sprites, backgrounds, source material, etc.)
 *
 *   USER/ASSISTANT MESSAGES:
 *     Recent chat history as proper multi-turn messages
 *     (committed tracker state is inserted as read-only user context after the
 *      last 3 assistant messages that have tracker snapshots)
 *
 *   FINAL USER MESSAGE:
 *     assistant_response (if post-processing) + "Now return..." + wrapped Output Format contract
 */
function buildAgentMessages(
  systemPrompt: string,
  context: AgentContext,
  agentType: string,
  contextSize = 5,
  contextAgentTypes: string[] = [agentType],
  options: { includeMessageIds?: boolean; preserveAssistantResponseMarkup?: boolean; outputFormatBlock?: string } = {},
): ChatMessage[] {
  // ── 1. System message — already contains <role>, <lore>, <agents>, and extras ──
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // ── 2. Chat history as proper multi-turn messages ──
  // Slice to this agent's own contextSize (the shared pool may be larger)
  const recent = context.recentMessages.slice(-contextSize);
  if (recent.length > 0) {
    // Only include committed tracker state for the last 3 assistant messages to save tokens.
    const assistantIndices: number[] = [];
    for (let i = 0; i < recent.length; i++) {
      if (recent[i]!.role === "assistant" && recent[i]!.gameState) {
        assistantIndices.push(i);
      }
    }
    const trackerEligible = new Set(assistantIndices.slice(-3));

    for (let msgIdx = 0; msgIdx < recent.length; msgIdx++) {
      const msg = recent[msgIdx]!;
      const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";
      let content = stripHtmlTags(msg.content).slice(0, 2000);
      if (options.includeMessageIds && msg.id) {
        content = `<message_id>${msg.id}</message_id>\n${content}`;
      }

      // Merge consecutive messages with the same role (API requirement)
      const last = messages[messages.length - 1]!;
      if (last.role === role) {
        messages[messages.length - 1] = { ...last, content: last.content + "\n\n" + content };
      } else {
        messages.push({ role, content });
      }

      // Tracker state is reference material, not assistant prose. Keep it in a
      // user-role context block so text rewrite agents can use it without
      // accidentally treating tracker JSON as response text to preserve or edit.
      if (msg.gameState && trackerEligible.has(msgIdx)) {
        const trackerContext = buildCommittedTrackerStateContext(msg, contextAgentTypes, options);
        if (trackerContext) {
          const lastAfterHistory = messages[messages.length - 1]!;
          if (lastAfterHistory.role === "user") {
            messages[messages.length - 1] = {
              ...lastAfterHistory,
              content: `${lastAfterHistory.content}\n\n${trackerContext}`,
            };
          } else {
            messages.push({ role: "user", content: trackerContext });
          }
        }
      }
    }
  }

  // ── 3. Final instruction (user message) ──
  const finalParts: string[] = [];

  if (context.mainResponse) {
    finalParts.push(`<assistant_response>`);
    finalParts.push(
      options.preserveAssistantResponseMarkup ? context.mainResponse : stripHtmlTags(context.mainResponse),
    );
    finalParts.push(`</assistant_response>`);
  }

  if (context.preGenInjections?.length) {
    finalParts.push(`\n<pre_generation_injections>`);
    finalParts.push(JSON.stringify(context.preGenInjections));
    finalParts.push(`</pre_generation_injections>`);
  }

  if (context.parallelResults?.length) {
    finalParts.push(`\n<parallel_agent_results>`);
    finalParts.push(JSON.stringify(context.parallelResults));
    finalParts.push(`</parallel_agent_results>`);
  }

  if (context.memory._agentResults) {
    finalParts.push(`\n<agent_results>`);
    finalParts.push(JSON.stringify(context.memory._agentResults));
    finalParts.push(`</agent_results>`);
  }

  // Echo Chamber prompts can be assembled from group-chat history that ends on
  // assistant. Anthropic treats a trailing assistant turn as prefill and rejects
  // some models, so add a terminal user instruction for that agent type too.
  const outputFormatBlock = options.outputFormatBlock?.trim() ?? "";
  const requiresTerminalUserInstruction =
    finalParts.length > 0 || contextAgentTypes.includes("echo-chamber") || !!outputFormatBlock;

  if (requiresTerminalUserInstruction) {
    const instruction = "Now return the requested format(s).";
    finalParts.push(finalParts.length > 0 ? `\n${instruction}` : instruction);
    if (outputFormatBlock) {
      finalParts.push(`\n${outputFormatBlock}`);
    }
    const finalContent = finalParts.join("\n");
    const last = messages[messages.length - 1]!;
    if (last.role === "user") {
      messages[messages.length - 1] = { ...last, content: last.content + "\n\n" + finalContent };
    } else {
      messages.push({ role: "user", content: finalContent });
    }
  }

  return messages;
}

/**
 * Build the lore block for the system message from the agent context.
 * Contains character and persona context. Runtime lorebook entries are
 * intentionally excluded to keep non-lorebook agent prompts compact.
 */
function buildLoreBlock(context: AgentContext): string {
  const parts: string[] = [];
  parts.push(`<lore>`);

  if (context.characters.length > 0) {
    parts.push(`<characters>`);
    for (const char of context.characters) {
      parts.push(`<character id="${char.id}" name="${char.name}">`);
      pushLoreField(parts, "Description", char.description, CHARACTER_LORE_DESCRIPTION_LIMIT);
      pushLoreField(parts, "Personality", char.personality, CHARACTER_LORE_FIELD_LIMIT);
      pushLoreField(parts, "Backstory", char.backstory, CHARACTER_LORE_FIELD_LIMIT);
      pushLoreField(parts, "Appearance", char.appearance, CHARACTER_LORE_FIELD_LIMIT);
      pushLoreField(parts, "Scenario", char.scenario, CHARACTER_LORE_FIELD_LIMIT);
      if (char.rpgStats?.enabled) {
        const pools = normalizeRpgStatPools(char.rpgStats);
        if (pools.length > 0) {
          parts.push(`Configured RPG pools: ${pools.map((pool) => `${pool.name}: ${pool.value}/${pool.max}`).join(", ")}`);
        }
        if (Array.isArray(char.rpgStats.attributes) && char.rpgStats.attributes.length > 0) {
          parts.push(
            `Configured RPG attributes: ${char.rpgStats.attributes
              .map((attribute) => `${attribute.name}: ${attribute.value}`)
              .join(", ")}`,
          );
        }
      }
      parts.push(`</character>`);
    }
    parts.push(`</characters>`);
  }

  if (context.persona) {
    parts.push(`<user_persona>`);
    parts.push(`Name: ${context.persona.name}`);
    if (context.persona.description) parts.push(`Description: ${context.persona.description.slice(0, 2000)}`);
    if (context.persona.personality) parts.push(`Personality: ${context.persona.personality}`);
    if (context.persona.backstory) parts.push(`Backstory: ${context.persona.backstory}`);
    if (context.persona.appearance) parts.push(`Appearance: ${context.persona.appearance}`);
    if (context.persona.scenario) parts.push(`Scenario: ${context.persona.scenario}`);
    if (context.persona.personaStats?.enabled && context.persona.personaStats.bars.length > 0) {
      parts.push(`Configured persona stat bars:`);
      for (const bar of context.persona.personaStats.bars) {
        parts.push(`- ${bar.name}: ${bar.value}/${bar.max}`);
      }
    }
    if (context.persona.rpgStats?.enabled) {
      const rpg = context.persona.rpgStats;
      parts.push(`RPG Stats:`);
      const pools = normalizeRpgStatPools(rpg);
      if (pools.length > 0) {
        parts.push(`Pools:`);
        for (const pool of pools) {
          parts.push(`- ${pool.name}: ${pool.value}/${pool.max}`);
        }
      } else {
        parts.push(`- Max HP: ${rpg.hp.max}`);
      }
      if (rpg.attributes.length > 0) {
        parts.push(`Attributes:`);
        for (const attr of rpg.attributes) {
          parts.push(`- ${attr.name}: ${attr.value}`);
        }
      }
    }
    parts.push(`</user_persona>`);
  }

  parts.push(`</lore>`);
  return parts.join("\n");
}

function pushLoreField(parts: string[], label: string, value: string | undefined, limit: number): void {
  const text = value?.trim();
  if (!text) return;
  parts.push(`${label}: ${text.slice(0, limit)}`);
}

function buildAvailableSpritesBlock(context: AgentContext): string {
  if (!context.memory._availableSprites) return "";

  const sprites = context.memory._availableSprites as Array<{
    characterId: string;
    characterName: string;
    expressions: string[];
    expressionChoices?: string[];
  }>;
  const personaId = typeof context.memory._personaId === "string" ? context.memory._personaId : "";
  const parts: string[] = [`<available_sprites>`];
  for (const char of sprites) {
    const choices = char.expressionChoices?.length ? char.expressionChoices : char.expressions;
    const label = char.characterId === personaId ? " [active user persona]" : "";
    parts.push(`${char.characterName} (${char.characterId})${label}: ${choices.join(", ")}`);
  }
  parts.push(`</available_sprites>`);
  return parts.join("\n");
}

/**
 * Build agent-specific context blocks (sprites, backgrounds, source material, etc.)
 * that go into the system message after lore.
 */
function buildAgentExtras(context: AgentContext, agentTypes: string[] = []): string {
  const parts: string[] = [];

  // Card Evolution Auditor needs the FULL character card (not just description)
  // so it can emit exact-match oldText edits. Gated on agent type because
  // forwarding every field would bloat context for agents that don't need it.
  if (agentTypes.includes("card-evolution-auditor") && context.characters.length > 0) {
    parts.push(`<character_cards>`);
    for (const char of context.characters) {
      parts.push(`<character id="${escapeXml(char.id)}" name="${escapeXml(char.name)}">`);
      if (char.description) parts.push(`<description>${escapeXml(char.description)}</description>`);
      if (char.personality) parts.push(`<personality>${escapeXml(char.personality)}</personality>`);
      if (char.scenario) parts.push(`<scenario>${escapeXml(char.scenario)}</scenario>`);
      if (char.backstory) parts.push(`<backstory>${escapeXml(char.backstory)}</backstory>`);
      if (char.appearance) parts.push(`<appearance>${escapeXml(char.appearance)}</appearance>`);
      if (char.firstMes) parts.push(`<first_mes>${escapeXml(char.firstMes)}</first_mes>`);
      if (char.mesExample) parts.push(`<mes_example>${escapeXml(char.mesExample)}</mes_example>`);
      if (char.creatorNotes) parts.push(`<creator_notes>${escapeXml(char.creatorNotes)}</creator_notes>`);
      if (char.systemPrompt) parts.push(`<system_prompt>${escapeXml(char.systemPrompt)}</system_prompt>`);
      if (char.postHistoryInstructions)
        parts.push(`<post_history_instructions>${escapeXml(char.postHistoryInstructions)}</post_history_instructions>`);
      parts.push(`</character>`);
    }
    parts.push(`</character_cards>`);
  }

  // About Me Keeper needs each participant's current public + chat-specific
  // about-me so it can decide whether/what to update. Populated in the
  // conversation branch as memory._aboutMeState (Convo mode only).
  if (agentTypes.includes("about-me-keeper")) {
    const state = context.memory?._aboutMeState;
    if (Array.isArray(state) && state.length > 0) {
      parts.push(`<about_me_state>`);
      for (const raw of state as Array<Record<string, unknown>>) {
        const id = typeof raw.characterId === "string" ? raw.characterId : "";
        const name = typeof raw.name === "string" ? raw.name : "";
        const publicAbout = typeof raw.publicAboutMe === "string" ? raw.publicAboutMe : "";
        const chatAbout = typeof raw.chatAboutMe === "string" ? raw.chatAboutMe : "";
        parts.push(`<character id="${escapeXml(id)}" name="${escapeXml(name)}">`);
        parts.push(`<public_about_me>${escapeXml(publicAbout)}</public_about_me>`);
        if (chatAbout) parts.push(`<chat_about_me>${escapeXml(chatAbout)}</chat_about_me>`);
        parts.push(`</character>`);
      }
      parts.push(`</about_me_state>`);
    }
  }

  if (context.gameState) {
    parts.push(`<current_game_state>`);
    parts.push(JSON.stringify(compactGameStateForAgentContext(context.gameState, agentTypes)));
    parts.push(`</current_game_state>`);
  }

  if (agentTypes.includes("character-tracker") && context.characterTrackerHistory?.length) {
    parts.push(`<character_tracker_history>`);
    parts.push(
      "Latest known state for recurring characters, including characters currently absent. Use it for continuity when someone returns; this list does not mean everyone is present now.",
    );
    parts.push(JSON.stringify(context.characterTrackerHistory));
    parts.push(`</character_tracker_history>`);
  }

  const gameImageStylePrompt =
    context.chatMode === "game" && typeof context.memory._gameImageStylePrompt === "string"
      ? context.memory._gameImageStylePrompt.trim()
      : "";
  if (agentTypes.includes("illustrator") && gameImageStylePrompt) {
    parts.push(`<game_image_instructions>`);
    parts.push(
      `This chat is in Game Mode. Follow the selected Illustrator prompt mode exactly: Background stays an environment-only plate, Illustration produces a scene CG, and Selfie, Comic Page, or manga modes keep their requested framing and text behavior.`,
    );
    parts.push(`Required visual style prompt: ${escapeXml(gameImageStylePrompt)}`);
    parts.push(
      `Carry this visual style into both the JSON "style" field and the generated "prompt". Do not replace it with a generic art style.`,
    );
    parts.push(
      `When the selected prompt mode does not specify another aspect ratio, prefer a landscape/16:9 full-frame scene composition.`,
    );
    parts.push(
      `Avoid UI, subtitles, captions, speech bubbles, dialogue lettering, manga SFX, watermarks, logos, and split panels unless the selected prompt mode or the user's game image instructions explicitly request them.`,
    );
    parts.push(`</game_image_instructions>`);
  }

  if (agentTypes.includes("illustrator") && context.memory._illustratorBackgroundGenerationEnabled === true) {
    parts.push(`<illustrator_background_generation enabled="true">`);
    parts.push(
      `Independently set the Illustrator JSON field "generateBackground" to true only when the latest assistant scene enters a meaningfully different reusable location or setting. This decision is separate from "shouldGenerate"; both may be true on the same turn.`,
    );
    parts.push(
      `Prefer a changed location in current or committed tracker state. When tracker location is unavailable, infer conservatively from recent scene context. Keep generateBackground false for movement within the same place, camera changes, mood, weather, lighting, or time-of-day changes alone.`,
    );
    if (typeof context.memory._currentBackground === "string" && context.memory._currentBackground.trim()) {
      parts.push(`Currently active background: ${escapeXml(context.memory._currentBackground.trim())}`);
    } else {
      parts.push(`Currently active background: none`);
    }
    parts.push(`The host writes a separate background-only prompt after this decision; do not replace the normal illustration prompt.`);
    parts.push(`</illustrator_background_generation>`);
  }

  if (agentTypes.includes("expression")) {
    const availableSpritesBlock = buildAvailableSpritesBlock(context);
    if (availableSpritesBlock) parts.push(availableSpritesBlock);
  }

  if (context.memory._availableBackgrounds) {
    const bgs = context.memory._availableBackgrounds as Array<{
      filename: string;
      originalName?: string | null;
      tags: string[];
      source?: "user" | "game_asset";
    }>;
    parts.push(`<available_backgrounds>`);
    for (const bg of bgs) {
      const label = bg.originalName ? `${bg.filename} (${bg.originalName})` : bg.filename;
      const source = bg.source === "game_asset" ? " [source: game asset]" : "";
      const tagStr = bg.tags.length > 0 ? ` [tags: ${bg.tags.join(", ")}]` : "";
      parts.push(`- ${label}${source}${tagStr}`);
    }
    parts.push(`</available_backgrounds>`);
    if (context.memory._currentBackground) {
      parts.push(`<current_background>${context.memory._currentBackground}</current_background>`);
    }
  }

  if (agentTypes.includes("background") && context.memory._backgroundGenerationEnabled === true) {
    parts.push(`<background_generation enabled="true">`);
    parts.push(
      `If no listed background fits a changed or new location, request a generated reusable location background instead of forcing a weak match.`,
    );
    const worldContext =
      context.memory._backgroundWorldContext &&
      typeof context.memory._backgroundWorldContext === "object" &&
      !Array.isArray(context.memory._backgroundWorldContext)
        ? (context.memory._backgroundWorldContext as Record<string, unknown>)
        : null;
    if (worldContext) {
      const fields = [
        ["genre", worldContext.genre],
        ["setting", worldContext.setting],
        ["location", worldContext.location],
        ["weather", worldContext.weather],
        ["timeOfDay", worldContext.timeOfDay],
        ["world", worldContext.worldOverview],
      ]
        .map(([label, value]) => {
          const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 180) : "";
          return text ? `${label}: ${escapeXml(text)}` : "";
        })
        .filter(Boolean);
      if (fields.length > 0) {
        parts.push(`World context for generated backgrounds: ${fields.join("; ")}.`);
        parts.push(
          `Generated background prompts must include the setting era/genre and concrete location details. Do not request modern scenery, technology, signage, UI, or objects unless this world context supports them.`,
        );
      }
    }
    parts.push(`</background_generation>`);
  }

  if (agentTypes.includes("spotify") && context.memory._spotifyDjConstraints) {
    parts.push(`<spotify_dj_constraints>`);
    parts.push(JSON.stringify(context.memory._spotifyDjConstraints));
    parts.push(`</spotify_dj_constraints>`);
  }

  if (agentTypes.includes("spotify") && context.memory._spotifyDjCurrentPlayback) {
    parts.push(`<spotify_current_playback>`);
    parts.push(JSON.stringify(context.memory._spotifyDjCurrentPlayback));
    parts.push(`</spotify_current_playback>`);
  }

  if (agentTypes.includes("youtube") && context.memory._youtubeDjConstraints) {
    parts.push(`<youtube_dj_constraints>`);
    parts.push(JSON.stringify(context.memory._youtubeDjConstraints));
    parts.push(`</youtube_dj_constraints>`);
  }

  if (agentTypes.includes("custom-music") && context.memory._customMusicDjConstraints) {
    parts.push(`<custom_music_dj_constraints>`);
    parts.push(JSON.stringify(context.memory._customMusicDjConstraints));
    parts.push(`</custom_music_dj_constraints>`);
  }

  if (agentTypes.includes("lorebook-keeper") && context.memory._existingLorebookEntries) {
    const rawEntries = context.memory._existingLorebookEntries as Array<
      string | { id?: string; name?: string; content?: string; keys?: string[]; locked?: boolean }
    >;
    const entries = rawEntries
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (!entry || typeof entry !== "object") return null;

        const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Unnamed";
        const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : "";
        const content = typeof entry.content === "string" ? entry.content.trim() : "";
        const keys = Array.isArray(entry.keys) ? entry.keys.filter((key) => typeof key === "string") : [];
        const attrs = [
          id ? `id="${escapeXml(id)}"` : "",
          `name="${escapeXml(name)}"`,
          keys.length > 0 ? `keys="${escapeXml(keys.join(", "))}"` : "",
          entry.locked === true ? `locked="true"` : "",
        ].filter(Boolean);
        return [`<entry ${attrs.join(" ")}>`, `<content>${escapeXml(content)}</content>`, `</entry>`].join("\n");
      })
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

    if (entries.length > 0) {
      parts.push(`<existing_entries>`);
      parts.push(entries.join("\n"));
      parts.push(`</existing_entries>`);
    }
  }

  if (context.chatSummary) {
    parts.push(`<chat_summary>`);
    parts.push(context.chatSummary);
    parts.push(`</chat_summary>`);
  }

  if (context.memory._sourceMaterial) {
    parts.push(`<source_material>`);
    parts.push(context.memory._sourceMaterial as string);
    parts.push(`</source_material>`);
  }

  if (context.memory._routerCatalog) {
    parts.push(`<entry_catalog>`);
    parts.push(context.memory._routerCatalog as string);
    parts.push(`</entry_catalog>`);
  }

  if (context.memory._chunkInfo) {
    const info = context.memory._chunkInfo as { current: number; total: number };
    parts.push(
      `<chunk_info>Chunk ${info.current} of ${info.total} — extract relevant information from this chunk.</chunk_info>`,
    );
  }

  if (context.memory._previousExtractions) {
    const extractions = context.memory._previousExtractions as string[];
    parts.push(`<previous_extractions>`);
    parts.push(
      `The following relevant excerpts were extracted from prior chunks of the same source material. Consolidate them into a single, coherent summary along with any new relevant information from the current chunk.`,
    );
    for (let i = 0; i < extractions.length; i++) {
      parts.push(`\n--- Chunk ${i + 1} ---`);
      parts.push(extractions[i]!);
    }
    parts.push(`</previous_extractions>`);
  }

  if (context.memory._connectedDevices) {
    const devices = context.memory._connectedDevices as Array<{ name: string; index: number; capabilities: string[] }>;
    parts.push(`<connected_devices>`);
    for (const d of devices) {
      parts.push(`- ${d.name} (index ${d.index}): ${d.capabilities.join(", ")}`);
    }
    parts.push(`</connected_devices>`);
  }

  if (typeof context.memory._hapticSettings === "string") {
    parts.push(`<haptic_settings>`);
    parts.push(context.memory._hapticSettings);
    parts.push(`</haptic_settings>`);
  }

  if (context.memory._lastCyoaChoices) {
    const lastChoices = context.memory._lastCyoaChoices as Array<{ label: string; text: string }>;
    parts.push(`<previous_cyoa_choices>`);
    parts.push(
      `These are the choices you generated last time. Do NOT repeat them — provide fresh, meaningfully different options.`,
    );
    for (const c of lastChoices) {
      parts.push(`- ${c.label}: ${c.text}`);
    }
    parts.push(`</previous_cyoa_choices>`);
  }

  if (context.memory._secretPlotState) {
    const secretPlotState = JSON.stringify(context.memory._secretPlotState);
    const wrapped = formatAgentContextBlock(
      secretPlotState,
      "Secret Plot State",
      normalizeAgentContextWrapFormat(context.wrapFormat),
    );
    if (wrapped) parts.push(wrapped);
  }

  return parts.join("\n");
}

/** Map agent type → its primary result type. */
const AGENT_RESULT_TYPE_MAP: Record<string, AgentResultType> = {
  "world-state": "game_state_update",
  "prose-guardian": "text_rewrite",
  continuity: "text_rewrite",
  expression: "sprite_change",
  "echo-chamber": "echo_message",
  director: "director_event",
  quest: "quest_update",
  illustrator: "image_prompt",
  "lorebook-keeper": "lorebook_update",
  "card-evolution-auditor": "character_card_update",
  combat: "game_state_update",
  background: "background_change",
  "character-tracker": "character_tracker_update",
  "persona-stats": "persona_stats_update",
  "custom-tracker": "custom_tracker_update",
  html: "text_rewrite",
  spotify: "spotify_control",
  "knowledge-retrieval": "context_injection",
  haptic: "haptic_command",
  cyoa: "cyoa_choices",
  "about-me-keeper": "about_me_update",
};

const AGENT_RESULT_TYPES = new Set<AgentResultType>([
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
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
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
  "frontend_theme_update",
  "about_me_update",
]);

const TEXT_RESULT_TYPES = new Set<AgentResultType>(["context_injection", "director_event"]);

export function resolveAgentResultType(config: Pick<AgentExecConfig, "type" | "settings">): AgentResultType {
  if (musicDjUsesYoutube(config)) return "youtube_control";
  if (musicDjUsesCustom(config)) return "local_music_control";
  if (config.type === "html") return "text_rewrite";
  const configured = config.settings?.resultType;
  if (typeof configured === "string" && AGENT_RESULT_TYPES.has(configured as AgentResultType)) {
    return configured as AgentResultType;
  }
  return AGENT_RESULT_TYPE_MAP[config.type] ?? "context_injection";
}

function agentResponseIsJson(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  if (config.type === "html") return true;
  const resultType = resolveAgentResultType(config);
  return JSON_AGENTS.has(config.type) || !TEXT_RESULT_TYPES.has(resultType);
}

/** Agents that return structured JSON. */
const JSON_AGENTS = new Set([
  "world-state",
  "prose-guardian",
  "continuity",
  "director",
  "expression",
  "echo-chamber",
  "quest",
  "illustrator",
  "lorebook-keeper",
  "card-evolution-auditor",
  "combat",
  "background",
  "character-tracker",
  "persona-stats",
  "custom-tracker",
  "about-me-keeper",
  "html",
  "spotify",
  "haptic",
  "cyoa",
]);

/**
 * Strip leaked synthetic tags from a text-injection agent's response.
 *
 * Background: when a text-injection agent is shown read-only tracker context,
 * smaller models may still echo tracker JSON before/around their intended
 * directive. Strip that leaked content before it can be injected into the
 * main prompt.
 */
function sanitizeTextAgentResponse(agentType: string, text: string): string {
  const cleaned = text
    .replace(/<committed_tracker_state\b[^>]*>[\s\S]*?<\/committed_tracker_state\s*>/gi, "")
    .replace(/<assistant_response\b[^>]*>[\s\S]*?<\/assistant_response\s*>/gi, "")
    .trim();

  return cleaned;
}

/**
 * Parse the raw LLM response into a typed result.
 */
function parseAgentResponse(
  config: Pick<AgentExecConfig, "type" | "settings">,
  responseText: string,
): {
  type: AgentResultType;
  data: unknown;
} {
  const resultType = resolveAgentResultType(config);

  if (agentResponseIsJson(config)) {
    try {
      const jsonStr = extractJson(responseText);
      const data = JSON.parse(jsonStr);
      return { type: resultType, data };
    } catch {
      return { type: resultType, data: { raw: responseText, parseError: true } };
    }
  }

  // Text-based context-injection agents. Sanitize before injection so
  // leaked tracker/roleplay content can't reach the main prompt.
  return { type: resultType, data: { text: sanitizeTextAgentResponse(config.type, responseText) } };
}

/** Extract JSON from a response that may contain markdown fences. */
function extractJson(text: string): string {
  // Try markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1]!.trim();
  else {
    // Try to find a bare JSON object or array
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) text = jsonMatch[1]!;
  }

  // Repair common LLM JSON issues
  text = repairJson(text);
  return text;
}

/** Fix common LLM JSON mistakes: trailing commas, comments, ellipsis placeholders. */
function repairJson(str: string): string {
  try {
    JSON.parse(str);
    return str;
  } catch {
    return stripTrailingCommas(stripJsonRepairTokens(str));
  }
}

function stripTrailingCommas(str: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < str.length; index++) {
    const char = str[index] ?? "";
    if (inString) {
      repaired += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      repaired += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < str.length && /\s/.test(str[lookahead] ?? "")) lookahead++;
      const nextSignificant = str[lookahead];
      if (nextSignificant === "}" || nextSignificant === "]") continue;
    }

    repaired += char;
  }
  return repaired;
}

function stripJsonRepairTokens(str: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index] ?? "";
    const next = str[index + 1];
    const nextTwo = str.slice(index, index + 3);

    if (inString) {
      repaired += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      repaired += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index + 1 < str.length && str[index + 1] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index + 1 < str.length && !(str[index] === "*" && str[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }

    if (nextTwo === "...") {
      index += 2;
      continue;
    }

    repaired += char;
  }

  return repaired;
}
