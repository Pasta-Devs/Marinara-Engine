import type { FinishedTask } from "../hooks/use-tasks";
import type { ToastHistoryEntry } from "./toast-history";

export type RecentActivity =
  | { source: "task"; occurredAt: number; task: FinishedTask }
  | { source: "toast"; occurredAt: number; toast: ToastHistoryEntry };

export function mergeRecentActivity(taskHistory: FinishedTask[], toastHistory: ToastHistoryEntry[]): RecentActivity[] {
  return [
    ...taskHistory.map((task) => ({ source: "task" as const, occurredAt: task.endedAt, task })),
    ...toastHistory.map((toast) => ({ source: "toast" as const, occurredAt: toast.occurredAt, toast })),
  ]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, 5);
}
