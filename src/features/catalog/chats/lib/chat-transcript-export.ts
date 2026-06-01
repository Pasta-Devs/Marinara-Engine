import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import type { StoredZipFile } from "../../../../shared/lib/zip";

export type ChatTranscriptExportFormat = "jsonl" | "text";
export type BulkChatExportFormat = ChatTranscriptExportFormat | "native";

function getChatNameForExport(chat: Chat) {
  const metadata = chat.metadata;
  if (metadata && typeof metadata === "object" && "branchName" in metadata) {
    const branchName = (metadata as { branchName?: unknown }).branchName;
    if (typeof branchName === "string" && branchName.trim()) return branchName.trim();
  }
  return typeof chat.name === "string" ? chat.name.trim() : "";
}

export function chatExportFilename(chat: Chat, format: ChatTranscriptExportFormat) {
  const ext = format === "text" ? ".txt" : ".jsonl";
  const sourceName = getChatNameForExport(chat) || chat.id;
  const safeName = sourceName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safeName || `chat-${chat.id}`}${ext}`;
}

export function formatChatText(messages: Message[]) {
  return messages
    .map((message) => {
      const role = message.role ? `${message.role}: ` : "";
      return `${role}${message.content ?? ""}`;
    })
    .join("\n\n");
}

export function formatChatJsonl(messages: Message[]) {
  const jsonl = messages.map((message) => JSON.stringify(message)).join("\n");
  return jsonl ? `${jsonl}\n` : "";
}

export function buildChatTranscriptZipFiles(
  chats: Array<{ chat: Chat; messages: Message[] }>,
  format: ChatTranscriptExportFormat,
): StoredZipFile[] {
  return chats.map(({ chat, messages }) => ({
    name: chatExportFilename(chat, format),
    data: format === "text" ? formatChatText(messages) : formatChatJsonl(messages),
  }));
}
