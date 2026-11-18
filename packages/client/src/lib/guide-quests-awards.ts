/**
 * Explorer achievements for guide quests: one per finished group (AI basics, each Deep dive group) and one
 * for every deep dive. Sent the moment a quest finishes a group, wherever that happens (the docs card,
 * See all), and caught up on load for anything finished before.
 */
import { guideQuestAchievementEvent } from "@marinara-engine/shared";
import { trackAchievementEvent } from "../hooks/use-achievements";
import { finishedGuideQuestGroups } from "./guide-quests";
import { GUIDE_QUESTS_CHANGED_EVENT, markGuideExplorerSent, readGuideQuests } from "./guide-quests-progress";

/** Sends each finished group's achievement once. Returns the sends, so a caller can refresh lists after. */
let sending = false;

export function sendGuideQuestAwards(): Promise<unknown>[] {
  // Marking a group sent is itself a change, which calls this again: that nested call has nothing to add.
  if (sending) return [];
  sending = true;
  try {
    const state = readGuideQuests();
    const unsent = finishedGuideQuestGroups(new Set(Object.keys(state.done))).filter(
      (group) => state.explorer[group] === undefined,
    );
    for (const group of unsent) markGuideExplorerSent(group);
    return unsent.map((group) => trackAchievementEvent(guideQuestAchievementEvent(group)).catch(() => undefined));
  } finally {
    sending = false;
  }
}

let started = false;

export function watchGuideQuestAwards() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener(GUIDE_QUESTS_CHANGED_EVENT, () => void sendGuideQuestAwards());
  void sendGuideQuestAwards();
}
