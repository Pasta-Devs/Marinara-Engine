// ──────────────────────────────────────────────
// React Query: Connection Folder hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateConnectionSchema } from "../../../../engine/contracts/schemas/connection.schema";
import { connectionCommandApi } from "../../../../shared/api/connection-command-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { ConnectionFolder } from "../../../../engine/contracts/types/connection";
import { connectionKeys } from "./use-connections";

const connectionFolderKeys = {
  all: ["connection-folders"] as const,
  list: () => [...connectionFolderKeys.all, "list"] as const,
};

export function useConnectionFolders() {
  return useQuery({
    queryKey: connectionFolderKeys.list(),
    queryFn: () => storageApi.list<ConnectionFolder>("connection-folders"),
    staleTime: 2 * 60_000,
  });
}

export function useCreateConnectionFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      storageApi.create<ConnectionFolder>("connection-folders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionFolderKeys.list() }),
  });
}

export function useUpdateConnectionFolder() {
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
    }) => storageApi.update<ConnectionFolder>("connection-folders", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionFolderKeys.list() }),
  });
}

export function useDeleteConnectionFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("connection-folders", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionFolderKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useReorderConnectionFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => connectionCommandApi.reorderFolders<ConnectionFolder[]>(orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionFolderKeys.list() }),
  });
}

export function useMoveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { connectionId: string; folderId: string | null }) =>
      connectionCommandApi.move(
        data.connectionId,
        updateConnectionSchema.parse({ folderId: data.folderId }).folderId ?? null,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}
