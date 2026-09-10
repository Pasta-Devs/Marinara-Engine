import type { EngineTasksResponse } from "@marinara-engine/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../lib/api-client";

export type {
  FinishedTask,
  MissionStage,
  MissionStageState,
  TaskKind,
  TaskOutcome,
  TaskProgress,
  TaskSnapshot as EngineTask,
  TaskState,
  TaskStepSnapshot,
  TaskStepState,
  TaskStopMode,
} from "@marinara-engine/shared";

export function useEngineTasks() {
  return useQuery({
    queryKey: ["engine-tasks"],
    queryFn: ({ signal }) => api.get<EngineTasksResponse>("/tasks", { signal }),
    staleTime: 0,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => (query.state.data?.tasks.length ? 1_000 : 5_000),
  });
}

export function useStopEngineTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${encodeURIComponent(taskId)}/stop`),
    onError: () => toast.error(t("tasks.stopFailed")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["engine-tasks"] }),
  });
}

export function useClearEngineTaskHistory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.delete("/tasks/history"),
    onError: () => toast.error(t("tasks.clearFailed")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["engine-tasks"] }),
  });
}

export const useAbortEngineTask = useStopEngineTask;
