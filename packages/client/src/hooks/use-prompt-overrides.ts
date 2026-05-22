// ──────────────────────────────────────────────
// React Query: Registered prompt overrides
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface PromptOverrideVariable {
  name: string;
  description: string;
  example?: string;
}

export interface PromptOverrideSummary {
  key: string;
  description: string;
  variables: PromptOverrideVariable[];
  hasOverride: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

export interface PromptOverrideRow {
  key: string;
  template: string;
  enabled: boolean;
  updatedAt: string;
}

export interface PromptOverrideDetail {
  key: string;
  description: string;
  variables: PromptOverrideVariable[];
  override: PromptOverrideRow | null;
}

export interface PromptOverrideDefault {
  key: string;
  template: string;
  exampleContext: Record<string, string | number | undefined>;
}

export const promptOverrideKeys = {
  all: ["prompt-overrides"] as const,
  list: () => [...promptOverrideKeys.all, "list"] as const,
  detail: (key: string) => [...promptOverrideKeys.all, "detail", key] as const,
  default: (key: string) => [...promptOverrideKeys.all, "default", key] as const,
};

export function usePromptOverrides() {
  return useQuery({
    queryKey: promptOverrideKeys.list(),
    queryFn: () => api.get<PromptOverrideSummary[]>("/prompt-overrides"),
    staleTime: 60_000,
  });
}

export function usePromptOverride(key: string | null) {
  return useQuery({
    queryKey: promptOverrideKeys.detail(key ?? ""),
    queryFn: () => api.get<PromptOverrideDetail>(`/prompt-overrides/${key}`),
    enabled: !!key,
    staleTime: 60_000,
  });
}

export function usePromptOverrideDefault(key: string | null) {
  return useQuery({
    queryKey: promptOverrideKeys.default(key ?? ""),
    queryFn: () => api.get<PromptOverrideDefault>(`/prompt-overrides/${key}/default`),
    enabled: !!key,
    staleTime: 60_000,
  });
}

export function useSavePromptOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, template, enabled }: { key: string; template: string; enabled: boolean }) =>
      api.put<PromptOverrideRow>(`/prompt-overrides/${key}`, { template, enabled }),
    onSuccess: (_row, variables) => {
      qc.invalidateQueries({ queryKey: promptOverrideKeys.list() });
      qc.invalidateQueries({ queryKey: promptOverrideKeys.detail(variables.key) });
      qc.invalidateQueries({ queryKey: promptOverrideKeys.default(variables.key) });
    },
  });
}

export function useResetPromptOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete<void>(`/prompt-overrides/${key}`),
    onSuccess: (_row, key) => {
      qc.invalidateQueries({ queryKey: promptOverrideKeys.list() });
      qc.invalidateQueries({ queryKey: promptOverrideKeys.detail(key) });
      qc.invalidateQueries({ queryKey: promptOverrideKeys.default(key) });
    },
  });
}
