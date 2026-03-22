// ──────────────────────────────────────────────
// React Query: Character, Group & Persona hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
  personas: ["personas"] as const,
  groups: ["character-groups"] as const,
  groupDetail: (id: string) => ["character-groups", "detail", id] as const,
};

// ── Characters ──

export function useCharacters() {
  return useQuery({
    queryKey: characterKeys.list(),
    queryFn: () => api.get<unknown[]>("/characters"),
    staleTime: 5 * 60_000,
  });
}

export function useCharacter(id: string | null) {
  return useQuery({
    queryKey: characterKeys.detail(id ?? ""),
    queryFn: () => api.get(`/characters/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/characters", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.list() }),
  });
}

export function useUpdateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; data?: Record<string, unknown>; avatarPath?: string }) =>
      api.patch(`/characters/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar }: { id: string; avatar: string }) => api.post(`/characters/${id}/avatar`, { avatar }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.list() }),
  });
}

// ── Character Sprites ──

export interface SpriteInfo {
  expression: string;
  filename: string;
  url: string;
}

export const spriteKeys = {
  list: (characterId: string) => ["sprites", characterId] as const,
};

export function useCharacterSprites(characterId: string | null) {
  return useQuery({
    queryKey: spriteKeys.list(characterId ?? ""),
    queryFn: () => api.get<SpriteInfo[]>(`/sprites/${characterId}`),
    enabled: !!characterId,
  });
}

export function useUploadSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression, image }: { characterId: string; expression: string; image: string }) =>
      api.post<SpriteInfo>(`/sprites/${characterId}`, { expression, image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useDeleteSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression }: { characterId: string; expression: string }) =>
      api.delete(`/sprites/${characterId}/${expression}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

// ── Personas ──

export function usePersonas() {
  return useQuery({
    queryKey: characterKeys.personas,
    queryFn: () => api.get<unknown[]>("/characters/personas/list"),
    staleTime: 5 * 60_000,
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
    }) => api.post("/characters/personas", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
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
      description?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      personaStats?: string;
      altDescriptions?: string;
    }) => api.patch(`/characters/personas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/personas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/characters/personas/${id}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      api.post(`/characters/personas/${id}/avatar`, { avatar, filename }),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

// ── Character Groups ──

export function useCharacterGroups() {
  return useQuery({
    queryKey: characterKeys.groups,
    queryFn: () => api.get<unknown[]>("/characters/groups/list"),
  });
}

export function useCharacterGroup(id: string | null) {
  return useQuery({
    queryKey: characterKeys.groupDetail(id ?? ""),
    queryFn: () => api.get(`/characters/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; characterIds?: string[] }) =>
      api.post("/characters/groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; characterIds?: string[] }) =>
      api.patch(`/characters/groups/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}
