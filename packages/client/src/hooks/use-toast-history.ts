import { useEffect, useRef, useState } from "react";
import { useSonner } from "sonner";
import { captureToastHistory, type ToastHistoryEntry } from "../lib/toast-history";

function toastSignature(toast: ReturnType<typeof useSonner>["toasts"][number]): string | null {
  const title = typeof toast.title === "string" || typeof toast.title === "number" ? String(toast.title).trim() : "";
  if (!title || toast.jsx) return null;
  const description =
    typeof toast.description === "string" || typeof toast.description === "number"
      ? String(toast.description).trim()
      : "";
  return `${toast.type ?? "default"}\0${title}\0${description}`;
}

/** Session-only notification history. EngineTasksMenu stays mounted in the top bar, so capture is
 * active whether its popover is open or closed. */
export function useToastHistory(): { history: ToastHistoryEntry[]; clear: () => void } {
  const { toasts } = useSonner();
  const [history, setHistory] = useState<ToastHistoryEntry[]>([]);
  const ignored = useRef(new Map<string | number, string | null>());

  useEffect(() => {
    const visibleIds = new Set(toasts.map((toast) => toast.id));
    for (const id of ignored.current.keys()) {
      if (!visibleIds.has(id)) ignored.current.delete(id);
    }
    if (toasts.length === 0) return;
    const occurredAt = Date.now();
    setHistory((current) =>
      toasts.reduce((next, toast) => {
        const signature = toastSignature(toast);
        if (ignored.current.get(toast.id) === signature) return next;
        ignored.current.delete(toast.id);
        return captureToastHistory(next, toast, occurredAt);
      }, current),
    );
  }, [toasts]);

  return {
    history,
    clear: () => {
      ignored.current = new Map(toasts.map((toast) => [toast.id, toastSignature(toast)]));
      setHistory([]);
    },
  };
}
