import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ImageTagCategory,
  ImageTagDatasetSummary,
  ImageTagSearchRequest,
  ImageTagSearchResponse,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

const datasetKeys = { all: ["image-tag-datasets"] as const };

export function useImageTagDatasets() {
  return useQuery({
    queryKey: datasetKeys.all,
    queryFn: () => api.get<{ sources: ImageTagDatasetSummary[]; unavailableSources: string[] }>("/image-tag-datasets"),
    staleTime: 30_000,
  });
}

export function useImportImageTagDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category, replaceId }: { file: File; category?: ImageTagCategory; replaceId?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (category !== undefined) form.append("category", String(category));
      if (replaceId) form.append("replaceId", replaceId);
      return api.upload<ImageTagDatasetSummary>("/image-tag-datasets/import", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: datasetKeys.all }),
  });
}

export function useUpdateImageTagDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...changes
    }: {
      id: string;
      enabled?: boolean;
      enabledCategories?: ImageTagCategory[];
      name?: string;
    }) => api.patch<ImageTagDatasetSummary>(`/image-tag-datasets/${id}`, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: datasetKeys.all }),
  });
}

export function useDeleteImageTagDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/image-tag-datasets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: datasetKeys.all }),
  });
}

export function useSearchImageTagDatasets() {
  return useMutation({
    mutationFn: (request: ImageTagSearchRequest) =>
      api.post<ImageTagSearchResponse>("/image-tag-datasets/search", request),
  });
}
