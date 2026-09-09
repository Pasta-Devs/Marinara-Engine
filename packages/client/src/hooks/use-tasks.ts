import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export type TaskKind = "generation" | "agents" | "media" | "transfer";

export type TaskOutcome = "completed" | "failed" | "aborted";

export interface TaskProgress {
  current: number;
  total?: number;
  unit?: "bytes" | "items";
}

export interface EngineTask {
  id: string;
  kind: TaskKind;
  label: string;
  detail?: string;
  chatId?: string;
  startedAt: number;
  phase?: string;
  progress?: TaskProgress;
  cancellable: boolean;
}

export interface FinishedTask {
  id: string;
  kind: TaskKind;
  label: string;
  detail?: string;
  chatId?: string;
  startedAt: number;
  endedAt: number;
  outcome: TaskOutcome;
}

/**
 * Polls the global task registry. Fast while work is running, slow while idle, and paused while the
 * tab is hidden — a background tab has nothing to render.
 */
export function useEngineTasks() {
  return useQuery({
    queryKey: ["engine-tasks"],
    queryFn: ({ signal }) => api.get<{ tasks: EngineTask[]; history: FinishedTask[] }>("/tasks", { signal }),
    staleTime: 0,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => (query.state.data?.tasks.length ? 1_000 : 5_000),
  });
}

export function useAbortEngineTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${encodeURIComponent(taskId)}/abort`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["engine-tasks"] }),
  });
}
