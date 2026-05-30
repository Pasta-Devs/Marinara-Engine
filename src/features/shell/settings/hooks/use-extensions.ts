// ──────────────────────────────────────────────
// Hooks: Installed Extensions
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  createExtensionSchema,
  updateExtensionSchema,
  type CreateExtensionInput,
  type UpdateExtensionInput,
} from "../../../../engine/contracts/schemas/extension.schema";
import type { InstalledExtension } from "../../../../engine/contracts/types/extension";

const extensionKeys = {
  all: ["extensions"] as const,
  list: () => [...extensionKeys.all, "list"] as const,
};

export function useExtensions() {
  return useQuery({
    queryKey: extensionKeys.list(),
    queryFn: () => storageApi.list<InstalledExtension>("extensions"),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: () => (document.hidden ? false : 15_000),
  });
}

export function useCreateExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExtensionInput) =>
      storageApi.create<InstalledExtension>("extensions", createExtensionSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: extensionKeys.all });
    },
  });
}

export function useUpdateExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateExtensionInput) =>
      storageApi.update<InstalledExtension>("extensions", id, updateExtensionSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: extensionKeys.all });
    },
  });
}

export function useDeleteExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("extensions", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: extensionKeys.all });
    },
  });
}
