import { LOCAL_SIDECAR_CONNECTION_ID, type APIConnection, type Message } from "@marinara-engine/shared";
import { parseMessageExtraRecord } from "./chat-message-extra";

export type ProfessorMariContextBudget = {
  usedTokens: number;
  maxTokens: number;
  percentage: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function resolveProfessorMariContextBudget(
  messages: readonly Message[],
  maxContext: number | null | undefined,
): ProfessorMariContextBudget | null {
  const maxTokens = tokenCount(maxContext);
  if (!maxTokens || maxTokens <= 0) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    const generationInfo = record(parseMessageExtraRecord(message.extra).generationInfo);
    if (!generationInfo) continue;
    const legacyUsage = record(generationInfo.usage);
    const promptTokens = tokenCount(generationInfo.tokensPrompt) ?? tokenCount(legacyUsage?.promptTokens);
    if (promptTokens === null) continue;

    const cachedPromptTokens = tokenCount(generationInfo.tokensCachedPrompt) ?? 0;
    const cacheWritePromptTokens = tokenCount(generationInfo.tokensCacheWritePrompt) ?? 0;
    const completionTokens =
      tokenCount(generationInfo.tokensCompletion) ?? tokenCount(legacyUsage?.completionTokens) ?? 0;
    const usedTokens = promptTokens + cachedPromptTokens + cacheWritePromptTokens + completionTokens;
    return {
      usedTokens,
      maxTokens,
      percentage: Math.min(100, (usedTokens / maxTokens) * 100),
    };
  }

  return null;
}

export function resolveChatContextBudget(
  messages: readonly Message[],
  connectionId: string | null | undefined,
  connections: readonly unknown[],
  sidecarMaxContext?: number | null,
): ProfessorMariContextBudget | null {
  if (connectionId === "random") return null;
  if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
    return resolveProfessorMariContextBudget(messages, sidecarMaxContext);
  }
  if (!connectionId) return null;
  const connection = connections.find(
    (candidate): candidate is APIConnection => record(candidate)?.id === connectionId,
  );
  return resolveProfessorMariContextBudget(messages, connection?.maxContext);
}

export function formatCompactTokenCount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 100 || Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}m`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${thousands >= 100 || Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return String(value);
}
