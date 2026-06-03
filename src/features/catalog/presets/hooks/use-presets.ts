// ──────────────────────────────────────────────
// React Query: Preset, Group, Section & Choice hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createChoiceBlockSchema,
  createPromptGroupSchema,
  createPromptSectionSchema,
  updateChoiceBlockSchema,
  updatePromptGroupSchema,
  updatePromptPresetSchema,
  updatePromptSectionSchema,
} from "../../../../engine/contracts/schemas/prompt.schema";
import { boolish } from "../../../../engine/generation/runtime-records";
import type { StorageEntity } from "../../../../engine/capabilities/storage";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import type { PromptPreset, PromptGroup, PromptSection, ChoiceBlock } from "../../../../engine/contracts/types/prompt";

// ── Query Keys ──

export const presetKeys = {
  all: ["presets"] as const,
  list: () => [...presetKeys.all, "list"] as const,
  full: (id: string) => [...presetKeys.all, "full", id] as const,
  sections: (presetId: string) => [...presetKeys.all, "sections", presetId] as const,
  groups: (presetId: string) => [...presetKeys.all, "groups", presetId] as const,
  choiceBlocks: (presetId: string) => [...presetKeys.all, "choices", presetId] as const,
  default: () => [...presetKeys.all, "default"] as const,
};

type PromptNestedKind = "groups" | "sections" | "variables";

export type PromptPresetSummary = Pick<PromptPreset, "id" | "name" | "isDefault"> & {
  default?: boolean | string;
};

export interface PresetFullData {
  preset: PromptPreset;
  sections: PromptSection[];
  groups: PromptGroup[];
  choiceBlocks: ChoiceBlock[];
}

const PRESET_SUMMARY_OPTIONS = {
  fields: ["id", "name", "isDefault", "default"],
};

const promptNestedEntity: Record<PromptNestedKind, StorageEntity> = {
  groups: "prompt-groups",
  sections: "prompt-sections",
  variables: "prompt-variables",
};

const promptOrderField: Record<PromptNestedKind, string> = {
  groups: "groupOrder",
  sections: "sectionOrder",
  variables: "variableOrder",
};

const presetOrderQueues = new Map<string, Promise<void>>();

function parseOrderIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

