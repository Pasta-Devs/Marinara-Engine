import type { LorebookScope } from "@marinara-engine/shared";

export const DEFAULT_LOREBOOK_SCOPE: LorebookScope = { mode: "all", chatIds: [] };

export function normalizeLorebookScope(value: unknown): LorebookScope {
  if (!value || typeof value !== "object") return DEFAULT_LOREBOOK_SCOPE;
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === "disabled" || raw.mode === "specific" ? raw.mode : "all";
  const chatIds = Array.isArray(raw.chatIds)
    ? Array.from(
        new Set(
          raw.chatIds
            .map((id) => (typeof id === "string" ? id.trim() : ""))
            .filter((id): id is string => id.length > 0),
        ),
      )
    : [];
  return { mode, chatIds };
}

export function isLorebookScopeActiveForChat(value: unknown, chatId: string): boolean {
  const scope = normalizeLorebookScope(value);
  if (scope.mode === "disabled") return false;
  if (scope.mode === "specific") return scope.chatIds.includes(chatId);
  return true;
}
