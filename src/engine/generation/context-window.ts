import type { LlmMessage } from "../capabilities/llm";
import { readNumber } from "./runtime-records";

const DEFAULT_RESPONSE_TOKENS = 4096;
const CONTEXT_SAFETY_TOKENS = 256;
const CHARS_PER_TOKEN = 4;

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

export function fitMessagesToContextWindow(messages: LlmMessage[], parameters: Record<string, unknown>): LlmMessage[] {
  const maxContext = readNumber(parameters.maxContext, 0);
  if (maxContext <= 0) return messages;

  const maxTokens = Math.max(1, readNumber(parameters.maxTokens, DEFAULT_RESPONSE_TOKENS));
  const tokenBudget = Math.max(1, maxContext - maxTokens - CONTEXT_SAFETY_TOKENS);
  if (estimatedTokens(messages) <= tokenBudget) return messages;
  return truncateOldestHistory(messages, tokenBudget);
}