async function runPresetOrderUpdate<T>(presetId: string, task: () => Promise<T>): Promise<T> {
  const previous = presetOrderQueues.get(presetId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  presetOrderQueues.set(presetId, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (presetOrderQueues.get(presetId) === tail) presetOrderQueues.delete(presetId);
  }
}

async function listPromptNested<T>(presetId: string, kind: PromptNestedKind): Promise<T[]> {
  return storageApi.list<T>(promptNestedEntity[kind], { filters: { presetId } });
}

function parsePromptNestedCreate(kind: PromptNestedKind, presetId: string, data: Record<string, unknown>) {
  const payload = { ...data, presetId };
  switch (kind) {
    case "groups":
      return createPromptGroupSchema.parse(payload);
    case "sections":
      return createPromptSectionSchema.parse(payload);
    case "variables":
      return createChoiceBlockSchema.parse(payload);
  }
}

function parsePromptNestedUpdate(kind: PromptNestedKind, data: Record<string, unknown>) {
  switch (kind) {
    case "groups":
      return updatePromptGroupSchema.parse(data);
    case "sections":
      return updatePromptSectionSchema.parse(data);
    case "variables":
      return updateChoiceBlockSchema.parse(data);
  }
}

async function createPromptNested<T>(
  presetId: string,
  kind: PromptNestedKind,
  data: Record<string, unknown>,
): Promise<T> {
  const created = await storageApi.create<T>(promptNestedEntity[kind], parsePromptNestedCreate(kind, presetId, data));
  const newId = (created as Record<string, unknown>).id as string | undefined;
  if (newId) {
    await runPresetOrderUpdate(presetId, async () => {
      const preset = await storageApi.get<Record<string, unknown>>("prompts", presetId);
      if (!preset) return;
      const orderField = promptOrderField[kind];
      let currentOrder: string[] = [];
      try {
        currentOrder = parseOrderIds(preset[orderField]);
      } catch (error) {
        console.warn(`[presets] Ignoring invalid ${orderField} order for preset ${presetId}`, error);
        currentOrder = [];
      }
      if (!currentOrder.includes(newId)) {
        await storageApi.update(
          "prompts",
          presetId,
          updatePromptPresetSchema.parse({
            [orderField]: [...currentOrder, newId],
          }),
        );
      }
    });
  }
  return created;
}

async function updatePromptNested<T>(kind: PromptNestedKind, id: string, data: Record<string, unknown>): Promise<T> {
  return storageApi.update<T>(promptNestedEntity[kind], id, parsePromptNestedUpdate(kind, data));
}

async function deletePromptNested(kind: PromptNestedKind, id: string) {
  return storageApi.delete(promptNestedEntity[kind], id);
}

async function reorderPromptNested<T>(presetId: string, kind: PromptNestedKind, ids: string[]): Promise<T[]> {
  const entity = promptNestedEntity[kind];
  await Promise.all(
    ids.map((id, index) =>
      storageApi.update(entity, id, {
        order: index,
        sortOrder: index,
      }),
    ),
  );
  await storageApi.update(
    "prompts",
    presetId,
    updatePromptPresetSchema.parse({
      [promptOrderField[kind]]: ids,
    }),
  );
  return listPromptNested<T>(presetId, kind);
}

// ═══════════════════════════════════════════════
//  Presets
// ═══════════════════════════════════════════════

export function usePresets() {
  return useQuery({
    queryKey: presetKeys.list(),
    queryFn: () => storageApi.list<PromptPreset>("prompts"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePresetSummaries() {
  return useQuery({
    queryKey: [...presetKeys.list(), "summaries"],
    queryFn: () => storageApi.list<PromptPresetSummary>("prompts", PRESET_SUMMARY_OPTIONS),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Fetch preset + all sections, groups, choice blocks in one call. */
export function usePresetFull(id: string | null) {
  return useQuery({
    queryKey: presetKeys.full(id ?? ""),
    queryFn: async (): Promise<PresetFullData> => {
      const preset = await storageApi.get<PromptPreset>("prompts", id!);
      if (!preset) throw new Error("Preset not found");
      const [sections, groups, choiceBlocks] = await Promise.all([
        listPromptNested<PromptSection>(id!, "sections"),
        listPromptNested<PromptGroup>(id!, "groups"),
        listPromptNested<ChoiceBlock>(id!, "variables"),
      ]);
      return {
        preset,
        sections,
        groups,
        choiceBlocks,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
    refetchOnMount: "always",
  });
}

export function useDefaultPreset() {
  return useQuery({
    queryKey: presetKeys.default(),
    queryFn: async () => {
      const presets = await storageApi.list<PromptPreset>("prompts");
      return (
        presets.find((preset) =>
          boolish(
            (preset as PromptPreset & { default?: unknown }).isDefault ??
              (preset as PromptPreset & { default?: unknown }).default,
            false,
          ),
        ) ?? null
      );
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update<PromptPreset>("prompts", id, updatePromptPresetSchema.parse(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.id) });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("prompts", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presetKeys.all });
    },
  });
}

export function useDuplicatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageCommandsApi.duplicate<PromptPreset>("prompts", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presetKeys.list() });
    },
  });
}

export function useSetDefaultPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const prompts = await storageApi.list<PromptPreset>("prompts");
      let selected: PromptPreset | null = null;
      await Promise.all(
        prompts.map(async (prompt) => {
          const isDefault = prompt.id === id;
          const updated = await storageApi.update<PromptPreset>(
            "prompts",
            prompt.id,
            updatePromptPresetSchema.parse({
              isDefault,
              default: isDefault,
            }),
          );
          if (isDefault) selected = updated;
        }),
      );
      return selected!;
    },
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
      createPromptNested<PromptGroup>(presetId, "groups", data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.groups(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, groupId, ...data }: { presetId: string; groupId: string } & Record<string, unknown>) => {
      void presetId;
      return updatePromptNested<PromptGroup>("groups", groupId, data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.groups(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId }: { presetId: string; groupId: string }) => deletePromptNested("groups", groupId),
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
      createPromptNested<PromptSection>(presetId, "sections", data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      sectionId,
      ...data
    }: { presetId: string; sectionId: string } & Record<string, unknown>) => {
      void presetId;
      return updatePromptNested<PromptSection>("sections", sectionId, data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.sections(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId }: { presetId: string; sectionId: string }) => deletePromptNested("sections", sectionId),
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
      reorderPromptNested<PromptSection>(presetId, "sections", sectionIds),
    onMutate: async ({ presetId, sectionIds }) => {
      await qc.cancelQueries({ queryKey: presetKeys.full(presetId) });
      const prev = qc.getQueryData<PresetFullData>(presetKeys.full(presetId));
      if (prev?.preset?.sectionOrder) {
        qc.setQueryData(presetKeys.full(presetId), {
          ...prev,
          preset: { ...prev.preset, sectionOrder: sectionIds },
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
      createPromptNested<ChoiceBlock>(presetId, "variables", data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
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
    }: { presetId: string; variableId: string } & Record<string, unknown>) => {
      void presetId;
      return updatePromptNested<ChoiceBlock>("variables", variableId, data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: presetKeys.choiceBlocks(variables.presetId) });
      qc.invalidateQueries({ queryKey: presetKeys.full(variables.presetId) });
    },
  });
}

export function useDeleteVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variableId }: { presetId: string; variableId: string }) =>
      deletePromptNested("variables", variableId),
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
      reorderPromptNested<ChoiceBlock>(presetId, "variables", variableIds),
    onMutate: async ({ presetId, variableIds }) => {
      await qc.cancelQueries({ queryKey: presetKeys.full(presetId) });
      const prev = qc.getQueryData<PresetFullData>(presetKeys.full(presetId));
      if (prev?.choiceBlocks) {
        const idOrder = new Map(variableIds.map((id, i) => [id, i]));
        const sorted = [...prev.choiceBlocks].sort(
          (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
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
