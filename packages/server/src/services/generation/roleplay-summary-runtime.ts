import { DEFAULT_CHAT_SUMMARY_PROMPT } from "@marinara-engine/shared";

const RETIRED_CHAT_SUMMARY_AGENT_ID = "chat-summary";
const DEFAULT_AUTOMATIC_SUMMARY_INTERVAL = 5;
const MIN_AUTOMATIC_SUMMARY_INTERVAL = 1;
const MAX_AUTOMATIC_SUMMARY_INTERVAL = 200;
const MIN_SUMMARY_CONTEXT_SIZE = 5;
const MAX_SUMMARY_CONTEXT_SIZE = 500;

export const CONTINUE_ASSISTANT_MESSAGE_PROMPT = "Your last message got cut off! Please, continue!";

export function clampRoleplaySummaryInterval(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUTOMATIC_SUMMARY_INTERVAL;
  return Math.max(MIN_AUTOMATIC_SUMMARY_INTERVAL, Math.min(MAX_AUTOMATIC_SUMMARY_INTERVAL, Math.trunc(parsed)));
}

export function clampRoleplaySummaryContextSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.max(MIN_SUMMARY_CONTEXT_SIZE, Math.min(MAX_SUMMARY_CONTEXT_SIZE, Math.trunc(parsed)));
}

export function appendContinuationMessageContent(existingContent: unknown, continuation: string): string {
  const existing = typeof existingContent === "string" ? existingContent : "";
  if (!existing) return continuation;
  if (!continuation) return existing;
  const normalizedExisting = existing.replace(/\s+$/, "");
  const normalizedContinuation = continuation.replace(/^\s+/, "");
  return `${normalizedExisting}\n\n${normalizedContinuation}`;
}

export function isAutomaticRoleplaySummaryEnabled(chatMetadata: Record<string, unknown>): boolean {
  if (chatMetadata.automaticSummaryEnabled === false) return false;
  if (chatMetadata.automaticSummaryEnabled === true) return true;
  const activeAgentIds = Array.isArray(chatMetadata.activeAgentIds) ? chatMetadata.activeAgentIds : [];
  return chatMetadata.enableAgents === true && activeAgentIds.includes(RETIRED_CHAT_SUMMARY_AGENT_ID);
}

export function withoutRetiredChatSummaryAgentIds(chatMetadata: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(chatMetadata.activeAgentIds)) return undefined;
  return chatMetadata.activeAgentIds.filter((agentId): agentId is string => {
    return typeof agentId === "string" && agentId !== RETIRED_CHAT_SUMMARY_AGENT_ID;
  });
}

export function resolveChatSummaryPromptFromMetadata(chatMetadata: Record<string, unknown>): string {
  const selectedId =
    typeof chatMetadata.activeSummaryPromptTemplateId === "string"
      ? chatMetadata.activeSummaryPromptTemplateId.trim()
      : "";
  const templates = Array.isArray(chatMetadata.summaryPromptTemplates) ? chatMetadata.summaryPromptTemplates : [];
  const selected = selectedId
    ? templates.find((template) => {
        if (!template || typeof template !== "object" || Array.isArray(template)) return false;
        const record = template as Record<string, unknown>;
        return record.id === selectedId && typeof record.prompt === "string" && record.prompt.trim().length > 0;
      })
    : null;
  if (selected && typeof (selected as Record<string, unknown>).prompt === "string") {
    return ((selected as Record<string, unknown>).prompt as string).trim();
  }
  return DEFAULT_CHAT_SUMMARY_PROMPT;
}

export function parseChatSummaryText(rawContent: string): string {
  const cleaned = rawContent
    .trim()
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "");
  try {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(cleaned.slice(first, last + 1)) as { summary?: unknown };
      return typeof parsed.summary === "string" ? parsed.summary.trim() : cleaned.trim();
    }
  } catch {
    // Fall through to raw text.
  }
  return cleaned.trim();
}
