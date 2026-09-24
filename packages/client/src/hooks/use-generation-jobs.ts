// Generation jobs (feature switch generationJobTracking, off by default). Every query here is disabled
// while the switch is off, so the client makes no extra request. See docs/development/generation-jobs.md.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { isActiveJob, type TrackedGenerationJob } from "../lib/generation-job-tracking";
import { useFeatureEnabled } from "./use-feature-settings";

export type GenerationJobStatus = "running" | "completed" | "failed" | "cancelled" | "interrupted";

export interface GenerationJobMetadata {
  id: string;
  kind: string;
  label: string;
  chatId: string | null;
  status: GenerationJobStatus;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  errorCode?: string;
  errorId?: string;
  resultAvailable: boolean;
}

export const generationJobKeys = {
  all: ["generation-jobs"] as const,
  list: () => [...generationJobKeys.all, "list"] as const,
  result: (id: string) => [...generationJobKeys.all, "result", id] as const,
  records: () => [...generationJobKeys.all, "records"] as const,
  record: (id: string) => [...generationJobKeys.all, "record", id] as const,
};

/** Whether generations run as tracked jobs on the server (Settings > Advanced > Features). */
export function useGenerationJobsEnabled(): boolean {
  return useFeatureEnabled("generationJobTracking");
}

export function useGenerationJobs(enabled: boolean) {
  return useQuery({
    queryKey: generationJobKeys.list(),
    queryFn: () => api.get<GenerationJobMetadata[]>("/generation-jobs"),
    enabled,
    staleTime: 5_000,
    refetchInterval: (query) => (enabled && query.state.data?.some((job) => job.status === "running") ? 2_500 : false),
  });
}

export function useGenerationJobResult(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: generationJobKeys.result(id ?? ""),
    queryFn: () => api.get<unknown>(`/generation-jobs/${encodeURIComponent(id ?? "")}/result`),
    enabled: enabled && Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useCancelGenerationJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/generation-jobs/${encodeURIComponent(id)}/cancel`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: generationJobKeys.list() });
      queryClient.invalidateQueries({ queryKey: generationJobKeys.records() });
      queryClient.removeQueries({ queryKey: generationJobKeys.result(id) });
    },
  });
}

/**
 * Recent tracked jobs, shared by the recovery host and the jobs viewer (one request).
 * Polls quickly while something runs, slowly otherwise, and never while the switch is off.
 */
export function useTrackedGenerationJobs(enabled: boolean) {
  return useQuery({
    queryKey: generationJobKeys.records(),
    queryFn: async () =>
      (await api.get<{ records: TrackedGenerationJob[] }>("/generation-jobs/records?limit=100")).records,
    enabled,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (!enabled ? false : query.state.data?.some(isActiveJob) ? 3_000 : 30_000),
    refetchIntervalInBackground: false,
  });
}

export function useTrackedGenerationJob(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: generationJobKeys.record(id ?? ""),
    queryFn: () => api.get<TrackedGenerationJob>(`/generation-jobs/records/${encodeURIComponent(id ?? "")}`),
    enabled: enabled && Boolean(id),
    staleTime: 2_000,
  });
}

export async function markGenerationJobsSeen(ids: readonly string[], recovered: boolean): Promise<void> {
  if (ids.length === 0) return;
  await api.post("/generation-jobs/records/seen", { ids: ids.slice(0, 100), recovered });
}
