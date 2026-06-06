import type { LlmMessage } from "../capabilities/llm";
import { MODEL_LISTS } from "../contracts/constants/model-lists";
import { boolish, readNumber, readString } from "./runtime-records";

const DEFAULT_RESPONSE_TOKENS = 4096;
const CONTEXT_SAFETY_TOKENS = 256;
const CHARS_PER_TOKEN = 4;

type ContextConnection = Record<string, unknown> | null | undefined;
type ContextParameters = Record<string, unknown> | null | undefined;

function readPositiveContext(value: unknown): number {
  const parsed = readNumber(value, 0);
  return parsed > 0 ? Math.trunc(parsed) : 0;
}

function normalizedKey(value: unknown): string {
  return readString(value).trim().toLowerCase();
}

function knownModelContext(connection: ContextConnection): number {
  const provider = normalizedKey(connection?.provider);
  const model = normalizedKey(connection?.model);
  if (!provider || !model) return 0;

  const modelLists = MODEL_LISTS as Partial<Record<string, Array<{ id: string; name: string; context: number }>>>;
  const known = modelLists[provider]?.find(
    (entry) => normalizedKey(entry.id) === model || normalizedKey(entry.name) === model,
  );
  return readPositiveContext(known?.context);
}

function minPositiveContext(...limits: number[]): number {
  let resolved = 0;
  for (const limit of limits) {
    if (limit <= 0) continue;
    resolved = resolved > 0 ? Math.min(resolved, limit) : limit;
  }
  return resolved;
}

export function effectiveMaxContext(connection: ContextConnection, parameters: ContextParameters): number {
  const knownContext = knownModelContext(connection);
  const parameterContext = boolish(parameters?.useMaxContext, false)
    ? knownContext
    : readPositiveContext(parameters?.maxContext);
  return minPositiveContext(readPositiveContext(connection?.maxContext), knownContext, parameterContext);
}

function estimatedMessageTokens(message: LlmMessage): number {
  const contentTokens = Math.ceil((message.content?.length ?? 0) / CHARS_PER_TOKEN);
  const imageTokens = (message.images?.length ?? 0) * 512;
  const toolTokens = message.tool_calls ? Math.ceil(JSON.stringify(message.tool_calls).length / CHARS_PER_TOKEN) : 0;
  return Math.max(1, contentTokens + imageTokens + toolTokens + 8);
}

function estimatedTokens(messages: LlmMessage[]): number {
  return messages.reduce((total, message) => total + estimatedMessageTokens(message), 0);
}

function contextKind(message: LlmMessage): string {
  const value = (message as unknown as { contextKind?: unknown }).contextKind;
  return typeof value === "string" ? value : "";
}

function firstHistoryIndex(messages: LlmMessage[]): number {
  return messages.findIndex((message) => contextKind(message) === "history");
}

function historyCount(messages: LlmMessage[]): number {
  return messages.filter((message) => contextKind(message) === "history").length;
}

function truncateOldestHistory(messages: LlmMessage[], tokenBudget: number): LlmMessage[] {
  let total = estimatedTokens(messages);
  const next = messages.map((message) => ({ ...message }));

  while (total > tokenBudget && historyCount(next) > 1) {
    const index = firstHistoryIndex(next);
    if (index < 0) break;
    total -= estimatedMessageTokens(next[index]!);
    next.splice(index, 1);
  }

  if (total <= tokenBudget) return next;

  const index = firstHistoryIndex(next);
  if (index < 0) return next;
  const message = next[index]!;
  const overflowTokens = total - tokenBudget;
  const removeChars = Math.ceil(overflowTokens * CHARS_PER_TOKEN);
  if (message.content.length <= removeChars + 256) {
    return next;
  }

  next[index] = {
    ...message,
    content: message.content
      .slice(removeChars)
      .replace(/^[\s\S]*?(?:\n\n|\n)/, "")
      .trimStart(),
  };
  return next;
}

export function fitMessagesToContextWindow(
  messages: LlmMessage[],
  parameters: Record<string, unknown>,
  connection?: Record<string, unknown> | null,
): LlmMessage[] {
  const maxContext = effectiveMaxContext(connection, parameters);
  if (maxContext <= 0) return messages;

  const maxTokens = Math.max(1, readNumber(parameters.maxTokens, DEFAULT_RESPONSE_TOKENS));
  const tokenBudget = Math.max(1, maxContext - maxTokens - CONTEXT_SAFETY_TOKENS);
  if (estimatedTokens(messages) <= tokenBudget) return messages;
  return truncateOldestHistory(messages, tokenBudget);
}
