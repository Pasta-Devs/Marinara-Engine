import type { ToastT } from "sonner";

export type ToastHistoryKind = "default" | "success" | "info" | "warning" | "error" | "loading";

export interface ToastHistoryEntry {
  id: string | number;
  kind: ToastHistoryKind;
  title: string;
  description?: string;
  occurredAt: number;
}

export const TOAST_HISTORY_LIMIT = 5;

function displayText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
}

function historyKind(type: ToastT["type"]): ToastHistoryKind {
  if (type === "success" || type === "info" || type === "warning" || type === "error" || type === "loading") {
    return type;
  }
  return "default";
}

/**
 * Capture only text that is safe to render after the original toast disappears. Custom JSX,
 * callbacks and actions remain transient. Updating the same Sonner id replaces its history row.
 */
export function captureToastHistory(
  current: ToastHistoryEntry[],
  toast: ToastT,
  occurredAt: number,
): ToastHistoryEntry[] {
  if (toast.delete || toast.jsx) return current;
  const title = displayText(toast.title);
  if (!title) return current;

  const description = displayText(toast.description);
  const kind = historyKind(toast.type);
  const existing = current.find((entry) => entry.id === toast.id);
  if (existing && existing.title === title && existing.description === description && existing.kind === kind) {
    return current;
  }

  return [
    { id: toast.id, kind, title, ...(description ? { description } : {}), occurredAt },
    ...current.filter((entry) => entry.id !== toast.id),
  ]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, TOAST_HISTORY_LIMIT);
}
