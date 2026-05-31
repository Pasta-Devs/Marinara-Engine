// ──────────────────────────────────────────────
// Hooks: Regex Scripts (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRegexScriptSchema,
  reorderRegexScriptsSchema,
  updateRegexScriptSchema,
} from "../../../../engine/contracts/schemas/regex.schema";
import { storageApi } from "../../../../shared/api/storage-api";

const regexKeys = {
  all: ["regex-scripts"] as const,
};

export interface RegexScriptRow {
  id: string;
  name: string;
  // Stored verbatim as a JSON boolean (matches the engine contract and seed_defaults);
  // legacy rows may still carry the string form, so reads must tolerate both.
  enabled: boolean | string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: string[];
  flags: string;
  promptOnly: boolean | string;
  order: number;
  minDepth: number | null;
  maxDepth: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useRegexScripts() {
  return useQuery({
    queryKey: regexKeys.all,
    queryFn: () => storageApi.list<RegexScriptRow>("regex-scripts"),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      storageApi.create<RegexScriptRow>("regex-scripts", createRegexScriptSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useUpdateRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update<RegexScriptRow>("regex-scripts", id, updateRegexScriptSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useReorderRegexScripts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scriptIds: string[]) => {
      const payload = reorderRegexScriptsSchema.parse({ scriptIds });
      await Promise.all(
        payload.scriptIds.map((id, index) =>
          storageApi.update("regex-scripts", id, updateRegexScriptSchema.parse({ sortOrder: index, order: index })),
        ),
      );
      return storageApi.list<RegexScriptRow>("regex-scripts");
    },
    onSuccess: (scripts) => {
      qc.setQueryData(regexKeys.all, scripts);
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}

export function useDeleteRegexScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("regex-scripts", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: regexKeys.all });
    },
  });
}
