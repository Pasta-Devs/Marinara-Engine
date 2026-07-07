import type { ChatMessage } from "../llm/base-provider.js";

function findLastPromptMessageIndex(messages: ChatMessage[], role: ChatMessage["role"]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}

export function applyPromptPatchOperations(messages: ChatMessage[], data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const rawOperations = Array.isArray((data as Record<string, unknown>).operations)
    ? ((data as Record<string, unknown>).operations as unknown[])
    : [data];
  let applied = 0;

  for (const rawOperation of rawOperations.slice(0, 12)) {
    if (!rawOperation || typeof rawOperation !== "object") continue;
    const operation = rawOperation as Record<string, unknown>;
    const content = typeof operation.content === "string" ? operation.content.slice(0, 12_000) : "";
    if (!content.trim()) continue;
    const target = typeof operation.target === "string" ? operation.target : "last_user";
    const mode =
      operation.mode === "replace" || operation.mode === "prepend" || operation.mode === "append"
        ? operation.mode
        : "append";

    if (target === "append_system" || target === "prepend_system") {
      const message = { role: "system" as const, content };
      if (target === "prepend_system") messages.unshift(message);
      else messages.push(message);
      applied++;
      continue;
    }

    const index =
      target === "first_system"
        ? messages.findIndex((message) => message.role === "system")
        : target === "last_message"
          ? messages.length - 1
          : findLastPromptMessageIndex(messages, "user");
    if (index < 0 || !messages[index]) continue;

    const current = messages[index]!;
    const nextContent =
      mode === "replace"
        ? content
        : mode === "prepend"
          ? `${content}\n\n${current.content}`
          : `${current.content}\n\n${content}`;
    messages[index] = { ...current, content: nextContent };
    applied++;
  }

  return applied;
}
