// ──────────────────────────────────────────────
// "Things to try" for Home: what the server's data and this app show as done, what was ticked or
// skipped here, and the next tasks to show. Finishing a trail unlocks its Explorer achievement.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { explorerAchievementEvent, type DiscoveryProgressResponse } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { finishedTrails, pickNextTasks, rankTrails, THINGS_TO_TRY_TASKS } from "../lib/things-to-try";
import {
  hotTrail,
  markExplorerSent,
  readThingsToTry,
  recordThingsDone,
  THINGS_TO_TRY_CHANGED_EVENT,
  type ThingsToTryState,
} from "../lib/things-to-try-progress";
import { appDoneThings, watchThingsToTry } from "../lib/things-to-try-watch";
import { achievementKeys, trackAchievementEvent } from "./use-achievements";

export const discoveryKeys = { progress: ["discovery", "progress"] as const };

let snapshot: { raw: string | null; state: ThingsToTryState } | null = null;
function readSnapshot(): ThingsToTryState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem("marinara:things-to-try:v1");
  } catch {
    raw = null;
  }
  if (!snapshot || snapshot.raw !== raw) snapshot = { raw, state: readThingsToTry() };
  return snapshot.state;
}

function subscribe(onChange: () => void) {
  window.addEventListener(THINGS_TO_TRY_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THINGS_TO_TRY_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useThingsToTry(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: discoveryKeys.progress,
    queryFn: () => api.get<DiscoveryProgressResponse>("/discovery/progress"),
    enabled,
    staleTime: 30_000,
  });
  const state = useSyncExternalStore(subscribe, readSnapshot, () => readThingsToTry());

  // Saved data and the app's own state are recorded as done, and stay done from then on.
  useEffect(() => {
    if (!query.data) return;
    recordThingsDone([...query.data.done, ...appDoneThings()]);
    watchThingsToTry();
  }, [query.data]);

  const done = useMemo(() => new Set(Object.keys(state.done)), [state.done]);
  const skipped = useMemo(() => new Set(Object.keys(state.skipped)), [state.skipped]);
  const ticked = useMemo(() => new Set(Object.keys(state.ticked)), [state.ticked]);
  const trails = useMemo(() => rankTrails(query.data?.modes ?? null, hotTrail(state)), [query.data?.modes, state]);
  const next = useMemo(() => pickNextTasks(done, skipped, trails), [done, skipped, trails]);
  const finished = useMemo(() => finishedTrails(done), [done]);

  // Each finished trail unlocks its Explorer achievement once.
  useEffect(() => {
    if (!state.started) return;
    const unsent = finished.filter((trail) => state.explorer[trail] === undefined);
    if (!unsent.length) return;
    for (const trail of unsent) {
      markExplorerSent(trail);
      void trackAchievementEvent(explorerAchievementEvent(trail))
        .then(() => queryClient.invalidateQueries({ queryKey: achievementKeys.all }))
        .catch(() => undefined);
    }
  }, [finished, queryClient, state.explorer, state.started]);

  return {
    loading: query.isLoading,
    ready: !!query.data && state.started,
    done,
    skipped,
    ticked,
    next,
    trails,
    finished,
    doneCount: THINGS_TO_TRY_TASKS.filter((task) => done.has(task.id)).length,
    total: THINGS_TO_TRY_TASKS.length,
  };
}
