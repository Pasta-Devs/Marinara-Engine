import type { QueryClient } from "@tanstack/react-query";

import type { Chat } from "../../../../engine/contracts/types/chat";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { chatKeys } from "../query-keys";

export type ChatCacheRecord = Record<string, unknown> & { id?: string; metadata?: unknown };

function parseCacheRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function updateCachedChatRows<T extends ChatCacheRecord>(
  rows: T[] | undefined,
  id: string,
  updater: (row: T) => T,
): T[] | undefined {
  if (!Array.isArray(rows)) return rows;
  let changed = false;
  const next = rows.map((row) => {
    if (!row || row.id !== id) return row;
    changed = true;
    return updater(row);
  });
  return changed ? next : rows;
}

export function applyChatFieldPatch<T extends ChatCacheRecord>(chat: T, patch: Record<string, unknown>): T {
  return { ...chat, ...patch };
}

export function applyChatMetadataPatch<T extends ChatCacheRecord>(chat: T, patch: Record<string, unknown>): T {
  return {
    ...chat,
    metadata: {
      ...parseCacheRecord(chat.metadata),
      ...patch,
    },
  };
}

export function setChatCacheRecord(
  qc: Pick<QueryClient, "setQueryData" | "setQueriesData">,
  id: string,
  updater: (chat: ChatCacheRecord) => ChatCacheRecord,
) {
  qc.setQueryData<ChatCacheRecord | undefined>(chatKeys.detail(id), (current) =>
    current ? updater(current) : current,
  );
  qc.setQueriesData<ChatCacheRecord[]>({ queryKey: chatKeys.list() }, (rows) =>
    updateCachedChatRows(rows, id, updater),
  );
  qc.setQueriesData<ChatCacheRecord[]>({ queryKey: [...chatKeys.all, "group"] }, (rows) =>
    updateCachedChatRows(rows, id, updater),
  );

  const activeChat = useChatStore.getState().activeChat as ChatCacheRecord | null;
  if (activeChat?.id === id) {
    useChatStore.getState().setActiveChat(updater(activeChat) as unknown as Chat);
  }
}

export function cancelChatCacheQueries(qc: QueryClient, id: string) {
  // Tauri-backed reads are not abortable, so awaiting broad cache cancellation
  // can make optimistic chat-setting toggles wait behind large startup loads.
  void qc.cancelQueries({ queryKey: chatKeys.detail(id) }).catch(() => undefined);
  void qc.cancelQueries({ queryKey: chatKeys.list() }).catch(() => undefined);
  void qc.cancelQueries({ queryKey: [...chatKeys.all, "group"] }).catch(() => undefined);
}
