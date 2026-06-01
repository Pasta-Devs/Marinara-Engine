// ──────────────────────────────────────────────
// React Query: Knowledge Source file hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeSourceKeys } from "../query-keys";
import { knowledgeSourcesApi } from "../../../../shared/api/integration-utility-api";

export interface KnowledgeSource {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

export function useKnowledgeSources() {
  return useQuery({
    queryKey: knowledgeSourceKeys.list(),
    queryFn: () => knowledgeSourcesApi.list<KnowledgeSource[]>(),
    staleTime: 60_000,
  });
}

export function useUploadKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => knowledgeSourcesApi.upload(file) as Promise<KnowledgeSource>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeSourceKeys.all });
    },
  });
}

export function useDeleteKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeSourcesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeSourceKeys.all });
    },
  });
}
