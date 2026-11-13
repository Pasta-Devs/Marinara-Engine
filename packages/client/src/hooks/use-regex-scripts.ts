// ──────────────────────────────────────────────
// Hooks: Regex Scripts (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { libraryFolderKeys } from "../lib/library-folder-keys";

export const regexKeys = {
  all: ["regex-scripts"] as const,
};

export interface RegexScriptRow {
  id: string;
  name: string;
  enabled: string;
  pausedByFolder?: boolean;
  findRegex: string;
  replaceString: string;
  trimStrings: string;
  placement: string;
  flags: string;
  promptOnly: string;
  applyMode?: string | null;
  targetCharacterIds: string;
  targetPromptPresetIds: string;
  order: number;
  minDepth: number | null;
  maxDepth: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useRegexScripts() {
  return useQuery({
    queryKey: regexKeys.all,
    queryFn: () => api.get<RegexScriptRow[]>("/regex-scripts"),
  });
}

export function useCreateRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<RegexScriptRow>("/regex-scripts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useImportRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<RegexScriptRow>("/regex-scripts/import", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useUpdateRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<RegexScriptRow>(`/regex-scripts/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useReorderRegexScripts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scriptIds: string[]) => api.put<RegexScriptRow[]>("/regex-scripts/reorder", { scriptIds }),
    onSuccess: (scripts) => {
      qc.setQueryData(regexKeys.all, scripts);
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useSetRegexScriptsEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { scriptIds: string[]; enabled: boolean }) => api.put<void>("/regex-scripts/enabled", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: regexKeys.all }),
  });
}

export function useDeleteRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/regex-scripts/${id}`),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: regexKeys.all }),
        qc.invalidateQueries({ queryKey: libraryFolderKeys.list("regex") }),
      ]),
  });
}
