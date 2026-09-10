import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSonner } from "sonner";
import { captureToastHistory, type ToastHistoryEntry } from "../lib/toast-history";

type SonnerToast = ReturnType<typeof useSonner>["toasts"][number];

function toastSignature(toast: SonnerToast): string | null {
  const title = typeof toast.title === "string" || typeof toast.title === "number" ? String(toast.title).trim() : "";
  if (!title || toast.jsx) return null;
  const description =
    typeof toast.description === "string" || typeof toast.description === "number"
      ? String(toast.description).trim()
      : "";
  return `${toast.type ?? "default"}\0${title}\0${description}`;
}

// Capture must outlive whoever displays the history: Mission Control now lives in a Settings tab
// that is not mounted until you first open it, and a toast you missed is exactly the one worth
// keeping. Module-level state, so the capture point and the reader can be different components.
let entries: ToastHistoryEntry[] = [];
// Toasts still on screen when the user cleared. Without this the next tick recaptures them.
let suppressed = new Map<string | number, string | null>();
const listeners = new Set<() => void>();

function publish(next: ToastHistoryEntry[]) {
  if (next === entries) return;
  entries = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mount exactly once, somewhere that is always rendered. */
export function useToastHistoryCapture(): void {
  const { toasts } = useSonner();

  useEffect(() => {
    const visibleIds = new Set(toasts.map((toast) => toast.id));
    for (const id of suppressed.keys()) {
      if (!visibleIds.has(id)) suppressed.delete(id);
    }
    if (toasts.length === 0) return;
    const occurredAt = Date.now();
    publish(
      toasts.reduce((next, toast) => {
        const signature = toastSignature(toast);
        if (suppressed.get(toast.id) === signature) return next;
        suppressed.delete(toast.id);
        return captureToastHistory(next, toast, occurredAt);
      }, entries),
    );
  }, [toasts]);
}

export function useToastHistory(): { history: ToastHistoryEntry[]; clear: () => void } {
  const history = useSyncExternalStore(
    subscribe,
    () => entries,
    () => entries,
  );
  const { toasts } = useSonner();
  const clear = useCallback(() => {
    suppressed = new Map(toasts.map((toast) => [toast.id, toastSignature(toast)]));
    publish([]);
  }, [toasts]);
  return { history, clear };
}

/** Exposed for the regression check. */
export function resetToastHistoryForTests(): void {
  entries = [];
  suppressed = new Map();
}
