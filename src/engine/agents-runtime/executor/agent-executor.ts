// ──────────────────────────────────────────────
// Agent Executor — Single & Batched LLM execution
// ──────────────────────────────────────────────
import type {
  BaseLLMProvider,
  ChatCompleteOptions,
  ChatMessage,
  LLMToolCall,
  LLMToolDefinition,
} from "../../generation-core/llm/base-provider.js";
import type { AgentResult, AgentContext, AgentResultType } from "../../contracts/types/agent";
import { getDefaultAgentPrompt } from "../../contracts/constants/agent-prompts";
import {
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_MAX_TOKENS,
  MAX_AGENT_MAX_TOKENS,
  MIN_AGENT_MAX_TOKENS,
} from "../../contracts/types/agent";
import { createAgentRuntimeDebug, type AgentRuntimeDebugEntry } from "../debug.js";
import { stripAvatarPathsReplacer } from "../strip-avatar-paths";
import { worldStatePatchFromAgentData } from "../../generation/world-state-agent-result";

const MAX_AGENT_CONTEXT_MESSAGES = 200;
const EXPRESSION_AGENT_RECENT_CONTEXT_MESSAGES = 2;
const EXPRESSION_AGENT_CONTEXT_CHAR_LIMIT = 1200;
const EXPRESSION_AGENT_RESPONSE_CHAR_LIMIT = 6000;
const ECHO_AGENT_RECENT_CONTEXT_MESSAGES = 6;
const ECHO_AGENT_CONTEXT_CHAR_LIMIT = 1200;
const ECHO_AGENT_RESPONSE_CHAR_LIMIT = 6000;
const ILLUSTRATOR_AGENT_TYPE = "illustrator";

async function yieldToHost(): Promise<void> {
  await new Promise<void>((resolve) => {
    const host = globalThis as {
      requestAnimationFrame?: (callback: () => void) => unknown;
      setTimeout?: (callback: () => void, delay?: number) => unknown;
    };
    if (typeof host.requestAnimationFrame === "function") {
      host.requestAnimationFrame(() => resolve());
      return;
    }
    if (typeof host.setTimeout === "function") {
      host.setTimeout(() => resolve(), 0);
      return;
    }
    resolve();
  });
}

/** Strip HTML/XML-style tags (e.g. <div style="..."> <br> <speaker>) from text to save tokens. */
function stripHtmlTags(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
}

/** Optional tool context for agents that need function calling. */
export interface AgentToolContext {
  tools: LLMToolDefinition[];
  executeToolCall: (call: LLMToolCall) => Promise<string>;
}

function normalizeAgentContextSize(value: unknown, fallback = DEFAULT_AGENT_CONTEXT_SIZE): number {
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

function formatToolPayloadForLog(payload: string, maxLength = 400): string {
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
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.min(MAX_AGENT_MAX_TOKENS, Math.trunc(value)));
}

function applyProviderMaxTokensOverride(provider: BaseLLMProvider, maxTokens: number): number {
  return provider.maxTokensOverrideValue !== null ? Math.min(maxTokens, provider.maxTokensOverrideValue) : maxTokens;
}

