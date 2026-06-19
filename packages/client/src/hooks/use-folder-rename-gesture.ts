import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

export interface FolderRenameGestureOptions {
  onSingleClick: () => void;
  onRename: () => void;
  delayMs?: number;
}

interface PendingFolderRenameGesture {
  lastClickAt: number;
  timeout: ReturnType<typeof window.setTimeout>;
}

export function useFolderRenameGesture() {
  const pendingGesturesRef = useRef(new Map<string, PendingFolderRenameGesture>());

  useEffect(
    () => () => {
      for (const pending of pendingGesturesRef.current.values()) {
        window.clearTimeout(pending.timeout);
      }
      pendingGesturesRef.current.clear();
    },
    [],
  );

  return useCallback(
    (
      key: string,
      event: ReactMouseEvent<HTMLElement>,
      { onSingleClick, onRename, delayMs = 360 }: FolderRenameGestureOptions,
    ) => {
      event.stopPropagation();

      const now = Date.now();
      const pending = pendingGesturesRef.current.get(key);

      if (pending) {
        window.clearTimeout(pending.timeout);
        pendingGesturesRef.current.delete(key);
      }

      if (pending && now - pending.lastClickAt < delayMs) {
        onRename();
        return;
      }

      const timeout = window.setTimeout(() => {
        pendingGesturesRef.current.delete(key);
        onSingleClick();
      }, delayMs);
      pendingGesturesRef.current.set(key, { lastClickAt: now, timeout });
    },
    [],
  );
}

export function handleFolderRenameKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  { onSingleClick, onRename }: Pick<FolderRenameGestureOptions, "onSingleClick" | "onRename">,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    onSingleClick();
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    event.stopPropagation();
    onRename();
  }
}
