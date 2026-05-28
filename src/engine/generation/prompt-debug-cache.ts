import type { LlmMessage } from "../capabilities/llm";
import { chatSummaryFingerprintMatches } from "../shared/text/chat-summary-fingerprint";
import { isRecord, parseRecord, readNumber, readString, type JsonRecord } from "./runtime-records";

export type CachedPromptMessage = {
  role: LlmMessage["role"];
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
};

export type SavedGenerationInfo = Record<string, unknown>;

function cachedRole(role: unknown): CachedPromptMessage["role"] | null {
  return role === "system" || role === "user" || role === "assistant" || role === "tool" ? role : null;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return readString(value);
  }
}

function cachedPromptDisplayContent(entry: JsonRecord): string {
  const parts: string[] = [];
  const content = readString(entry.content);
  if (content) parts.push(content);

  if (entry.tool_calls !== undefined) {
    parts.push(`<tool_calls>\n${prettyJson(entry.tool_calls)}\n</tool_calls>`);
  }

  const toolMetadata: Record<string, string> = {};
  const name = readString(entry.name).trim();
  const toolCallId = readString(entry.tool_call_id).trim();
  if (name) toolMetadata.name = name;
  if (toolCallId) toolMetadata.tool_call_id = toolCallId;
  if (Object.keys(toolMetadata).length > 0) {
    parts.push(`<tool_metadata>\n${prettyJson(toolMetadata)}\n</tool_metadata>`);
  }

  return parts.join("\n\n");
}

export function cachedPromptMessages(messages: LlmMessage[]): CachedPromptMessage[] {
  return messages
    .map((message) => {
      const role = cachedRole(message.role);
      if (!role) return null;
      const cached: CachedPromptMessage = { role, content: readString(message.content) };
      if (message.name) cached.name = message.name;
      if (message.tool_call_id) cached.tool_call_id = message.tool_call_id;
      if (message.tool_calls !== undefined) cached.tool_calls = message.tool_calls;
      return cached;
    })
    .filter(
      (message): message is CachedPromptMessage =>
        message !== null &&
        (message.content.length > 0 ||
          message.name !== undefined ||
          message.tool_call_id !== undefined ||
          message.tool_calls !== undefined),
    );
}

function readNullableNumber(value: unknown): number | null {
  const parsed = readNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function readUsageNumber(usage: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = readNullableNumber(usage[key]);
    if (value !== null) return value;
  }
  return null;
}

export function savedGenerationInfo(args: {
  connection: JsonRecord;
  parameters: Record<string, unknown>;
  agentResults: number;
  notes: number;
  usage?: unknown;
}): SavedGenerationInfo {
  const usage = parseRecord(args.usage);
  const customParameters = isRecord(args.parameters.customParameters) ? args.parameters.customParameters : null;
  return {
    connectionId: readString(args.connection.id) || null,
    model: readString(args.connection.model) || undefined,
    provider: readString(args.connection.provider) || undefined,
    temperature: readNullableNumber(args.parameters.temperature),
    maxTokens: readNullableNumber(args.parameters.maxTokens ?? args.parameters.max_tokens),
    maxContext: readNullableNumber(args.parameters.maxContext ?? args.parameters.max_context),
    topP: readNullableNumber(args.parameters.topP ?? args.parameters.top_p),
    topK: readNullableNumber(args.parameters.topK ?? args.parameters.top_k),
    frequencyPenalty: readNullableNumber(args.parameters.frequencyPenalty ?? args.parameters.frequency_penalty),
    presencePenalty: readNullableNumber(args.parameters.presencePenalty ?? args.parameters.presence_penalty),
    showThoughts: typeof args.parameters.showThoughts === "boolean" ? args.parameters.showThoughts : null,
    reasoningEffort: typeof args.parameters.reasoningEffort === "string" ? args.parameters.reasoningEffort : null,
    verbosity: typeof args.parameters.verbosity === "string" ? args.parameters.verbosity : null,
    serviceTier: typeof args.parameters.serviceTier === "string" ? args.parameters.serviceTier : null,
    assistantPrefill: readString(args.parameters.assistantPrefill).trim() || null,
    customParameters,
    agentResults: args.agentResults,
    notes: args.notes,
    usage: args.usage ?? null,
    tokensPrompt: readUsageNumber(
      usage,
      "promptTokens",
      "prompt_tokens",
      "inputTokens",
      "input_tokens",
      "promptTokenCount",
    ),
    tokensCompletion: readUsageNumber(
      usage,
      "completionTokens",
      "completion_tokens",
      "outputTokens",
      "output_tokens",
      "candidatesTokenCount",
    ),
    tokensCachedPrompt: readUsageNumber(
      usage,
      "cachedPromptTokens",
      "tokensCachedPrompt",
      "cached_tokens",
      "cachedContentTokenCount",
    ),
    tokensCacheWritePrompt: readUsageNumber(usage, "cacheWritePromptTokens", "tokensCacheWritePrompt"),
    durationMs: readNullableNumber(usage.durationMs),
    finishReason: readString(usage.finishReason).trim() || null,
  };
}

export function readActiveGenerationExtra(message: JsonRecord): JsonRecord | null {
  const swipes = Array.isArray(message.swipes) ? message.swipes : [];
  const messageExtra = parseRecord(message.extra);
  if (swipes.length <= 1) return messageExtra;

  const rawIndex = readNumber(message.activeSwipeIndex, 0);
  const activeIndex = Number.isFinite(rawIndex)
    ? Math.min(Math.max(Math.floor(rawIndex), 0), swipes.length - 1)
    : 0;
  const swipe = swipes[activeIndex];
  if (!isRecord(swipe) || !Object.prototype.hasOwnProperty.call(swipe, "extra")) return null;
  return parseRecord(swipe.extra);
}

export function readCachedGenerationPrompt(
  message: JsonRecord,
  currentChatSummaryFingerprint: string | null,
): { messages: CachedPromptMessage[]; generationInfo: SavedGenerationInfo | null } | null {
  const extra = readActiveGenerationExtra(message);
  if (!extra) return null;
  const rawPrompt = Array.isArray(extra.cachedPrompt) ? extra.cachedPrompt : [];
  const messages = rawPrompt
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const role = cachedRole(entry.role);
      const content = cachedPromptDisplayContent(entry);
      return role && content ? { role, content } : null;
    })
    .filter((entry): entry is CachedPromptMessage => entry !== null);

  if (messages.length === 0) return null;
  if (
    Object.prototype.hasOwnProperty.call(extra, "chatSummaryFingerprint") &&
    !chatSummaryFingerprintMatches(extra, currentChatSummaryFingerprint)
  ) {
    return null;
  }

  return {
    messages,
    generationInfo: isRecord(extra.generationInfo) ? extra.generationInfo : null,
  };
}
