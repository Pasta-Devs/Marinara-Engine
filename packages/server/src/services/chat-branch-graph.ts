// ──────────────────────────────────────────────
// Branch graph: where each chat in a group forked, and the shape of its own messages
//
// Branches copy their history up to the fork, so the graph only needs each chat's own part.
// Roles go over the wire for every message; text only for the fork and the latest message.
// ──────────────────────────────────────────────
import type { ChatBranchGraphEntry, ChatBranchGraphMessage, MessageRole } from "@marinara-engine/shared";
import type { createChatsStorage } from "./storage/chats.storage.js";

type BranchGraphStorage = Pick<ReturnType<typeof createChatsStorage>, "listMessageOutlines" | "getMessageContents">;
type MessageOutline = Awaited<ReturnType<BranchGraphStorage["listMessageOutlines"]>>[number];

const SNIPPET_LENGTH = 80;
const ROLE_CODES: Record<MessageRole, string> = { user: "u", assistant: "a", system: "s", narrator: "n" };

export function toBranchGraphSnippet(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH - 1).trimEnd()}…` : flat;
}

function readId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** `chats` carry parsed metadata; the result keeps their order. */
export async function readChatBranchGraph(
  storage: BranchGraphStorage,
  chats: Array<{ id: string; metadata: Record<string, unknown> }>,
): Promise<ChatBranchGraphEntry[]> {
  const byChat = new Map<string, MessageOutline[]>();
  for (const row of await storage.listMessageOutlines(chats.map((chat) => chat.id))) {
    const rows = byChat.get(row.chatId);
    if (rows) rows.push(row);
    else byChat.set(row.chatId, [row]);
  }
  const indexIn = (chatId: string, messageId: string) => {
    const index = byChat.get(chatId)?.findIndex((row) => row.id === messageId) ?? -1;
    return index >= 0 ? index : null;
  };

  const shapes = chats.map((chat) => {
    const rows = byChat.get(chat.id) ?? [];
    const parentChatId = readId(chat.metadata.branchParentChatId);
    const parentMessageId = readId(chat.metadata.branchParentMessageId);
    const branchMessageId = readId(chat.metadata.branchMessageId);
    // A branch of an empty chat records its parent and no fork message: it forked before message 0.
    const forkedEmpty = !!parentChatId && !parentMessageId && !branchMessageId;
    const forkIndex = forkedEmpty ? -1 : parentChatId && branchMessageId ? indexIn(chat.id, branchMessageId) : null;
    const parentForkIndex = forkedEmpty
      ? -1
      : parentChatId && parentMessageId
        ? indexIn(parentChatId, parentMessageId)
        : null;
    const own = rows.slice(forkIndex === null ? 0 : forkIndex + 1);
    return {
      chatId: chat.id,
      forkIndex,
      parentForkIndex,
      messageCount: rows.length,
      roles: own.map((row) => ROLE_CODES[row.role] ?? "s").join(""),
      fork: forkIndex !== null && forkIndex >= 0 ? { row: rows[forkIndex]!, index: forkIndex } : null,
      tip: rows.length > 0 ? { row: rows[rows.length - 1]!, index: rows.length - 1 } : null,
    };
  });

  const labelIds = new Set<string>();
  for (const shape of shapes) {
    if (shape.fork) labelIds.add(shape.fork.row.id);
    if (shape.tip) labelIds.add(shape.tip.row.id);
  }
  const contents = await storage.getMessageContents([...labelIds]);
  const label = (point: { row: MessageOutline; index: number } | null): ChatBranchGraphMessage | null =>
    point && {
      messageId: point.row.id,
      index: point.index,
      role: point.row.role,
      characterId: point.row.characterId ?? null,
      snippet: toBranchGraphSnippet(contents.get(point.row.id) ?? ""),
    };
  return shapes.map(({ fork, tip, ...shape }) => ({ ...shape, fork: label(fork), tip: label(tip) }));
}
