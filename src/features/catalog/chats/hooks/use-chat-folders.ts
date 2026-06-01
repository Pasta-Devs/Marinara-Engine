// ──────────────────────────────────────────────
// React Query: Chat Folder hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storageApi } from "../../../../shared/api/storage-api";
import type { ChatFolder } from "../../../../engine/contracts/types/chat";
import { chatKeys } from "../query-keys";

const folderKeys = {
  all: ["chat-folders"] as const,
  list: () => [...folderKeys.all, "list"] as const,
};

export function useChatFolders() {
  return useQuery({
    queryKey: folderKeys.list(),
    queryFn: () => storageApi.list<ChatFolder>("chat-folders"),
    staleTime: 2 * 60_000,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mode: string; color?: string }) =>
      storageApi.create<ChatFolder>("chat-folders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list() }),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      color?: string;
      sortOrder?: number;
      collapsed?: boolean;
    }) => storageApi.update<ChatFolder>("chat-folders", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list() }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("chat-folders", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: folderKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useReorderFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) => storageApi.update("chat-folders", id, { sortOrder: index, order: index })),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list() }),
  });
}

export function useMoveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatId: string; folderId: string | null }) =>
      storageApi.update("chats", data.chatId, { folderId: data.folderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}
