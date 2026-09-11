import type { EngineTasksResponse, FinishedTask, TaskSnapshot } from "@marinara-engine/shared";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";

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

/**
 * Work you are not already watching. The open chat narrates its own reply through the stream and the
 * chat list, so only background work and other chats need Mission Control's attention.
 */
export function isUnwatchedMission(task: Pick<TaskSnapshot, "chatId">, activeChatId: string | null): boolean {
  return !task.chatId || task.chatId !== activeChatId;
}

export function openMissionControl(): void {
  const ui = useUIStore.getState();
  ui.setSettingsTab("activity");
  ui.openRightPanel("settings");
}

/** Failure toasts carry this id prefix so recent activity can skip them; the task row already says it. */
export const FAILURE_TOAST_ID_PREFIX = "mission-failed:";

/** Mount once. Raises a toast when unwatched work fails, since nothing else would tell you. */
export function useBackgroundFailureToasts(history: FinishedTask[] | undefined): void {
  const { t } = useTranslation();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!history) return;
    const keyOf = (entry: FinishedTask) => `${entry.id}:${entry.endedAt}`;
    // First poll seeds the set: failures from before this tab loaded are history, not news.
    if (!seen.current) {
      seen.current = new Set(history.map(keyOf));
      return;
    }
    const activeChatId = useChatStore.getState().activeChatId;
    for (const entry of history) {
      const key = keyOf(entry);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (entry.outcome !== "failed" || !isUnwatchedMission(entry, activeChatId)) continue;
      toast.error(t("tasks.backgroundFailed", { task: entry.label }), {
        id: `${FAILURE_TOAST_ID_PREFIX}${key}`,
        action: { label: t("tasks.openMissionControl"), onClick: openMissionControl },
      });
    }
  }, [history, t]);
}
