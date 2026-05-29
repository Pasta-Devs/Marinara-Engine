import {
  trackerSnapshotApi,
  type TrackerSnapshot,
  type TrackerSnapshotInput,
  type TrackerSnapshotTarget,
} from "../../../../shared/api/tracker-snapshot-api";
import { worldStateApi, type WorldState } from "../../../runtime/world-state/index";

export type GameTrackerSnapshot = TrackerSnapshot;
export type GameTrackerSnapshotInput = TrackerSnapshotInput;
export type GameVisibleTrackerState = WorldState;

export const gameTrackerApi = {
  visible(chatId: string): Promise<GameVisibleTrackerState | null> {
    return worldStateApi.get(chatId);
  },

  latest(chatId: string): Promise<GameTrackerSnapshot | null> {
    return trackerSnapshotApi.latest(chatId);
  },

  getTurn(chatId: string, target: TrackerSnapshotTarget): Promise<GameTrackerSnapshot | null> {
    return trackerSnapshotApi.get(chatId, target);
  },

  saveTurn(chatId: string, snapshot: GameTrackerSnapshotInput): Promise<GameTrackerSnapshot> {
    return trackerSnapshotApi.save(chatId, snapshot);
  },
};
