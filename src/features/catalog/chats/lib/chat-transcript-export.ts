import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import type { StoredZipFile } from "../../../../shared/lib/zip";

export type ChatTranscriptExportFormat = "jsonl" | "text";
export type BulkChatExportFormat = ChatTranscriptExportFormat | "native";

type ChatTranscriptFormatRow = {
  format: "marinara-chat-transcript-jsonl";
  version: 1;
  rowType: "format";
};

type ChatTranscriptHeaderRow = {
  rowType: "header";
  user_name: string;
  character_name: string;
  create_date: string;
  chat_metadata: {
    chatId: string;
    chatName: string;
    mode: Chat["mode"];
    groupId: string | null;
    characterIds: string[];
    personaId: string | null;
    connectionId: string | null;
    promptPresetId: string | null;
    branchName: string | null;
  };
};

type ChatTranscriptMessageRow = {
  rowType: "message";
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  send_date: string;
  characterId?: string | null;
  role?: Message["role"];
};

type ChatTranscriptJsonlRow = ChatTranscriptFormatRow | ChatTranscriptHeaderRow | ChatTranscriptMessageRow;

function getChatNameForExport(chat: Chat) {
  const metadata = chat.metadata;
  if (metadata && typeof metadata === "object" && "branchName" in metadata) {
    const branchName = (metadata as { branchName?: unknown }).branchName;
    if (typeof branchName === "string" && branchName.trim()) return branchName.trim();
  }
  return typeof chat.name === "string" ? chat.name.trim() : "";
}

function getBranchName(chat: Chat): string | null {
  const metadata = chat.metadata;
  if (metadata && typeof metadata === "object" && "branchName" in metadata) {
    const branchName = (metadata as { branchName?: unknown }).branchName;
    if (typeof branchName === "string" && branchName.trim()) return branchName.trim();
  }
  return null;
}

function speakerNameForMessage(message: Message): string {
  if (message.role === "user") {
    return message.extra?.personaSnapshot?.name?.trim() || "You";
  }
  if (message.role === "system") return "System";
  if (message.role === "narrator") return "Narrator";
  return message.characterId?.trim() || "Assistant";
}

export function chatExportFilename(chat: Chat, format: ChatTranscriptExportFormat) {
  const ext = format === "text" ? ".txt" : ".jsonl";
  const sourceName = getChatNameForExport(chat) || chat.id;
  const safeName = sourceName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safeName || `chat-${chat.id}`}${ext}`;
}

function chatTranscriptHeaderRow(chat: Chat): ChatTranscriptHeaderRow {
  const branchName = getBranchName(chat);
  return {
    rowType: "header",
    user_name: "You",
    character_name: getChatNameForExport(chat) || chat.name || "Assistant",
    create_date: chat.createdAt,
    chat_metadata: {
      chatId: chat.id,
      chatName: chat.name,
      mode: chat.mode,
      groupId: chat.groupId,
      characterIds: chat.characterIds,
      personaId: chat.personaId,
      connectionId: chat.connectionId,
      promptPresetId: chat.promptPresetId,
      branchName,
    },
  };
}

function chatTranscriptMessageRow(message: Message): ChatTranscriptMessageRow {
  return {
    rowType: "message",
    name: speakerNameForMessage(message),
    is_user: message.role === "user",
    is_system: message.role === "system",
    mes: message.content ?? "",
    send_date: message.createdAt,
    characterId: message.characterId,
    role: message.role,
  };
}

export function formatChatText(chat: Chat, messages: Message[]) {
  const title = getChatNameForExport(chat) || chat.name || chat.id;
  const header = [
    `Chat: ${title}`,
    `Mode: ${chat.mode}`,
    `Created: ${chat.createdAt}`,
    `Updated: ${chat.updatedAt}`,
    chat.groupId ? `Group: ${chat.groupId}` : null,
    getBranchName(chat) ? `Branch: ${getBranchName(chat)}` : null,
  ].filter(Boolean);

  const body = messages.map((message) => {
    const timestamp = message.createdAt ? ` [${message.createdAt}]` : "";
    return `${speakerNameForMessage(message)}${timestamp}\n${message.content ?? ""}`;
  });

  return [...header, "", ...body].join("\n\n");
}

export function formatChatJsonl(messages: Message[]) {
  const jsonl = messages.map((message) => JSON.stringify(message)).join("\n");
  return jsonl ? `${jsonl}\n` : "";
}

function formatChatTranscriptJsonl(chat: Chat, messages: Message[]) {
  const rows: ChatTranscriptJsonlRow[] = [
    { format: "marinara-chat-transcript-jsonl", version: 1, rowType: "format" },
    chatTranscriptHeaderRow(chat),
    ...messages.map(chatTranscriptMessageRow),
  ];
  const jsonl = rows.map((row) => JSON.stringify(row)).join("\n");
  return jsonl ? `${jsonl}\n` : "";
}

function chatTranscriptManifest(chats: Array<{ chat: Chat; messages: Message[] }>) {
  return {
    format: "marinara-chat-transcripts",
    version: 1,
    chats: chats.map(({ chat, messages }) => ({
      id: chat.id,
      name: chat.name,
      mode: chat.mode,
      groupId: chat.groupId,
      branchName: getBranchName(chat),
      characterIds: chat.characterIds,
      personaId: chat.personaId,
      connectionId: chat.connectionId,
      promptPresetId: chat.promptPresetId,
      messageCount: messages.length,
    })),
  };
}

export function buildChatTranscriptZipFiles(
  chats: Array<{ chat: Chat; messages: Message[] }>,
  format: ChatTranscriptExportFormat,
): StoredZipFile[] {
  return [
    {
      name: "manifest.json",
      data: JSON.stringify(chatTranscriptManifest(chats), null, 2),
    },
    ...chats.map(({ chat, messages }) => ({
      name: chatExportFilename(chat, format),
      data: format === "text" ? formatChatText(chat, messages) : formatChatTranscriptJsonl(chat, messages),
    })),
  ];
}
