import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { promptOverridesApi } from "../api/prompt-overrides-api";
import type {
  PromptOverrideDefault,
  PromptOverrideDetail,
  PromptOverrideRow,
  PromptOverrideSummary,
  PromptOverrideVariable,
} from "../../../../engine/generation/prompt-overrides";

export type {
  PromptOverrideDefault,
  PromptOverrideDetail,
  PromptOverrideRow,
  PromptOverrideSummary,
  PromptOverrideVariable,
};

export const promptOverrideKeys = {
  all: ["prompt-overrides"] as const,
  list: () => [...promptOverrideKeys.all, "list"] as const,
  detail: (key: string) => [...promptOverrideKeys.all, "detail", key] as const,
  default: (key: string) => [...promptOverrideKeys.all, "default", key] as const,
};

export function usePromptOverrides() {
  return useQuery({
    queryKey: promptOverrideKeys.list(),
    queryFn: () => promptOverridesApi.list(),
    staleTime: 60_000,
  });
}

export function usePromptOverride(key: string | null) {
  return useQuery({
    queryKey: promptOverrideKeys.detail(key ?? ""),
    queryFn: () => promptOverridesApi.get(key!),
    enabled: !!key,
    staleTime: 60_000,
  });
}

export function usePromptOverrideDefault(key: string | null) {
  return useQuery({
    queryKey: promptOverrideKeys.default(key ?? ""),
    queryFn: () => promptOverridesApi.getDefault(key!),
    enabled: !!key,
    staleTime: 60_000,
  });
}

export function useSavePromptOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, template, enabled }: { key: string; template: string; enabled: boolean }) =>
      promptOverridesApi.save({ key, template, enabled }),
    onSuccess: (row, variables) => {
      queryClient.setQueryData<PromptOverrideDetail>(promptOverrideKeys.detail(variables.key), (current) =>
        current ? { ...current, override: row } : current,
      );
      queryClient.setQueryData<PromptOverrideSummary[]>(promptOverrideKeys.list(), (current) =>
        current?.map((entry) =>
          entry.key === variables.key
            ? { ...entry, hasOverride: true, enabled: row.enabled, updatedAt: row.updatedAt }
            : entry,
        ),
      );
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.list() });
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.detail(variables.key) });
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.default(variables.key) });
    },
  });
}

export function useResetPromptOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => promptOverridesApi.reset(key),
    onSuccess: (_row, key) => {
      queryClient.setQueryData<PromptOverrideDetail>(promptOverrideKeys.detail(key), (current) =>
        current ? { ...current, override: null } : current,
      );
      queryClient.setQueryData<PromptOverrideSummary[]>(promptOverrideKeys.list(), (current) =>
        current?.map((entry) =>
          entry.key === key ? { ...entry, hasOverride: false, enabled: false, updatedAt: null } : entry,
        ),
      );
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.list() });
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.detail(key) });
      queryClient.invalidateQueries({ queryKey: promptOverrideKeys.default(key) });
    },
  });
}
