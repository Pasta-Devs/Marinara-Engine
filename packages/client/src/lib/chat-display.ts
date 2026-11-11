import type { Chat } from "@marinara-engine/shared";

export type ChatDisplaySource = {
  name: string;
  metadata?: Chat["metadata"] | string | Record<string, unknown> | null;
};

const PLACEHOLDER_BRANCH_NAME = "New Branch";

export function parseChatMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
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

// "pancatfan - 2025-11-25@19h22m33s" (SillyTavern's chat file name, kept on import) or a plain trailing
// " - 2025-11-25" / "2025-11-25 @19h 22m 33s 123ms". Tabs show only the chat's own name.
const TRAILING_CHAT_DATE =
  /\s*(?:[-–—|·,]\s*)?\(?\d{4}-\d{1,2}-\d{1,2}(?:\s*@?\s*\d{1,2}(?:h\s*\d{1,2}m(?:\s*\d{1,2}s)?(?:\s*\d{1,3}ms)?|:\d{2}(?::\d{2})?))?\)?\s*$/u;

/** A chat's name without a date stamp on its end; the name as is when nothing else would be left. */
export function stripChatDateSuffix(name: string): string {
  const stripped = name.replace(TRAILING_CHAT_DATE, "").trim();
  return stripped || name;
}
