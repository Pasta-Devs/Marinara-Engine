import type { ListChatMemoriesOptions } from "../../engine/capabilities/storage";
import { invokeTauri } from "./tauri-client";

function memoryListArgs(chatId: string | null, options?: ListChatMemoriesOptions): Record<string, unknown> {
  const args: Record<string, unknown> = { chatId };
  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    args.limit = Math.max(0, Math.trunc(options.limit));
  }
  if (options?.order) args.order = options.order;
  const excludeRecentMessageIds = Array.from(
    new Set(
      (options?.excludeRecentMessageIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  );
  if (excludeRecentMessageIds.length > 0) args.excludeRecentMessageIds = excludeRecentMessageIds;
  const excludeRecentStartAt =
    typeof options?.excludeRecentStartAt === "string" ? options.excludeRecentStartAt.trim() : "";
  if (excludeRecentStartAt) args.excludeRecentStartAt = excludeRecentStartAt;
  return args;
}

export interface ChatGroupDeleteResult {
  deleted: number;
  deletedChatIds?: string[];
}

export const chatCommandApi = {
  messageCount: (chatId: string | null) => invokeTauri<{ count: number }>("chat_message_count", { chatId }),
  memoriesList: <T = unknown>(chatId: string | null, options?: ListChatMemoriesOptions) =>
    invokeTauri<T>("chat_memories_list", memoryListArgs(chatId, options)),
  memoryDelete: (chatId: string | null, memoryId: string) => invokeTauri("chat_memory_delete", { chatId, memoryId }),
  memoriesClear: (chatId: string | null) => invokeTauri("chat_memories_clear", { chatId }),
  memoriesRefresh: <T = unknown>(chatId: string | null) => invokeTauri<T>("chat_memories_refresh", { chatId }),
  memoriesExport: <T = unknown>(chatId: string) => invokeTauri<T>("chat_memories_export", { chatId }),
  memoriesImport: <T = unknown>(chatId: string, body: unknown) =>
    invokeTauri<T>("chat_memories_import", { chatId, body }),
  notesList: <T = unknown>(chatId: string | null) => invokeTauri<T>("chat_notes_list", { chatId }),
  noteDelete: (chatId: string | null, noteId: string) => invokeTauri("chat_note_delete", { chatId, noteId }),
  notesClear: (chatId: string | null) => invokeTauri("chat_notes_clear", { chatId }),
  groupDelete: (groupId: string) => invokeTauri<ChatGroupDeleteResult>("chat_group_delete", { groupId }),
  markAutonomousUnread: <T = unknown>(chatId: string, body: { characterId?: string | null; count?: number | null }) =>
    invokeTauri<T>("chat_autonomous_unread_mark", { chatId, body }),
  clearAutonomousUnread: <T = unknown>(chatId: string) => invokeTauri<T>("chat_autonomous_unread_clear", { chatId }),
  bulkDeleteMessages: (chatId: string | null, messageIds: string[]) =>
    invokeTauri("chat_messages_bulk_delete", { chatId, messageIds }),
  branch: <T = unknown>(chatId: string, upToMessageId?: string | null) =>
    invokeTauri<T>("chat_branch", { chatId, upToMessageId: upToMessageId ?? null }),
  swipes: <T = unknown>(chatId: string | null, messageId: string | null) =>
    invokeTauri<T>("chat_message_swipes", { chatId, messageId }),
  setActiveSwipe: <T = unknown>(chatId: string | null, messageId: string, index: number) =>
    invokeTauri<T>("chat_message_set_active_swipe", { chatId, messageId, index }),
  deleteSwipe: <T = unknown>(chatId: string | null, messageId: string, index: number) =>
    invokeTauri<T>("chat_message_delete_swipe", { chatId, messageId, index: String(index) }),
  connect: <T = unknown>(chatId: string, targetChatId: string) =>
    invokeTauri<T>("chat_connect", { chatId, targetChatId }),
  disconnect: <T = unknown>(chatId: string) => invokeTauri<T>("chat_disconnect", { chatId }),
};
