// ──────────────────────────────────────────────
// React Query: Preset, Group, Section & Choice hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { libraryFolderKeys } from "./use-library-folders";
import type { PromptPreset, PromptGroup, PromptSection, ChoiceBlock } from "@marinara-engine/shared";

// ── Query Keys ──

export const presetKeys = {
  all: ["presets"] as const,
  list: () => [...presetKeys.all, "list"] as const,
  detail: (id: string) => [...presetKeys.all, "detail", id] as const,
  full: (id: string) => [...presetKeys.all, "full", id] as const,
  sections: (presetId: string) => [...presetKeys.all, "sections", presetId] as const,
  groups: (presetId: string) => [...presetKeys.all, "groups", presetId] as const,
  choiceBlocks: (presetId: string) => [...presetKeys.all, "choices", presetId] as const,
  sectionChoice: (sectionId: string) => [...presetKeys.all, "section-choice", sectionId] as const,
  default: () => [...presetKeys.all, "default"] as const,
};

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const pendingPresetDuplicates = new Map<string, Promise<PromptPreset>>();

export function duplicatePresetOnce(id: string): Promise<PromptPreset> {
  const pending = pendingPresetDuplicates.get(id);
  if (pending) return pending;

  const request = api.post<PromptPreset>(`/prompts/${id}/duplicate`);
  pendingPresetDuplicates.set(id, request);
  void request.then(
    () => pendingPresetDuplicates.delete(id),
    () => pendingPresetDuplicates.delete(id),
  );
  return request;
}

// ═══════════════════════════════════════════════
//  Presets
// ═══════════════════════════════════════════════

export function usePresets() {
  return useQuery({
    queryKey: presetKeys.list(),
    queryFn: () => api.get<PromptPreset[]>("/prompts"),
    staleTime: 5 * 60_000,
  });
}

/** Fetch preset + all sections, groups, choice blocks in one call. */
export function usePresetFull(id: string | null) {
  return useQuery({
    queryKey: presetKeys.full(id ?? ""),
    queryFn: () =>
      api.get<{
        preset: PromptPreset;
        sections: PromptSection[];
        groups: PromptGroup[];
        choiceBlocks: ChoiceBlock[];
      }>(`/prompts/${id}/full`),
    enabled: !!id,
    staleTime: 5 * 60_000,
    refetchOnMount: "always",
  });
}

export function useDefaultPreset() {
  return useQuery({
    queryKey: presetKeys.default(),
    queryFn: () => api.get<PromptPreset | null>("/prompts/default"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<PromptPreset>(`/prompts/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
      qc.invalidateQueries({ queryKey: presetKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.id) });
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, "Failed to update preset."));
    },
  });
}

export function useUploadPresetImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image }: { id: string; image: string }) =>
      api.post<PromptPreset>(`/prompts/${id}/image`, { image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
      qc.invalidateQueries({ queryKey: presetKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.id) });
      qc.invalidateQueries({ queryKey: presetKeys.default() });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/prompts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presetKeys.all });
      qc.invalidateQueries({ queryKey: libraryFolderKeys.list("presets") });
    },
  });
}

export function useDuplicatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicatePresetOnce,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
    },
  });
}

export function useSetDefaultPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<PromptPreset>(`/prompts/${id}/set-default`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
      qc.invalidateQueries({ queryKey: presetKeys.default() });
    },
  });
}

// ═══════════════════════════════════════════════
//  Groups
// ═══════════════════════════════════════════════

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, ...data }: { presetId: string } & Record<string, unknown>) =>
      api.post<PromptGroup>(`/prompts/${presetId}/groups`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.groups(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, groupId, ...data }: { presetId: string; groupId: string } & Record<string, unknown>) =>
      api.patch<PromptGroup>(`/prompts/${presetId}/groups/${groupId}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.groups(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, groupId }: { presetId: string; groupId: string }) =>
      api.delete(`/prompts/${presetId}/groups/${groupId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.groups(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

// ═══════════════════════════════════════════════
//  Sections
// ═══════════════════════════════════════════════

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, ...data }: { presetId: string } & Record<string, unknown>) =>
      api.post<PromptSection>(`/prompts/${presetId}/sections`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, sectionId, ...data }: { presetId: string; sectionId: string } & Record<string, unknown>) =>
      api.patch<PromptSection>(`/prompts/${presetId}/sections/${sectionId}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, sectionId }: { presetId: string; sectionId: string }) =>
      api.delete(`/prompts/${presetId}/sections/${sectionId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useReorderSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, sectionIds }: { presetId: string; sectionIds: string[] }) =>
      api.put(`/prompts/${presetId}/sections/reorder`, { sectionIds }),
    onMutate: async ({ presetId, sectionIds }) => {
      await qc.cancelQueries({ queryKey: presetKeys.full(presetId) });
      const prev = qc.getQueryData(presetKeys.full(presetId)) as any;
      if (prev?.preset?.sectionOrder) {
        qc.setQueryData(presetKeys.full(presetId), {
          ...prev,
          preset: { ...prev.preset, sectionOrder: JSON.stringify(sectionIds) },
        });
      }
      return { prev };
    },
    onError: (_err, { presetId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(presetKeys.full(presetId), ctx.prev);
    },
    onSettled: (_data, _err, { presetId }) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(presetId) });
    },
  });
}

// ═══════════════════════════════════════════════
//  Preset Variables (Choice Blocks)
// ═══════════════════════════════════════════════

export function useCreateVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, ...data }: { presetId: string } & Record<string, unknown>) =>
      api.post<ChoiceBlock>(`/prompts/${presetId}/variables`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, "Failed to create preset variable."));
    },
  });
}

export function useUpdateVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      variableId,
      ...data
    }: { presetId: string; variableId: string } & Record<string, unknown>) =>
      api.patch<ChoiceBlock>(`/prompts/${presetId}/variables/${variableId}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, "Failed to update preset variable."));
    },
  });
}

export function useDeleteVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, variableId }: { presetId: string; variableId: string }) =>
      api.delete(`/prompts/${presetId}/variables/${variableId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useReorderVariables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, variableIds }: { presetId: string; variableIds: string[] }) =>
      api.put(`/prompts/${presetId}/variables/reorder`, { variableIds }),
    onMutate: async ({ presetId, variableIds }) => {
      await qc.cancelQueries({ queryKey: presetKeys.full(presetId) });
      const prev = qc.getQueryData(presetKeys.full(presetId)) as any;
      if (prev?.choiceBlocks) {
        const idOrder = new Map(variableIds.map((id, i) => [id, i]));
        const sorted = [...prev.choiceBlocks].sort(
          (a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
        );
        qc.setQueryData(presetKeys.full(presetId), { ...prev, choiceBlocks: sorted });
      }
      return { prev };
    },
    onError: (_err, { presetId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(presetKeys.full(presetId), ctx.prev);
    },
    onSettled: (_data, _err, { presetId }) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(presetId) });
    },
  });
}
