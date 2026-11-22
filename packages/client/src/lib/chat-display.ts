import type { Chat } from "@marinara-engine/shared";
import { translate } from "../localization/i18n";
import { queryClient } from "./query-client";

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

/**
 * A branch nobody named is stored as "New Branch" (upstream), so every branch read the same (QC panel 2, D10). It
 * shows as "<chat name> · branch N" instead: N is its place among the chat's branches by creation, the original
 * being 1. The position comes from the loaded chat list; without it the number is left out.
 */
function placeholderBranchLabel(chat: ChatDisplaySource): string {
  const source = chat as ChatDisplaySource & { id?: string; groupId?: string | null };
  let n: number | null = null;
  if (source.id && source.groupId) {
    const chats = queryClient.getQueryData<Array<{ id: string; groupId?: string | null; createdAt?: string }>>([
      "chats",
      "list",
    ]);
    const group = (chats ?? [])
      .filter((candidate) => candidate.groupId === source.groupId)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const index = group.findIndex((candidate) => candidate.id === source.id);
    if (index >= 0) n = index + 1;
  }
  return n === null
    ? translate("chat.branch.autoNameNoNumber", { name: chat.name })
    : translate("chat.branch.autoName", { name: chat.name, n });
}

export function getChatDisplayName(chat: ChatDisplaySource | null | undefined): string {
  if (!chat) return "";
  const metadata = parseChatMetadata(chat.metadata);
  if (typeof metadata.branchName !== "string") return chat.name;

  const branchName = metadata.branchName.trim();
  if (branchName === PLACEHOLDER_BRANCH_NAME) return placeholderBranchLabel(chat);
  return branchName || chat.name;
}

export function getConnectedChatDisplayName(chat: ChatDisplaySource | null | undefined): string {
  if (!chat) return "";
  const metadata = parseChatMetadata(chat.metadata);
  if (typeof metadata.branchName === "string" && metadata.branchName.trim() === PLACEHOLDER_BRANCH_NAME) {
    return chat.name;
  }
  return getChatDisplayName(chat);
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
