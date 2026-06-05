import type { Chat } from "../../engine/contracts/types/chat";

export type ChatDisplaySource = {
  name: string;
  metadata?: Chat["metadata"] | string | Record<string, unknown> | null;
};

/** Safely parse characterIds that may be a JSON string, an array, or missing. */
export function normalizeChatCharacterIds(value: unknown): string[] {
  const parsed = (() => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value.trim() ? [value] : [];
    }
  })();

  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    : [];
}

const PLACEHOLDER_BRANCH_NAME = "New Branch";

export function parseChatMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function getChatDisplayName(chat: ChatDisplaySource | null | undefined): string {
  if (!chat) return "";
  const metadata = parseChatMetadata(chat.metadata);
  if (typeof metadata.branchName !== "string") return chat.name;

  const branchName = metadata.branchName.trim();
  return branchName || chat.name;
}

export function getConnectedChatDisplayName(chat: ChatDisplaySource | null | undefined): string {
  const displayName = getChatDisplayName(chat);
  return displayName === PLACEHOLDER_BRANCH_NAME ? (chat?.name ?? "") : displayName;
}
