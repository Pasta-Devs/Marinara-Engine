import type { ChatMessage } from "../llm/base-provider.js";

export function resolveCustomWritableLorebookIds(settings: Record<string, unknown>): string[] | null {
  const ids: string[] = [];
  for (const key of ["writableLorebookId", "targetLorebookId"]) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) ids.push(value.trim());
  }
  const arrayValue = settings.writableLorebookIds;
  if (Array.isArray(arrayValue)) {
    for (const value of arrayValue) {
      if (typeof value === "string" && value.trim()) ids.push(value.trim());
    }
  }
  return ids.length > 0 ? Array.from(new Set(ids)) : null;
}

export function promptPreviewForAgents(messages: ChatMessage[]): string {
  const preview = messages
    .map((message, index) => {
      const content = String(message.content ?? "").slice(0, 3000);
      return `<message index="${index}" role="${message.role}">\n${content}\n</message>`;
    })
    .join("\n\n");
  return preview.slice(0, 24_000);
}