function agentTemperature(config: Pick<AgentExecConfig, "settings">): number | undefined {
  const value = config.settings.temperature;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function batchAgentTemperature(configs: Array<Pick<AgentExecConfig, "settings">>): number | undefined {
  const temperatures = configs.map(agentTemperature).filter((value): value is number => typeof value === "number");
  return temperatures.length > 0 ? Math.min(...temperatures) : undefined;
}

function buildChatCompleteOptions(options: ChatCompleteOptions): ChatCompleteOptions {
  const { model, temperature, maxTokens, stream, onToken, signal, ...extra } = options;
  const normalized: ChatCompleteOptions = { model, ...extra };
  if (typeof temperature === "number") normalized.temperature = temperature;
  if (typeof maxTokens === "number") normalized.maxTokens = maxTokens;
  if (typeof stream === "boolean") normalized.stream = stream;
  if (onToken) normalized.onToken = onToken;
  if (signal) normalized.signal = signal;
  return normalized;
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
  const logger = createAgentRuntimeDebug(context);
  const emit = (entry: AgentRuntimeDebugEntry) => logger.emit(entry);

  try {
    const template = config.promptTemplate || getDefaultAgentPrompt(config.type);
    if (!template) {
      return makeError(config, "No prompt template configured", startTime);
    }

    const messages =
      config.type === "expression"
        ? buildExpressionAgentMessages(template, context)
        : config.type === "echo-chamber"
          ? buildEchoChamberAgentMessages(config, template, context)
          : config.type === "knowledge-retrieval"
            ? buildKnowledgeRetrievalAgentMessages(config, template, context)
            : config.type === "spotify"
              ? buildSpotifyAgentMessages(config, template, context)
              : buildStandardAgentMessages(config, template, context);

    const temperature = agentTemperature(config);
    const maxTokens = applyProviderMaxTokensOverride(provider, normalizeAgentMaxTokens(config.settings.maxTokens));
    const streamResponses = context.streaming !== false;

    // If tools are available, use the tool call loop
    if (toolContext && toolContext.tools.length > 0) {
      return executeAgentWithTools(
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
        context.signal,
      );
    }

    // Call LLM (streaming to avoid proxy timeouts, no tools)
    logger.info(`[agent] ${config.type} (${config.name}) — ${model}`);
    emit({
      level: "info",
      phase: config.phase,
      message: "agent-start",
      args: [config.type, config.name, model],
    });
    for (const msg of messages) {
      logger.debug(`[agent] [${msg.role}] ${msg.content}`);
      emit({ level: "debug", phase: config.phase, message: "prompt-message", args: [msg.role, msg.content] });
    }
    logger.debug(`[agent] ═══ END PROMPT — temperature=${temperature ?? "connection"} maxTokens=${maxTokens} ═══\n`);
    emit({ level: "debug", phase: config.phase, message: "prompt-end", args: [temperature, maxTokens] });

    let responseText = "";
    const result = await provider.chatComplete(
      messages,
      buildChatCompleteOptions({
        model,
        temperature,
        maxTokens,
        stream: streamResponses,
        onToken: streamResponses
          ? (chunk) => {
              responseText += chunk;
            }
          : undefined,
        signal: context.signal,
      }),
    );

    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    const durationMs = Date.now() - startTime;
    if (!responseText) {
      return makeError(config, `${config.name} returned an empty response.`, startTime);
    }

    logger.info(`[agent] ${config.type} done (${responseText.length} chars, ${durationMs}ms)`);
    logger.debug(`[agent] ${config.type} raw response: ${responseText.slice(0, 500)}`);
    emit({
      level: "info",
      phase: config.phase,
      message: "agent-complete",
      args: [config.type, responseText.length, durationMs],
    });
    emit({
      level: "debug",
      phase: config.phase,
      message: "raw-response",
      args: [config.type, responseText.slice(0, 500)],
    });

    // Parse the result based on agent type
    const parsed = parseAgentResponse(config, responseText);
    if (parsed.error) {
      return makeError(config, formatAgentParseError(config, parsed.error), startTime);
    }

    const fallback = await applySpotifyPlaybackFallback(config, parsed.data, toolContext, false, (err) =>
      logger.warn(err, "[agent-tools] spotify playback fallback failed"),
    );
    return {
      agentId: config.id,
      agentType: config.type,
      type: parsed.type,
      data: fallback.data,
      tokensUsed: result.usage?.totalTokens ?? 0,
      durationMs,
      success: fallback.error === null,
      error: fallback.error,
    };
  } catch (err) {
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
  temperature: number | undefined,
  maxTokens: number,
  toolContext: AgentToolContext,
  streamResponses: boolean,
  startTime: number,
  context: AgentContext,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const MAX_TOOL_ROUNDS = 5;
  const loopMessages = [...initialMessages];
  let totalTokens = 0;
  const logger = createAgentRuntimeDebug(context);
  const debugAgentsEnabled = logger.isLevelEnabled("debug");
  const emit = (entry: AgentRuntimeDebugEntry) => logger.emit(entry);
  let spotifyPlayCalled = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await provider.chatComplete(
      loopMessages,
      buildChatCompleteOptions({
        model,
        temperature,
        maxTokens,
        stream: streamResponses,
        tools: toolContext.tools,
        signal,
      }),
    );

    totalTokens += result.usage?.totalTokens ?? 0;

    // No tool calls → final response
    if (!result.toolCalls || result.toolCalls.length === 0) {
      const responseText = result.content?.trim() ?? "";
      if (!responseText) {
        return makeError(config, `${config.name} returned an empty response.`, startTime);
      }
      const parsed = parseAgentResponse(config, responseText);
      if (parsed.error) {
        return makeError(config, formatAgentParseError(config, parsed.error), startTime);
      }
      const fallback = await applySpotifyPlaybackFallback(config, parsed.data, toolContext, spotifyPlayCalled, (err) =>
        logger.warn(err, "[agent-tools] spotify playback fallback failed"),
      );
      return {
        agentId: config.id,
        agentType: config.type,
        type: parsed.type,
        data: fallback.data,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        success: fallback.error === null,
        error: fallback.error,
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
      emit({
        level: "info",
        phase: config.phase,
        message: "tool-call",
        toolCall: { name: tc.function.name, arguments: formatToolPayloadForLog(tc.function.arguments), allowed: true },
      });
      if (debugAgentsEnabled) {
        logger.debug("[agent-tools] %s args: %s", config.type, formatToolPayloadForLog(tc.function.arguments));
      }
      let toolResult: string;
      let toolSucceeded = true;
      try {
        toolResult = await toolContext.executeToolCall(tc);
      } catch (err) {
        // Cancellation must abort the whole turn — re-throw so the outer
        // makeError(...) path is skipped and the run unwinds cleanly.
        if (isAgentCancellation(err, signal)) throw err;
        // Any other tool failure is recoverable: feed the error back to the
        // model as a role:"tool" result so it can self-correct within the
        // remaining tool rounds, mirroring the main loop in start-generation.ts.
        logger.error(err, "[agent-tools] %s %s failed", config.type, tc.function.name);
        toolSucceeded = false;
        toolResult = JSON.stringify({ error: extractErrorMessage(err, `Tool ${tc.function.name} failed`) });
      }
      if (toolSucceeded) {
        logger.info("[agent-tools] %s %s completed", config.type, tc.function.name);
        // Only mark spotify_play as called once it actually succeeded. A thrown
        // call is recovered above (fed back to the model), so leaving the flag
        // unset lets applySpotifyPlaybackFallback retry the real playback instead
        // of suppressing it and reporting success with no audio.
        if (config.type === "spotify" && tc.function.name === "spotify_play") {
          spotifyPlayCalled = true;
        }
      }
      emit({
        level: "info",
        phase: config.phase,
        message: "tool-result",
        toolResult: { name: tc.function.name, result: formatToolPayloadForLog(toolResult), success: toolSucceeded },
      });
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
  const finalResult = await provider.chatComplete(
    loopMessages,
    buildChatCompleteOptions({
      model,
      temperature,
      maxTokens,
      stream: streamResponses,
      signal,
    }),
  );
  totalTokens += finalResult.usage?.totalTokens ?? 0;
  const responseText = finalResult.content?.trim() ?? "";
  if (!responseText) {
    return makeError(config, `${config.name} returned an empty response.`, startTime);
  }
  const parsed = parseAgentResponse(config, responseText);
  if (parsed.error) {
    return makeError(config, formatAgentParseError(config, parsed.error), startTime);
  }
  const fallback = await applySpotifyPlaybackFallback(config, parsed.data, toolContext, spotifyPlayCalled, (err) =>
    logger.warn(err, "[agent-tools] spotify playback fallback failed"),
  );
  return {
    agentId: config.id,
    agentType: config.type,
    type: parsed.type,
    data: fallback.data,
    tokensUsed: totalTokens,
    durationMs: Date.now() - startTime,
    success: fallback.error === null,
    error: fallback.error,
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function spotifyTrackUrisFromAgentData(data: unknown): string[] {
  if (!isJsonRecord(data) || data.action !== "play") return [];
  const rawUris = Array.isArray(data.trackUris) ? data.trackUris : [];
  return rawUris
    .filter((uri): uri is string => typeof uri === "string" && uri.startsWith("spotify:track:"))
    .slice(0, 5);
}

function spotifyPlaybackFallbackCall(uris: string[]): LLMToolCall {
  const args = uris.length === 1 ? { uri: uris[0] } : { uris };
  return {
    id: `spotify-fallback-${Date.now().toString(36)}`,
    name: "spotify_play",
    arguments: JSON.stringify(args),
    function: {
      name: "spotify_play",
      arguments: JSON.stringify(args),
    },
  };
}

function parseSpotifyPlaybackFallbackResult(playback: string): unknown {
  try {
    return JSON.parse(playback);
  } catch {
    return playback;
  }
}

interface SpotifyPlaybackFallbackResult {
  data: unknown;
  error: string | null;
}

function spotifyPlaybackFallbackFailureData(data: unknown, error: string): unknown {
  if (!isJsonRecord(data)) return data;
  return {
    ...data,
    toolFallbackApplied: false,
    toolFallbackFailed: true,
    toolFallbackError: error,
    playback: {
      success: false,
      code: "spotify_playback_fallback_failed",
      tool: "spotify_play",
      error,
    },
  };
}

function spotifyPlaybackFallbackError(playback: Record<string, unknown>): string | null {
  if (playback.applied === true && playback.success !== false) return null;
  const error = playback.error;
  if (typeof error === "string" && error.trim()) {
    return `Spotify playback failed: ${error}`;
  }
  return "Spotify playback failed: Spotify play did not apply playback.";
}

function spotifyPlaybackStringField(playback: Record<string, unknown>, key: string): string | null {
  const value = playback[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function spotifyPlaybackCurrentUri(playback: Record<string, unknown>): string | null {
  const direct = spotifyPlaybackStringField(playback, "currentUri");
  if (direct) return direct;
  const track = playback.track;
  if (isJsonRecord(track)) {
    const uri = track.uri;
    if (typeof uri === "string" && uri.startsWith("spotify:")) return uri;
  }
  return null;
}

function spotifyPlaybackQueuedCount(playback: Record<string, unknown>, fallbackUris: string[]): number {
  const queued = playback.queued;
  if (typeof queued === "number" && Number.isFinite(queued)) return Math.max(0, Math.floor(queued));
  if (Array.isArray(queued)) return queued.length;
  const uris = playback.uris;
  if (Array.isArray(uris)) return uris.length;
  return fallbackUris.length;
}

function spotifyPlaybackDevice(playback: Record<string, unknown>): unknown {
  const device = playback.device;
  if (isJsonRecord(device)) {
    const name = device.name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return device ?? null;
}

function spotifyPlaybackFallbackSuccessData(data: unknown, playback: Record<string, unknown>, uris: string[]): unknown {
  if (!isJsonRecord(data)) return data;
  const queued = spotifyPlaybackQueuedCount(playback, uris);
  const trackNames = Array.isArray(data.trackNames)
    ? data.trackNames.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  const display = spotifyPlaybackStringField(playback, "display");
  return {
    ...data,
    trackUris: uris,
    ...(trackNames.length > 0 ? { trackNames } : {}),
    toolFallbackApplied: true,
    currentUri: spotifyPlaybackCurrentUri(playback),
    queued,
    device: spotifyPlaybackDevice(playback),
    display: display ?? data.display,
    playback,
  };
}

async function applySpotifyPlaybackFallback(
  config: Pick<AgentExecConfig, "type">,
  data: unknown,
  toolContext: AgentToolContext | null | undefined,
  spotifyPlayCalled: boolean,
  onFallbackError?: (err: unknown) => void,
): Promise<SpotifyPlaybackFallbackResult> {
  if (config.type !== "spotify" || spotifyPlayCalled) return { data, error: null };
  const uris = spotifyTrackUrisFromAgentData(data);
  if (uris.length === 0) return { data, error: null };
  if (!toolContext || !toolContext.tools.some((tool) => tool.name === "spotify_play")) {
    const error = "Spotify playback failed: Spotify DJ chose music, but spotify_play is not enabled for this agent.";
    return { data: spotifyPlaybackFallbackFailureData(data, error), error };
  }
  let playback: string;
  try {
    playback = await toolContext.executeToolCall(spotifyPlaybackFallbackCall(uris));
  } catch (err) {
    onFallbackError?.(err);
    const error = `Spotify playback failed: ${extractErrorMessage(err, "Spotify playback fallback failed")}`;
    return { data: spotifyPlaybackFallbackFailureData(data, error), error };
  }
  const parsedPlayback = parseSpotifyPlaybackFallbackResult(playback);
  if (!isJsonRecord(parsedPlayback)) {
    const error = "Spotify playback failed: Spotify playback returned an unreadable response.";
    return { data: spotifyPlaybackFallbackFailureData(data, error), error };
  }
  const playbackError = spotifyPlaybackFallbackError(parsedPlayback);
  if (playbackError) {
    return { data: spotifyPlaybackFallbackFailureData(data, playbackError), error: playbackError };
  }
  return { data: spotifyPlaybackFallbackSuccessData(data, parsedPlayback, uris), error: null };
}

// ──────────────────────────────────────────────
// Batched Execution — Multiple agents in one LLM call
// ──────────────────────────────────────────────

/**
 * Execute multiple agents in a single LLM call.
 * Combines all agent prompts into one request using XML-delimited sections,
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
  const logger = createAgentRuntimeDebug(context);
  const emit = (entry: AgentRuntimeDebugEntry) => logger.emit(entry);
  const isolatedConfigs = configs.filter(shouldRunAgentIndividually);
  if (isolatedConfigs.length === configs.length) {
    logger.info(
      "[agent-batch] Running %d isolated agent(s) individually: [%s]",
      isolatedConfigs.length,
      isolatedConfigs.map((c) => c.type).join(", "),
    );
    const isolatedSettled = await Promise.allSettled(
      isolatedConfigs.map((config) => executeAgent(config, context, provider, model)),
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
      Promise.allSettled(isolatedConfigs.map((config) => executeAgent(config, context, provider, model))),
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

  try {
    // Build merged system prompt (includes lore + agent extras)
    const systemPrompt = buildBatchSystemPrompt(configs, context);
    // Batch uses the max contextSize among its members
    const batchContextSize = Math.max(...configs.map((c) => normalizeAgentContextSize(c.settings.contextSize)));
    const messages = buildAgentMessages(systemPrompt, context, "__batch__", batchContextSize, {
      finalInstruction: buildBatchFinalInstruction(configs),
    });

    // Each agent reserves its own configured output budget. The context fitter
    // may still reduce this further if the prompt needs more room.
    const perAgentTokens = configs.map((c) => normalizeAgentMaxTokens(c.settings.maxTokens));
    const temperature = batchAgentTemperature(configs);
    const rawBatchMaxTokens = Math.min(
      perAgentTokens.reduce((sum, tokens) => sum + tokens, 0),
      MAX_AGENT_MAX_TOKENS,
    );
    const batchMaxTokens = applyProviderMaxTokensOverride(provider, rawBatchMaxTokens);
    const streamResponses = context.streaming !== false;
    logger.info(
      `[agent-batch] maxTokens: ${batchMaxTokens} (sum=${rawBatchMaxTokens} from [${perAgentTokens.join(", ")}]${provider.maxTokensOverrideValue !== null ? `, capped at ${provider.maxTokensOverrideValue}` : ""})`,
    );
    emit({
      level: "info",
      phase: configs[0]!.phase,
      message: "batch-start",
      agents: configs.map((c) => ({
        type: c.type,
        name: c.name,
        model,
        maxTokens: normalizeAgentMaxTokens(c.settings.maxTokens),
      })),
      batchMaxTokens,
    });

    logger.debug(`\n[agent-batch] ═══ BATCH PROMPT — [${configs.map((c) => c.type).join(", ")}] — ${model} ═══`);
    for (const msg of messages) {
      logger.debug(`[agent-batch] [${msg.role}] ${msg.content}`);
      emit({
        level: "debug",
        phase: configs[0]!.phase,
        message: "batch-prompt-message",
        args: [msg.role, msg.content],
      });
    }
    logger.debug(
      `[agent-batch] ═══ END BATCH PROMPT — temperature=${temperature ?? "connection"} maxTokens=${batchMaxTokens} ═══\n`,
    );
    emit({
      level: "debug",
      phase: configs[0]!.phase,
      message: "batch-prompt-end",
      args: [temperature, batchMaxTokens],
    });

    // Use streaming (onToken) to keep the connection alive — avoids proxy
    // timeouts (e.g. Cloudflare 524) on large batch responses.
    let responseText = "";
    const result = await provider.chatComplete(
      messages,
      buildChatCompleteOptions({
        model,
        temperature,
        maxTokens: batchMaxTokens,
        stream: streamResponses,
        onToken: streamResponses
          ? (chunk) => {
              responseText += chunk;
            }
          : undefined,
        signal: context.signal,
      }),
    );

    // chatComplete also accumulates content, but streaming via onToken is
    // the primary path — use whichever is populated.
    if (!responseText && result.content) responseText = result.content;
    responseText = responseText.trim();
    const durationMs = Date.now() - startTime;
    const totalTokens = result.usage?.totalTokens ?? 0;

    logger.info(`[agent-batch] Got response (${responseText.length} chars, ${durationMs}ms, ${totalTokens} tokens)`);
    logger.debug(`[agent-batch] ${responseText}`);
    emit({
      level: "info",
      phase: configs[0]!.phase,
      message: "batch-response",
      args: [responseText.length, durationMs, totalTokens],
    });
    emit({ level: "debug", phase: configs[0]!.phase, message: "batch-raw-response", args: [responseText] });

    // Parse the batched response into individual results
    await yieldToHost();
    const { parsed, failed } = await parseBatchResponse(configs, responseText, durationMs, totalTokens);

    logger.info(
      "[agent-batch] Batch parse: %d parsed, %d failed %s",
      parsed.length,
      failed.length,
      failed.length > 0 ? `Failed: [${failed.map((f) => f.type).join(", ")}]` : "",
    );

    // Retry failed agents individually (batch fallback)
    if (failed.length > 0) {
      logger.info(`[agent-batch] Retrying ${failed.length} failed agents individually...`);
      const retrySettled = await Promise.allSettled(
        failed.map((config) => executeAgent(config, context, provider, model)),
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
    logger.error(err, "[agent-batch] Batch call FAILED: %s", errMsg);
    return configs.map((c) => makeError(c, errMsg, startTime));
  }
}

/**
 * Build a combined system prompt for a batch of agents.
 * Structure: <role> + <lore> + <agents> + extras
 */
function buildBatchSystemPrompt(configs: AgentExecConfig[], context: AgentContext): string {
  const parts: string[] = [];

  // ── Role ──
  parts.push(`<role>`);
  parts.push(
    `You are a collection of ${configs.length} specialized agents. Fulfill all tasks and return all requested outputs.`,
  );
  parts.push(
    `You MUST wrap each task's output in a <result> tag with the agent ID. Output ALL ${configs.length} result blocks.`,
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
    const template = config.promptTemplate || getDefaultAgentPrompt(config.type);
    parts.push(``);
    parts.push(`<agent_task id="${config.type}" name="${config.name}">`);
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

  // ── Output format ──
  parts.push(``);
  parts.push(`─── REQUIRED OUTPUT FORMAT ───`);
  for (const config of configs) {
    const isJson = agentResponseIsJson(config);
    parts.push(
      `<result agent="${config.type}">`,
      isJson ? `{ ... valid JSON ... }` : `... your text output ...`,
      `</result>`,
    );
  }
  parts.push(``);
  parts.push(
    `CRITICAL: Output ALL ${configs.length} result blocks. Use exact agent IDs: ${configs.map((c) => c.type).join(", ")}. JSON agents must output valid JSON (no markdown fences). No text outside <result> blocks.`,
  );

  return parts.join("\n");
}

function buildBatchFinalInstruction(configs: AgentExecConfig[]): string {
  return [
    "Now return the requested outputs.",
    `Output all ${configs.length} result blocks using the exact agent IDs: ${configs.map((config) => config.type).join(", ")}.`,
    "Use the required formats from the system instructions. JSON agents must return valid JSON without markdown fences. Do not add text outside the result blocks.",
  ].join("\n");
}

/**
 * Parse a batched LLM response into individual AgentResults.
 * Looks for <result agent="type">...</result> blocks.
 */
async function parseBatchResponse(
  configs: AgentExecConfig[],
  responseText: string,
  totalDurationMs: number,
  totalTokens: number = 0,
): Promise<{ parsed: AgentResult[]; failed: AgentExecConfig[] }> {
  const perAgentDuration = Math.round(totalDurationMs / configs.length);
  const perAgentTokens = Math.round(totalTokens / configs.length);
  const resultBlocks = extractResultBlocks(responseText);
  const parsed: AgentResult[] = [];
  const failed: AgentExecConfig[] = [];

  for (let index = 0; index < configs.length; index++) {
    const config = configs[index]!;
    if (index > 0) await yieldToHost();
    const matchedOutput =
      resultBlocks.get(normalizeResultAgentId(config.type)) ?? findLegacyResultBlock(responseText, config.type);

    if (matchedOutput !== null) {
      const parsedResult = parseAgentResponse(config, matchedOutput);
      if (parsedResult.error) {
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
        success: true,
        error: null,
      });
    } else {
      // Could not find this agent's output — mark for individual retry
      failed.push(config);
    }
  }

  return { parsed, failed };
}

function extractResultBlocks(responseText: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const starts: Array<{ agent: string; index: number; contentStart: number }> = [];
  const openTagPattern = /<result\s+agent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openTagPattern.exec(responseText)) !== null) {
    const agent = normalizeResultAgentId(match[1] ?? match[2] ?? match[3] ?? "");
    if (!agent) continue;
    starts.push({ agent, index: match.index, contentStart: match.index + match[0].length });
  }

  for (let index = 0; index < starts.length; index++) {
    const current = starts[index]!;
    if (blocks.has(current.agent)) continue;
    const nextStart = starts[index + 1]?.index ?? responseText.length;
    const segment = responseText.slice(current.contentStart, nextStart);
    const closeIndex = segment.search(/<\/result\s*>/i);
    const content = (closeIndex >= 0 ? segment.slice(0, closeIndex) : segment).trim();
    blocks.set(current.agent, content);
  }

  return blocks;
}

function findLegacyResultBlock(responseText: string, agentType: string): string | null {
  const escaped = escapeRegex(agentType);
  const patterns = [
    new RegExp(`<result_${escaped}>([\\s\\S]*?)</result_${escaped}>`, "i"),
    new RegExp(`<${escaped}>([\\s\\S]*?)</${escaped}>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = responseText.match(pattern);
    if (match) return match[1]!.trim();
  }
  return null;
}

function normalizeResultAgentId(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Helpers ──

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlText(tag: string, value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `<${tag}>${escapeXml(text)}</${tag}>` : null;
}

function pushXmlText(parts: string[], tag: string, value: unknown): void {
  const line = xmlText(tag, value);
  if (line) parts.push(line);
}

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

function formatAgentParseError(config: Pick<AgentExecConfig, "name">, error: string): string {
  return `${config.name} returned malformed JSON: ${error}`;
}

function shouldRunAgentIndividually(config: Pick<AgentExecConfig, "type">): boolean {
  // These agents either need compact prompts or carry large private extras that
  // must not be merged into unrelated batched agent requests.
  return (
    config.type === "expression" ||
    config.type === "echo-chamber" ||
    config.type === ILLUSTRATOR_AGENT_TYPE ||
    config.type === "lorebook-keeper" ||
    config.type === "spotify"
  );
}

function illustratorReferenceEntries(context: AgentContext): Array<{ name: string; ownerType: string; image: string }> {
  const entries = context.memory._illustratorReferenceImages;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is { name?: unknown; ownerType?: unknown; image?: unknown } => isJsonRecord(entry))
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name.trim() : "",
      ownerType: typeof entry.ownerType === "string" ? entry.ownerType.trim() : "character",
      image: typeof entry.image === "string" ? entry.image.trim() : "",
    }))
    .filter((entry) => entry.name && entry.image);
}

function attachImagesToLastUserMessage(messages: ChatMessage[], images: string[]): ChatMessage[] {
  if (images.length === 0) return messages;
  const next = messages.map((message) => ({ ...message }));
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.role !== "user") continue;
    const existingImages = Array.isArray(next[index]!.images) ? (next[index]!.images as string[]) : [];
    next[index] = { ...next[index]!, images: [...existingImages, ...images] };
    return next;
  }
  next.push({ role: "user", content: "", images });
  return next;
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

  // Build multi-turn message array for this agent (sliced to its own contextSize)
  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize);
  const messages = buildAgentMessages(systemParts.join("\n"), context, config.type, agentContextSize);
  if (config.type !== ILLUSTRATOR_AGENT_TYPE) return messages;
  return attachImagesToLastUserMessage(
    messages,
    illustratorReferenceEntries(context).map((reference) => reference.image),
  );
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

function formatMainResponseForAgent(agentType: string, text: string): string {
  return agentType === "editor" ? text.trim() : stripHtmlTags(text);
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

function findLatestUserMessage(context: AgentContext): { index: number; content: string } | null {
  for (let index = context.recentMessages.length - 1; index >= 0; index--) {
    const message = context.recentMessages[index]!;
    if (message.role === "user" && message.content.trim()) {
      return { index, content: message.content };
    }
  }
  return null;
}

function characterNameForId(context: AgentContext, characterId?: string | null): string | null {
  const id = characterId?.trim();
  if (!id) return null;
  return context.characters.find((character) => character.id === id)?.name?.trim() || null;
}

function agentSpeakerLabel(message: { role: string; characterId?: string }, context: AgentContext): string {
  if (message.role === "user") return context.persona?.name?.trim() || "User";
  if (message.role === "assistant") {
    return characterNameForId(context, message.characterId) || context.characters[0]?.name?.trim() || "Assistant";
  }
  return message.role || "Message";
}

function mainResponseSpeakerLabel(context: AgentContext): string {
  return (
    characterNameForId(context, context.mainResponseCharacterId) || context.characters[0]?.name?.trim() || "Assistant"
  );
}

function buildSpotifyAgentMessages(config: AgentExecConfig, template: string, context: AgentContext): ChatMessage[] {
  const modeLabel = context.chatMode === "game" ? "game" : "roleplay";
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(`You are a specialized Spotify DJ agent for the current ${modeLabel} turn.`);
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(buildLoreBlock(context));
  systemParts.push(``);
  systemParts.push(`<agents>`);
  systemParts.push(`Fulfill the requested task here and return the output in the format specified:`);
  systemParts.push(template);
  systemParts.push(`</agents>`);

  const extras = buildAgentExtras(context, ["spotify"]);
  if (extras) {
    systemParts.push(``);
    systemParts.push(extras);
  }

  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize);
  const recentContext = context.recentMessages.slice(-agentContextSize).filter((message) => message.content.trim());
  const latestUser = findLatestUserMessage(context);
  const latestTurn = context.mainResponse?.trim() || findLatestAssistantMessage(context)?.content || "";
  const userParts: string[] = [];

  if (recentContext.length > 0) {
    userParts.push(`<recent_context>`);
    for (const message of recentContext) {
      const speaker = agentSpeakerLabel(message, context);
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

  if (latestTurn) {
    userParts.push(`<last_${modeLabel}_turn>`);
    userParts.push(truncateAgentText(latestTurn, 5000));
    userParts.push(`</last_${modeLabel}_turn>`);
    userParts.push(``);
  }

  userParts.push(
    `Pick music for this ${modeLabel} turn only. Use tools to inspect playback and fetch/search candidate tracks.`,
  );
  userParts.push(`Now return the requested format.`);

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

function buildEchoChamberAgentMessages(
  config: AgentExecConfig,
  template: string,
  context: AgentContext,
): ChatMessage[] {
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(`You are a specialized Echo Chamber agent. Keep the request compact and return only JSON.`);
  systemParts.push(`</role>`);
  systemParts.push(``);
  systemParts.push(`<agents>`);
  systemParts.push(`Fulfill the requested task here and return the output in the format specified:`);
  systemParts.push(template);
  systemParts.push(`</agents>`);

  const agentContextSize = normalizeAgentContextSize(config.settings.contextSize, ECHO_AGENT_RECENT_CONTEXT_MESSAGES);
  const recentContext = context.recentMessages
    .slice(-Math.min(agentContextSize, ECHO_AGENT_RECENT_CONTEXT_MESSAGES))
    .filter((message) => message.content.trim());
  const responseText = context.mainResponse?.trim() || findLatestAssistantMessage(context)?.content || "";
  const responseSpeaker = mainResponseSpeakerLabel(context);
  const userParts: string[] = [];

  if (recentContext.length > 0) {
    userParts.push(`<recent_context_for_continuity>`);
    for (const message of recentContext) {
      const speaker = agentSpeakerLabel(message, context);
      userParts.push(`${speaker}: ${truncateAgentText(message.content, ECHO_AGENT_CONTEXT_CHAR_LIMIT)}`);
    }
    userParts.push(`</recent_context_for_continuity>`);
    userParts.push(``);
  }

  userParts.push(`<current_response speaker="${escapeXml(responseSpeaker)}">`);
  userParts.push(truncateAgentText(responseText, ECHO_AGENT_RESPONSE_CHAR_LIMIT));
  userParts.push(`</current_response>`);
  userParts.push(``);
  userParts.push(
    `React ONLY to <current_response>. Use <recent_context_for_continuity> only for names, callbacks, and setup. Do not treat earlier assistant messages as the latest beat, especially when multiple group-chat assistants answer one after another.`,
  );
  userParts.push(`Now return the requested format.`);

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

function buildExpressionAgentMessages(template: string, context: AgentContext): ChatMessage[] {
  const systemParts: string[] = [];
  systemParts.push(`<role>`);
  systemParts.push(`You are a specialized expression-selection agent. Keep the request compact and return only JSON.`);
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

  userParts.push(`<assistant_response>`);
  userParts.push(truncateAgentText(responseText, EXPRESSION_AGENT_RESPONSE_CHAR_LIMIT));
  userParts.push(`</assistant_response>`);
  userParts.push(``);
  userParts.push(`Now return the requested format.`);

  return [
    { role: "system", content: systemParts.join("\n"), contextKind: "prompt" },
    { role: "user", content: userParts.join("\n"), contextKind: "history" },
  ];
}

/** Extract a useful message from fetch/network errors (preserves err.cause). */
/** True when an error represents user/host cancellation (vs. a recoverable tool failure). */
function isAgentCancellation(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return err instanceof Error && err.name === "AbortError";
}

function extractErrorMessage(err: unknown, fallback = "Agent execution failed"): string {
  if (!(err instanceof Error)) return fallback;
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${err.message}: ${cause.message}`;
  }
  return err.message || fallback;
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
 *     (committed tracker state appended to last 3 assistant messages)
 *
 *   FINAL USER MESSAGE:
 *     assistant_response (if post-processing) + "Now return the requested format(s)."
 */
function buildAgentMessages(
  systemPrompt: string,
  context: AgentContext,
  agentType: string,
  contextSize = 5,
  options: { finalInstruction?: string } = {},
): ChatMessage[] {
  // ── 1. System message — already contains <role>, <lore>, <agents>, and extras ──
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // ── 2. Chat history as proper multi-turn messages ──
  // Slice to this agent's own contextSize (the shared pool may be larger)
  const recent = context.recentMessages.slice(-contextSize);
  // Text-output agents (director, prose-guardian) evaluate pacing/writing
  // quality and do NOT need raw committed tracker JSON. Including it makes
  // the input look like `[assistant] roleplay + <committed_tracker_state>{...}`
  // — a pattern small/fine-tuned models mimic into their response, leaking
  // roleplay and tracker JSON that gets injected into the main prompt.
  const skipTrackerAppend = isTextOutputAgentType(agentType);
  if (recent.length > 0) {
    // Only attach committed tracker state to the last 3 assistant messages to save tokens
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

      // Append committed tracker data only to the last 3 assistant messages,
      // and only for agents whose output is structured (not text agents — see above).
      if (!skipTrackerAppend && msg.gameState && trackerEligible.has(msgIdx)) {
        const gs = msg.gameState;
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
        if (gs.playerStats) trackerSummary.playerStats = gs.playerStats;
        if (gs.personaStats?.length) trackerSummary.personaStats = gs.personaStats;
        if (Object.keys(trackerSummary).length > 0) {
          content += `\n\n<committed_tracker_state>\n${JSON.stringify(trackerSummary, stripAvatarPathsReplacer)}\n</committed_tracker_state>`;
        }
      }

      // Merge consecutive messages with the same role (API requirement)
      const last = messages[messages.length - 1]!;
      if (last.role === role) {
        messages[messages.length - 1] = { ...last, content: last.content + "\n\n" + content };
      } else {
        messages.push({ role, content });
      }
    }
  }

  // ── 3. Final instruction (user message) ──
  const finalParts: string[] = [];

  if (context.mainResponse) {
    finalParts.push(`<assistant_response>`);
    finalParts.push(formatMainResponseForAgent(agentType, context.mainResponse));
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

  const finalInstruction =
    options.finalInstruction ?? (finalParts.length > 0 ? "Now return the requested format(s)." : "");
  if (finalParts.length > 0 || finalInstruction) {
    if (finalInstruction) finalParts.push(`\n${finalInstruction}`);
    const finalContent = finalParts.join("\n").trim();
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
      parts.push(`<character id="${escapeXml(char.id)}" name="${escapeXml(char.name)}">`);
      pushXmlText(parts, "name", char.name);
      pushXmlText(parts, "description", char.description);
      pushXmlText(parts, "personality", char.personality);
      pushXmlText(parts, "backstory", char.backstory);
      pushXmlText(parts, "appearance", char.appearance);
      pushXmlText(parts, "scenario", char.scenario);
      pushXmlText(parts, "first_mes", char.firstMes);
      pushXmlText(parts, "mes_example", char.mesExample);
      pushXmlText(parts, "system_prompt", char.systemPrompt);
      pushXmlText(parts, "post_history_instructions", char.postHistoryInstructions);
      parts.push(`</character>`);
    }
    parts.push(`</characters>`);
  }

  if (context.persona) {
    parts.push(`<user_persona name="${escapeXml(context.persona.name)}">`);
    pushXmlText(parts, "name", context.persona.name);
    pushXmlText(parts, "description", context.persona.description);
    pushXmlText(parts, "personality", context.persona.personality);
    pushXmlText(parts, "backstory", context.persona.backstory);
    pushXmlText(parts, "appearance", context.persona.appearance);
    pushXmlText(parts, "scenario", context.persona.scenario);
    if (context.persona.personaStats?.enabled && context.persona.personaStats.bars.length > 0) {
      parts.push(`<persona_stats>`);
      for (const bar of context.persona.personaStats.bars) {
        parts.push(
          `<stat name="${escapeXml(bar.name)}" value="${bar.value}" max="${bar.max}" color="${escapeXml(bar.color)}" />`,
        );
      }
      parts.push(`</persona_stats>`);
    }
    if (context.persona.rpgStats?.enabled) {
      const rpg = context.persona.rpgStats;
      parts.push(`<rpg_stats>`);
      parts.push(`<hp value="${rpg.hp.value}" max="${rpg.hp.max}" />`);
      if (rpg.attributes.length > 0) {
        parts.push(`<attributes>`);
        for (const attr of rpg.attributes) {
          parts.push(`<attribute name="${escapeXml(attr.name)}" value="${attr.value}" />`);
        }
        parts.push(`</attributes>`);
      }
      parts.push(`</rpg_stats>`);
    }
    parts.push(`</user_persona>`);
  }

  parts.push(`</lore>`);
  return parts.join("\n");
}

function buildAvailableSpritesBlock(context: AgentContext): string {
  if (!context.memory._availableSprites) return "";

  const sprites = context.memory._availableSprites as Array<{
    characterId: string;
    characterName: string;
    expressions: string[];
    expressionChoices?: string[];
  }>;
  const parts: string[] = [`<available_sprites>`];
  for (const char of sprites) {
    const choices = char.expressionChoices?.length ? char.expressionChoices : char.expressions;
    parts.push(`${char.characterName} (${char.characterId}): ${choices.join(", ")}`);
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
      if (char.systemPrompt) parts.push(`<system_prompt>${escapeXml(char.systemPrompt)}</system_prompt>`);
      if (char.postHistoryInstructions)
        parts.push(`<post_history_instructions>${escapeXml(char.postHistoryInstructions)}</post_history_instructions>`);
      parts.push(`</character>`);
    }
    parts.push(`</character_cards>`);
  }

  if (context.gameState) {
    parts.push(`<current_game_state>`);
    parts.push(JSON.stringify(context.gameState, stripAvatarPathsReplacer));
    parts.push(`</current_game_state>`);
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
    parts.push(`</background_generation>`);
  }

  if (agentTypes.includes(ILLUSTRATOR_AGENT_TYPE)) {
    const references = illustratorReferenceEntries(context);
    if (references.length > 0) {
      parts.push(`<visual_references>`);
      parts.push(
        `Attached reference images are provided to preserve visible identity details such as eye color, hair, face, body proportions, skin tone, scars, markings, and distinctive accessories. They correspond to these subjects in order:`,
      );
      for (let index = 0; index < references.length; index += 1) {
        const reference = references[index]!;
        parts.push(`${index + 1}. ${reference.name} (${reference.ownerType})`);
      }
      parts.push(`</visual_references>`);
    }
  }

  if (agentTypes.includes("spotify") && context.memory._spotifyDjConstraints) {
    parts.push(`<spotify_dj_constraints>`);
    parts.push(JSON.stringify(context.memory._spotifyDjConstraints));
    parts.push(`</spotify_dj_constraints>`);
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
    parts.push(`<secret_plot_state>`);
    parts.push(JSON.stringify(context.memory._secretPlotState));
    parts.push(`</secret_plot_state>`);
  }

  return parts.join("\n");
}

/** Map agent type → its primary result type. */
const AGENT_RESULT_TYPE_MAP: Record<string, AgentResultType> = {
  "world-state": "game_state_update",
  "prose-guardian": "context_injection",
  continuity: "continuity_check",
  expression: "sprite_change",
  "echo-chamber": "echo_message",
  director: "director_event",
  quest: "quest_update",
  illustrator: "image_prompt",
  "lorebook-keeper": "lorebook_update",
  "card-evolution-auditor": "character_card_update",
  "prompt-reviewer": "prompt_review",
  combat: "game_state_update",
  background: "background_change",
  "character-tracker": "character_tracker_update",
  "persona-stats": "persona_stats_update",
  "custom-tracker": "custom_tracker_update",
  "chat-summary": "chat_summary",
  spotify: "spotify_control",
  editor: "text_rewrite",
  "knowledge-retrieval": "context_injection",
  haptic: "haptic_command",
  cyoa: "cyoa_choices",
  "secret-plot-driver": "secret_plot",
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
  "prompt_review",
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "chat_summary",
  "spotify_control",
  "haptic_command",
  "cyoa_choices",
  "secret_plot",
  "game_master_narration",
  "party_action",
  "game_map_update",
  "game_state_transition",
]);

const TEXT_RESULT_TYPES = new Set<AgentResultType>(["context_injection", "director_event"]);

function resolveAgentResultType(config: Pick<AgentExecConfig, "type" | "settings">): AgentResultType {
  const configured = config.settings?.resultType;
  if (typeof configured === "string" && AGENT_RESULT_TYPES.has(configured as AgentResultType)) {
    return configured as AgentResultType;
  }
  return AGENT_RESULT_TYPE_MAP[config.type] ?? "context_injection";
}

function agentResponseIsJson(config: Pick<AgentExecConfig, "type" | "settings">): boolean {
  const resultType = resolveAgentResultType(config);
  return JSON_AGENTS.has(config.type) || !TEXT_RESULT_TYPES.has(resultType);
}

/**
 * Whether a built-in agent type's primary output is plain text (director note,
 * writing directives, etc.) rather than structured JSON. Used to suppress
 * inputs/outputs that text agents may pattern-mimic into their response.
 *
 * Returns false for unknown types (custom agents, "__batch__"): the safe
 * default keeps full context; tracker-leak sanitization runs on the output side.
 */
function isTextOutputAgentType(agentType: string): boolean {
  const resultType = AGENT_RESULT_TYPE_MAP[agentType];
  if (!resultType) return false;
  return TEXT_RESULT_TYPES.has(resultType);
}

/** Agents that return structured JSON. */
const JSON_AGENTS = new Set([
  "world-state",
  "continuity",
  "expression",
  "echo-chamber",
  "quest",
  "illustrator",
  "lorebook-keeper",
  "card-evolution-auditor",
  "prompt-reviewer",
  "combat",
  "background",
  "character-tracker",
  "persona-stats",
  "custom-tracker",
  "chat-summary",
  "spotify",
  "editor",
  "haptic",
  "cyoa",
  "secret-plot-driver",
]);

/**
 * Strip leaked synthetic tags from a text agent's response and, for the
 * Narrative Director, extract only the canonical "[Director's note: ...]"
 * payload its prompt mandates.
 *
 * Background: when a text agent (director, prose-guardian) is shown chat
 * history that ends in `<committed_tracker_state>{...}</committed_tracker_state>`,
 * smaller models will continue the pattern and emit roleplay + tracker JSON
 * before/around their intended directive. That leaked content gets injected
 * into the main prompt as a system block, then converted to a user message
 * by `prepareProviderMessages`, causing the main AI to respond to the leak.
 */
function sanitizeTextAgentResponse(agentType: string, text: string): string {
  const cleaned = text
    .replace(/<committed_tracker_state>[\s\S]*?<\/committed_tracker_state>/gi, "")
    .replace(/<assistant_response>[\s\S]*?<\/assistant_response>/gi, "")
    .trim();

  // Director output is locked to "[Director's note: ...]" by its prompt.
  // Anything outside that bracket is leakage — extract the last note (most
  // likely the model's "final" intent) and discard the rest. If no bracketed
  // note is present at all, the response is fully off-format; drop it so the
  // pipeline injects nothing rather than hallucinated roleplay.
  if (agentType === "director") {
    const noteMatches = cleaned.match(/\[Director(?:'|’)s note:[^\]]*\]/gi);
    if (noteMatches && noteMatches.length > 0) {
      return noteMatches[noteMatches.length - 1]!.trim();
    }
    return "";
  }

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
  error: string | null;
} {
  const resultType = resolveAgentResultType(config);

  if (agentResponseIsJson(config)) {
    try {
      const jsonStr = extractJson(responseText);
      const data = JSON.parse(jsonStr);
      return { type: resultType, data, error: null };
    } catch (error) {
      const fallback = coerceMalformedJsonAgentResponse(config.type, responseText);
      if (fallback !== null) {
        return { type: resultType, data: fallback, error: null };
      }
      return { type: resultType, data: null, error: extractErrorMessage(error, "Invalid JSON response") };
    }
  }

  // Text-based agents (prose-guardian, director). Sanitize before injection so
  // leaked tracker/roleplay content can't reach the main prompt.
  return { type: resultType, data: { text: sanitizeTextAgentResponse(config.type, responseText) }, error: null };
}

function coerceMalformedJsonAgentResponse(agentType: string, responseText: string): unknown | null {
  if (agentType === "world-state") return worldStatePatchFromAgentData(responseText);
  if (agentType !== "echo-chamber") return null;
  const lines = responseText
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
  const reactions = lines
    .map((line, index) => {
      const [maybeName, ...rest] = line.split(":");
      const reaction = rest.length > 0 ? rest.join(":").trim() : line;
      const characterName = rest.length > 0 && maybeName.trim().length <= 40 ? maybeName.trim() : `viewer_${index + 1}`;
      return reaction ? { characterName, reaction } : null;
    })
    .filter((entry): entry is { characterName: string; reaction: string } => entry !== null);
  return reactions.length > 0 ? { reactions } : null;
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

  try {
    JSON.parse(text);
    return text;
  } catch {
    // Repair only after parse failure so valid strings containing // survive.
  }

  return repairJson(text);
}

/** Fix common LLM JSON mistakes: trailing commas, comments, ellipsis placeholders. */
function repairJson(str: string): string {
  return removeEllipsesOutsideJsonStrings(
    removeTrailingCommasOutsideJsonStrings(removeJsonCommentsOutsideStrings(str)),
  );
}

function removeJsonCommentsOutsideStrings(str: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index]!;
    const next = str[index + 1];
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < str.length && str[index] !== "\n" && str[index] !== "\r") index += 1;
      index -= 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < str.length && !(str[index] === "*" && str[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    result += char;
  }

  return result;
}

function removeTrailingCommasOutsideJsonStrings(str: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index]!;
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(str[lookahead] ?? "")) lookahead += 1;
      if (str[lookahead] === "}" || str[lookahead] === "]") continue;
    }
    result += char;
  }

  return result;
}

function removeEllipsesOutsideJsonStrings(str: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index]!;
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "." && str.slice(index, index + 3) === "...") {
      index += 2;
      continue;
    }
    result += char;
  }

  return result;
}
