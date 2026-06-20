import {
  DEFAULT_AGENT_MAX_TOKENS,
  MIN_AGENT_MAX_TOKENS,
} from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";

export function normalizeMaxContext(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

export function normalizeAgentMaxTokens(value: unknown, fallback = DEFAULT_AGENT_MAX_TOKENS): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(parsed));
}

export function applyProviderMaxTokensOverride(provider: BaseLLMProvider, maxTokens: number): number {
  return provider.maxTokensOverrideValue !== null ? Math.min(maxTokens, provider.maxTokensOverrideValue) : maxTokens;
}

export function minContextLimit(...limits: Array<number | undefined>): number | undefined {
  let resolved: number | undefined;
  for (const limit of limits) {
    if (limit === undefined) continue;
    resolved = resolved === undefined ? limit : Math.min(resolved, limit);
  }
  return resolved;
}

export function normalizeChatTopP(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0) return 1;
  return Math.min(value, 1);
}

export function readChatCompletionsReasoningMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  if (typeof source.reasoning_content === "string" && source.reasoning_content) {
    metadata.reasoning_content = source.reasoning_content;
  }
  if (typeof source.reasoning === "string" && source.reasoning) {
    metadata.reasoning = source.reasoning;
  }
  if (Array.isArray(source.reasoning_details) && source.reasoning_details.length) {
    metadata.reasoning_details = source.reasoning_details;
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

export function shouldReplayStoredChatCompletionsReasoning(provider: string, model: string): boolean {
  if (provider !== "openrouter") return true;
  const normalizedModel = model.toLowerCase();
  return !normalizedModel.startsWith("google/gemini") && !normalizedModel.includes("/gemini-");
}
