import { invokeTauri } from "./tauri-client";

export interface ChatGroupDeleteResult {
  deleted: number;
  deletedChatIds?: string[];
}

export const chatCommandApi = {
  messageCount: (chatId: string | null) => invokeTauri<{ count: number }>("chat_message_count", { chatId }),
  memoriesList: <T = unknown>(chatId: string | null) => invokeTauri<T>("chat_memories_list", { chatId }),
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
