// ──────────────────────────────────────────────
// React Query: Connection Folder hooks — the user's own folders for Models, shown when the Connections list and
// quick picker group by folder. A Model sits in one folder (its `folderId`) or in none.
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ConnectionFolder,
  CreateConnectionFolderInput,
  MoveConnectionToFolderInput,
  UpdateFolderInput,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { connectionKeys } from "./use-connections";

export const connectionFolderKeys = {
  all: ["connection-folders"] as const,
  list: () => [...connectionFolderKeys.all, "list"] as const,
};

export function useConnectionFolders() {
  return useQuery({
    queryKey: connectionFolderKeys.list(),
    queryFn: () => api.get<ConnectionFolder[]>("/connection-folders"),
    staleTime: 2 * 60_000,
  });
}

export function useCreateConnectionFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConnectionFolderInput) => api.post<ConnectionFolder>("/connection-folders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionFolderKeys.list() }),
  });
}

export function useUpdateConnectionFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateFolderInput & { id: string }) =>
      api.patch<ConnectionFolder>(`/connection-folders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionFolderKeys.list() }),
  });
}

/** The server moves the folder's Models out (no folder) before it deletes the folder. */
export function useDeleteConnectionFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/connection-folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionFolderKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useMoveConnectionToFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MoveConnectionToFolderInput) => api.post("/connection-folders/move-connection", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}
