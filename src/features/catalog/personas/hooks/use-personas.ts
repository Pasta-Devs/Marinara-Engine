import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { personaKeys } from "../query-keys";
import { storageApi } from "../../../../shared/api/storage-api";
import { invokeTauri } from "../../../../shared/api/tauri-client";

export { personaKeys } from "../query-keys";


export function usePersonas() {
  return useQuery({
    queryKey: personaKeys.list,
    queryFn: () => storageApi.list<unknown>("personas"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      comment?: string;
      description?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      tags?: string[];
      altDescriptions?: unknown[];
      savedStatusOptions?: string[];
      avatarCrop?: unknown;
      personaStats?: unknown;
    }) => storageApi.update("personas", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.list }),
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("personas", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.list }),
  });
}

export function useDuplicatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri("storage_duplicate", { entity: "personas", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.list }),
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri("persona_activate", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.list }),
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      invokeTauri("persona_avatar_upload", { id, body: { avatar, filename } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.list }),
  });
}

export function usePersonaGroups() {
  return useQuery({
    queryKey: personaKeys.groups,
    queryFn: () => storageApi.list<unknown>("persona-groups"),
  });
}

export function useCreatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; personaIds?: string[] }) =>
      storageApi.create("persona-groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.groups }),
  });
}

export function useUpdatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; personaIds?: string[] }) =>
      storageApi.update("persona-groups", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.groups }),
  });
}

export function useDeletePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("persona-groups", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.groups }),
  });
}
