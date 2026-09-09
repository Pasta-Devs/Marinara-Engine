import { useEffect, useState } from "react";
import { useSonner } from "sonner";
import { captureToastHistory, type ToastHistoryEntry } from "../lib/toast-history";

/** Session-only notification history. EngineTasksMenu stays mounted in the top bar, so capture is
 * active whether its popover is open or closed. */
export function useToastHistory(): ToastHistoryEntry[] {
  const { toasts } = useSonner();
  const [history, setHistory] = useState<ToastHistoryEntry[]>([]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const occurredAt = Date.now();
    setHistory((current) => toasts.reduce((next, toast) => captureToastHistory(next, toast, occurredAt), current));
  }, [toasts]);

  return history;
}
