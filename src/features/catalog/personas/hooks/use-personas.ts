import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { personaKeys } from "../query-keys";
import { personaApi } from "../../../../shared/api/persona-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { personaAvatarUrl, type PersonaAvatarSource } from "../lib/persona-avatar-url";
import { PERSONA_SUMMARY_FIELDS } from "../lib/persona-summary-fields";

export { personaKeys } from "../query-keys";

export type PersonaSummary = {
  id: string;
  name?: string;
  comment?: string | null;
  description?: string;
  personality?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
  tags?: string[];
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  avatarCrop?: unknown;
  isActive?: string | boolean;
  active?: string | boolean;
  createdAt?: string;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

const PERSONA_SUMMARY_OPTIONS = {
  fields: [...PERSONA_SUMMARY_FIELDS],
};

function personaIsActive(persona: PersonaSummary): boolean {
  return (
    persona.isActive === true || persona.isActive === "true" || persona.active === true || persona.active === "true"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePersonaAvatarFields<T>(persona: T): T {
  if (!isRecord(persona)) return persona;
  const avatarPath = personaAvatarUrl(persona as PersonaAvatarSource);
  const hasAvatarPath = Object.prototype.hasOwnProperty.call(persona, "avatarPath");
  const currentAvatarPath = persona.avatarPath as string | null | undefined;
  if (hasAvatarPath && currentAvatarPath === avatarPath) return persona;
  return { ...persona, avatarPath } as T;
}

async function listPersonas(): Promise<unknown[]> {
  const personas = await storageApi.list<unknown>("personas");
  return personas.map(normalizePersonaAvatarFields);
}

async function getPersona(id: string): Promise<unknown> {
  return normalizePersonaAvatarFields(await storageApi.get<unknown>("personas", id));
}

async function listPersonaSummaries(): Promise<PersonaSummary[]> {
  const personas = await storageApi.list<PersonaSummary>("personas", PERSONA_SUMMARY_OPTIONS);
  return personas.map(normalizePersonaAvatarFields);
}

export function usePersonas(enabled = true) {
  return useQuery({
    queryKey: personaKeys.list,
    queryFn: listPersonas,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersonaSummaries(enabled = true) {
  return useQuery({
    queryKey: personaKeys.summaries,
    queryFn: listPersonaSummaries,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersona(id: string | null, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id ?? ""),
    queryFn: () => getPersona(id!),
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useActivePersona(enabled = true) {
  return useQuery({
    queryKey: personaKeys.active,
    queryFn: async () => {
      const activePersona = (await listPersonaSummaries()).find(personaIsActive);
      return activePersona?.id ? getPersona(activePersona.id) : null;
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function invalidatePersonaCollectionQueries(queryClient: Pick<QueryClient, "invalidateQueries">): void {
  queryClient.invalidateQueries({ queryKey: personaKeys.list, exact: true });
  queryClient.invalidateQueries({ queryKey: personaKeys.summaries, exact: true });
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
      invalidatePersonaCollectionQueries(qc);
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
      const normalizedPersona = normalizePersonaAvatarFields(updatedPersona);
      qc.setQueryData(personaKeys.detail(variables.id), normalizedPersona);
      qc.setQueryData<unknown[] | undefined>(personaKeys.list, (old) => {
        if (!Array.isArray(old)) return old;
        const updatedId = (normalizedPersona as { id?: string } | null)?.id ?? variables.id;
        if (!updatedId) return old;

        return old.map((persona) => {
          const row = persona as Record<string, unknown> & { id?: string };
          if (row?.id !== updatedId) return persona;
          if (!normalizedPersona || typeof normalizedPersona !== "object") return persona;
          return { ...row, ...(normalizedPersona as Record<string, unknown>) };
        });
      });

      invalidatePersonaCollectionQueries(qc);
      qc.invalidateQueries({ queryKey: personaKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: personaKeys.summaryDetail(variables.id) });
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
      invalidatePersonaCollectionQueries(qc);
      qc.invalidateQueries({ queryKey: personaKeys.active });
    },
  });
}

export function useDuplicatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageCommandsApi.duplicate("personas", id),
    onSuccess: () => {
      invalidatePersonaCollectionQueries(qc);
    },
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personaApi.activate(id),
    onSuccess: () => {
      invalidatePersonaCollectionQueries(qc);
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
      invalidatePersonaCollectionQueries(qc);
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
