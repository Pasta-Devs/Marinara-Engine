import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { personaKeys } from "../query-keys";
import { personaApi } from "../../../../shared/api/persona-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";

export { personaKeys } from "../query-keys";

export type PersonaSummary = {
  id: string;
  name?: string;
  comment?: string | null;
  description?: string;
  tags?: string[];
  avatarPath?: string | null;
  avatarCrop?: unknown;
  isActive?: string | boolean;
  createdAt?: string;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

const PERSONA_SUMMARY_OPTIONS = {
  fields: [
    "id",
    "name",
    "comment",
    "description",
    "tags",
    "avatarPath",
    "avatarCrop",
    "isActive",
    "active",
    "createdAt",
    "nameColor",
    "dialogueColor",
    "boxColor",
  ],
};

export function usePersonas(enabled = true) {
  return useQuery({
    queryKey: personaKeys.list,
    queryFn: () => storageApi.list<unknown>("personas"),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersonaSummaries(enabled = true) {
  return useQuery({
    queryKey: personaKeys.summaries,
    queryFn: () => storageApi.list<PersonaSummary>("personas", PERSONA_SUMMARY_OPTIONS),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersona(id: string | null, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id ?? ""),
    queryFn: () => storageApi.get("personas", id!),
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useActivePersona(enabled = true) {
  return useQuery({
    queryKey: personaKeys.active,
    queryFn: async () => {
      const personas = await storageApi.list<PersonaSummary & { active?: string | boolean }>(
        "personas",
        PERSONA_SUMMARY_OPTIONS,
      );
      return (
        personas.find(
          (persona) =>
            persona.isActive === true ||
            persona.isActive === "true" ||
            persona.active === true ||
            persona.active === "true",
        ) ?? null
      );
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      comment?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      personaStats?: unknown;
      altDescriptions?: unknown[];
      tags?: string[];
      savedStatusOptions?: string[];
      avatarCrop?: unknown;
    }) => storageApi.create("personas", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
    },
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
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      tags?: string[];
      altDescriptions?: unknown[];
      savedStatusOptions?: string[];
      avatarCrop?: unknown;
      personaStats?: unknown;
    }) => storageApi.update("personas", id, data),
    onSuccess: (updatedPersona, variables) => {
      qc.setQueryData(personaKeys.detail(variables.id), updatedPersona);
      qc.setQueryData<unknown[] | undefined>(personaKeys.list, (old) => {
        if (!Array.isArray(old)) return old;
        const updatedId = (updatedPersona as { id?: string } | null)?.id ?? variables.id;
        if (!updatedId) return old;

        return old.map((persona) => {
          const row = persona as Record<string, unknown> & { id?: string };
          if (row?.id !== updatedId) return persona;
          if (!updatedPersona || typeof updatedPersona !== "object") return persona;
          return { ...row, ...(updatedPersona as Record<string, unknown>) };
        });
      });

      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
      qc.invalidateQueries({ queryKey: personaKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: personaKeys.active });
    },
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("personas", id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: personaKeys.detail(id) });
      qc.removeQueries({ queryKey: personaKeys.summaryDetail(id) });
      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
      qc.invalidateQueries({ queryKey: personaKeys.active });
    },
  });
}

export function useDuplicatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageCommandsApi.duplicate("personas", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
    },
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personaApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
      qc.invalidateQueries({ queryKey: personaKeys.active });
    },
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      personaApi.uploadAvatar(id, avatar, filename),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: personaKeys.list });
      qc.invalidateQueries({ queryKey: personaKeys.summaries });
      qc.invalidateQueries({ queryKey: personaKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: personaKeys.summaryDetail(variables.id) });
      qc.invalidateQueries({ queryKey: personaKeys.active });
    },
  });
}

export function usePersonaGroups(enabled = true) {
  return useQuery({
    queryKey: personaKeys.groups,
    queryFn: () => storageApi.list<unknown>("persona-groups"),
    enabled,
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
