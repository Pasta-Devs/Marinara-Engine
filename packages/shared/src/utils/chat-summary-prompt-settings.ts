import type { ChatSummaryPromptSettings, ChatSummaryPromptTemplate } from "../types/chat.js";

function normalizeTemplates(value: unknown): ChatSummaryPromptTemplate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const templates: ChatSummaryPromptTemplate[] = [];
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

export function normalizeChatSummaryPromptSettings(value: unknown): ChatSummaryPromptSettings {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { templates: [], activeTemplateId: null };
  }

  const record = parsed as Record<string, unknown>;
  const templates = normalizeTemplates(record.templates);
  const activeTemplateId =
    typeof record.activeTemplateId === "string" && record.activeTemplateId.trim()
      ? record.activeTemplateId.trim()
      : null;
  return {
    templates,
    activeTemplateId:
      activeTemplateId && templates.some((template) => template.id === activeTemplateId) ? activeTemplateId : null,
  };
}
