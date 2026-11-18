// ──────────────────────────────────────────────
// Guide quests for Home (AI basics and Deep dives): what's done or skipped here, deep dive groups ranked
// by what this person does most, and the Explorer achievement for each finished group.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { finishedGuideQuestGroups, pickDeepDives, rankDeepDiveGroups } from "../lib/guide-quests";
import { sendGuideQuestAwards } from "../lib/guide-quests-awards";
import {
  GUIDE_QUESTS_CHANGED_EVENT,
  readGuideQuests,
  readGuideQuestsRaw,
  type GuideQuestsState,
} from "../lib/guide-quests-progress";
import { THINGS_TO_TRY_BY_ID } from "../lib/things-to-try";
import { readThingsToTry } from "../lib/things-to-try-progress";
import { achievementKeys } from "./use-achievements";
import { useThingsToTry } from "./use-things-to-try";

let snapshot: { raw: string | null; state: GuideQuestsState } | null = null;
function readSnapshot(): GuideQuestsState {
  const raw = readGuideQuestsRaw();
  if (!snapshot || snapshot.raw !== raw) snapshot = { raw, state: readGuideQuests() };
  return snapshot.state;
}

function subscribe(onChange: () => void) {
  window.addEventListener(GUIDE_QUESTS_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GUIDE_QUESTS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Just the stored state, with no server query (for the first-launch offer and the card). */
export function useGuideQuestsState(): GuideQuestsState {
  return useSyncExternalStore(subscribe, readSnapshot, () => readGuideQuests());
}

export function useGuideQuests() {
  const queryClient = useQueryClient();
  const state = useGuideQuestsState();
  const things = useThingsToTry();

  const done = useMemo(() => new Set(Object.keys(state.done)), [state.done]);
  const skipped = useMemo(() => new Set(Object.keys(state.skipped)), [state.skipped]);
  const groups = useMemo(
    () =>
      rankDeepDiveGroups({
        modes: things.modes,
        thingsDone: readThingsToTry().done,
        trailOf: (id) => THINGS_TO_TRY_BY_ID.get(id)?.trail,
        deepDone: state.done,
      }),
    // `things.done` changes whenever Things to try progress does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [things.modes, things.done, state.done],
  );
  const finished = useMemo(() => finishedGuideQuestGroups(done), [done]);

  // Explorer achievements are sent by the app-wide watcher (lib/guide-quests-awards.ts); this refreshes
  // the Achievements list after any send it makes from here.
  useEffect(() => {
    const sends = sendGuideQuestAwards();
    if (sends.length)
      void Promise.all(sends).then(() => queryClient.invalidateQueries({ queryKey: achievementKeys.all }));
  }, [finished, queryClient]);

  /** Deep dives mix into the Home widget once Things to try's Core trail is done. */
  const coreDone = things.finished.includes("core");
  const nextDeepMany = useMemo(() => pickDeepDives(done, skipped, groups, 3), [done, skipped, groups]);
  const nextDeep = useMemo(() => nextDeepMany.slice(0, 1), [nextDeepMany]);

  return { state, done, skipped, groups, finished, coreDone, nextDeep, nextDeepMany, things };
}
