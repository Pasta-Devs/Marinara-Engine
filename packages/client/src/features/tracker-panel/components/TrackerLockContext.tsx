import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { isTrackerFieldLocked, type TrackerFieldLocks } from "@marinara-engine/shared";
import type { TrackerFieldLocksUpdater } from "../hooks/use-tracker-field-lock-updater";

interface TrackerLockContextValue {
  fieldLocks?: TrackerFieldLocks | null;
  lockMode: boolean;
  onSetLockMode?: (enabled: boolean) => void;
  onToggleFieldLock?: (key: string) => void;
  onUpdateFieldLocks?: (updater: TrackerFieldLocksUpdater) => void;
}

const TrackerLockContext = createContext<TrackerLockContextValue>({ lockMode: false });

export function TrackerLockProvider({
  children,
  fieldLocks,
  lockMode,
  onSetLockMode,
  onToggleFieldLock,
  onUpdateFieldLocks,
}: TrackerLockContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ fieldLocks, lockMode, onSetLockMode, onToggleFieldLock, onUpdateFieldLocks }),
    [fieldLocks, lockMode, onSetLockMode, onToggleFieldLock, onUpdateFieldLocks],
  );
  return <TrackerLockContext.Provider value={value}>{children}</TrackerLockContext.Provider>;
}

export function useTrackerLockContext() {
  return useContext(TrackerLockContext);
}

export function useTrackerFieldLock(key: string | undefined) {
  const { fieldLocks, lockMode, onToggleFieldLock } = useTrackerLockContext();
  const onToggleLock = useCallback(() => {
    if (key) onToggleFieldLock?.(key);
  }, [key, onToggleFieldLock]);
  return {
    locked: key ? isTrackerFieldLocked(fieldLocks, key) : false,
    lockMode,
    onToggleLock: key && onToggleFieldLock ? onToggleLock : undefined,
  };
}
