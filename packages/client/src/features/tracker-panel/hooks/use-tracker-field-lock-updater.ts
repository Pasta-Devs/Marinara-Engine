import { useCallback } from "react";
import { trackerFieldLocksAreEqual, type TrackerFieldLocks } from "@marinara-engine/shared";
import type { GameStatePatchField } from "../../../hooks/use-game-state-patcher";
import { useGameStateStore } from "../../../stores/game-state.store";

export type TrackerFieldLocksUpdater = (locks: TrackerFieldLocks | null | undefined) => TrackerFieldLocks;

export function useTrackerFieldLockUpdater({
  chatId,
  fieldLocks,
  patchField,
}: {
  chatId: string | null;
  fieldLocks?: TrackerFieldLocks | null;
  patchField: (field: GameStatePatchField, value: unknown) => void;
}) {
  return useCallback(
    (updater: TrackerFieldLocksUpdater) => {
      if (!chatId) return;
      const latestState = useGameStateStore.getState().current;
      const currentLocks = latestState?.chatId === chatId ? latestState.fieldLocks : fieldLocks;
      const nextLocks = updater(currentLocks);
      if (trackerFieldLocksAreEqual(currentLocks, nextLocks)) return;
      patchField("fieldLocks", nextLocks);
    },
    [chatId, fieldLocks, patchField],
  );
}
