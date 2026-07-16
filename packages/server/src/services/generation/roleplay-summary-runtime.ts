import {
  CHAT_SUMMARY_OUTPUT_TOKENS,
  DEFAULT_CHAT_SUMMARY_PROMPT,
  type ChatSummaryPromptSettings,
  type ChatSummaryPromptTemplate,
} from "@marinara-engine/shared";

const RETIRED_CHAT_SUMMARY_AGENT_ID = "chat-summary";
const DEFAULT_AUTOMATIC_SUMMARY_INTERVAL = 5;
const MIN_AUTOMATIC_SUMMARY_INTERVAL = 1;
const MAX_AUTOMATIC_SUMMARY_INTERVAL = 200;
const MIN_SUMMARY_CONTEXT_SIZE = 5;
const MAX_SUMMARY_CONTEXT_SIZE = 500;

export const CONTINUE_ASSISTANT_MESSAGE_PROMPT = "Your last message got cut off! Please, continue!";

export function formatRoleplaySummaryChatLog(
  messages: readonly { role: string; content: string }[],
): string {
  return messages.map((message) => `[${message.role}]: ${message.content}`).join("\n\n");
}

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

export function clampRoleplaySummaryMaxTokens(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT;
  return Math.max(
    CHAT_SUMMARY_OUTPUT_TOKENS.MIN,
    Math.min(CHAT_SUMMARY_OUTPUT_TOKENS.MAX, Math.trunc(parsed)),
  );
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
  return resolveChatSummaryPrompt({
    requestedTemplateId: null,
    chatMetadata,
    globalSettingsValue: null,
  });
}

export function resolveChatSummaryPrompt(args: {
  requestedTemplateId?: string | null;
  chatMetadata: Record<string, unknown>;
  globalSettingsValue?: string | null;
}): string {
  const hasGlobalSettingsValue =
    typeof args.globalSettingsValue === "string" && args.globalSettingsValue.trim().length > 0;
  const globalSettings = parseChatSummaryPromptSettings(args.globalSettingsValue);
  const requestedId = typeof args.requestedTemplateId === "string" ? args.requestedTemplateId.trim() : "";
  const selectedId =
    requestedId ||
    globalSettings.activeTemplateId ||
    (!hasGlobalSettingsValue && typeof args.chatMetadata.activeSummaryPromptTemplateId === "string"
      ? args.chatMetadata.activeSummaryPromptTemplateId.trim()
      : "");

  const globalPrompt = resolvePromptFromTemplates(globalSettings.templates, selectedId);
  if (globalPrompt) return globalPrompt;
  // A saved global settings row is authoritative across roleplay chats.
  // Legacy chat-local templates remain a fallback only until the user has saved
  // global summary prompt settings, so old per-chat choices do not silently
  // override the selected global built-in/default behavior.
  if (hasGlobalSettingsValue) return DEFAULT_CHAT_SUMMARY_PROMPT;

  const chatTemplates = Array.isArray(args.chatMetadata.summaryPromptTemplates)
    ? (args.chatMetadata.summaryPromptTemplates as unknown[])
    : [];
  const chatPrompt = resolvePromptFromTemplates(chatTemplates, selectedId);
  if (chatPrompt) return chatPrompt;

  return DEFAULT_CHAT_SUMMARY_PROMPT;
}

export function parseChatSummaryPromptSettings(raw: string | null | undefined): ChatSummaryPromptSettings {
  if (!raw) return { templates: [], activeTemplateId: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { templates: [], activeTemplateId: null };
    }
    const record = parsed as Record<string, unknown>;
    const templates = normalizeChatSummaryPromptTemplates(record.templates);
    const activeTemplateIdRaw =
      typeof record.activeTemplateId === "string" && record.activeTemplateId.trim()
        ? record.activeTemplateId.trim()
        : null;
    const activeTemplateId =
      activeTemplateIdRaw && templates.some((template) => template.id === activeTemplateIdRaw)
        ? activeTemplateIdRaw
        : null;
    return { templates, activeTemplateId };
  } catch {
    return { templates: [], activeTemplateId: null };
  }
}

function normalizeChatSummaryPromptTemplates(value: unknown): ChatSummaryPromptTemplate[] {
  if (!Array.isArray(value)) return [];
  const templates: ChatSummaryPromptTemplate[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (!id || !name || !prompt || seen.has(id)) continue;
    seen.add(id);
    templates.push({ id, name, prompt });
  }
  return templates;
}

function resolvePromptFromTemplates(templates: unknown[], selectedId: string): string | null {
  if (!selectedId) return null;
  for (const template of templates) {
    if (!template || typeof template !== "object" || Array.isArray(template)) continue;
    const record = template as Record<string, unknown>;
    if (record.id !== selectedId) continue;
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (prompt) return prompt;
  }
  return null;
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
