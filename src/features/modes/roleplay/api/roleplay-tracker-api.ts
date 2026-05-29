import {
  trackerSnapshotApi,
  type TrackerSnapshot,
  type TrackerSnapshotInput,
  type TrackerSnapshotTarget,
} from "../../../../shared/api/tracker-snapshot-api";
import { worldStateApi, type WorldState, type WorldStatePatch } from "../../../runtime/world-state/index";

export type RoleplayTrackerSnapshot = TrackerSnapshot;
export type RoleplayTrackerSnapshotInput = TrackerSnapshotInput;
export type RoleplayVisibleTrackerState = WorldState;

export const roleplayTrackerApi = {
  clearManualState(chatId: string, patch: WorldStatePatch): Promise<RoleplayVisibleTrackerState> {
    return worldStateApi.patch(chatId, { ...patch, manual: true, clearOverrides: true });
  },

  latest(chatId: string): Promise<RoleplayTrackerSnapshot | null> {
    return trackerSnapshotApi.latest(chatId);
  },

  getTurn(chatId: string, target: TrackerSnapshotTarget): Promise<RoleplayTrackerSnapshot | null> {
    return trackerSnapshotApi.get(chatId, target);
  },

  saveTurn(chatId: string, snapshot: RoleplayTrackerSnapshotInput): Promise<RoleplayTrackerSnapshot> {
    return trackerSnapshotApi.save(chatId, snapshot);
  },
};
