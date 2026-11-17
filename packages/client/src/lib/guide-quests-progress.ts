/**
 * Guide quest progress kept in this browser (AI basics and Deep dives): quests done or skipped, the
 * first-launch offer's answer, and Explorer achievements already sent. Same shape and rules as
 * Things to try's progress (lib/things-to-try-progress.ts).
 */
import type { GuideQuestGroupId } from "@marinara-engine/shared";
import { GUIDE_QUEST_BY_ID } from "./guide-quests";

const STORAGE_KEY = "marinara:guide-quests:v1";
export const GUIDE_QUESTS_CHANGED_EVENT = "marinara:guide-quests-changed";

export type AiBasicsOfferAnswer = "taught" | "skipped";

export interface GuideQuestsState {
  /** Quest id -> when it was done. */
  done: Record<string, number>;
  skipped: Record<string, number>;
  /** Groups whose Explorer achievement was sent. */
  explorer: Record<string, number>;
  /** The first-launch offer: answered, and how. */
  offer: AiBasicsOfferAnswer | null;
}

const EMPTY: GuideQuestsState = { done: {}, skipped: {}, explorer: {}, offer: null };

const record = (value: unknown): Record<string, number> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : {};

export function readGuideQuests(): GuideQuestsState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<GuideQuestsState> | null;
    if (!parsed) return { ...EMPTY };
    return {
      done: record(parsed.done),
      skipped: record(parsed.skipped),
      explorer: record(parsed.explorer),
      offer: parsed.offer === "taught" || parsed.offer === "skipped" ? parsed.offer : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** The raw stored value, so a snapshot can tell whether anything changed. */
export function readGuideQuestsRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function update(change: (state: GuideQuestsState) => boolean) {
  if (typeof window === "undefined") return;
  const state = readGuideQuests();
  if (!change(state)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: progress starts over next time, nothing breaks.
  }
  window.dispatchEvent(new Event(GUIDE_QUESTS_CHANGED_EVENT));
}

export function markGuideQuestDone(id: string) {
  update((state) => {
    if (!GUIDE_QUEST_BY_ID.has(id) || state.done[id] !== undefined) return false;
    state.done[id] = Date.now();
    delete state.skipped[id];
    return true;
  });
}

export function undoGuideQuest(id: string) {
  update((state) => {
    if (state.done[id] === undefined) return false;
    delete state.done[id];
    return true;
  });
}

export function skipGuideQuest(id: string) {
  update((state) => {
    state.skipped[id] = Date.now();
    return true;
  });
}

export function unskipGuideQuest(id: string) {
  update((state) => {
    if (state.skipped[id] === undefined) return false;
    delete state.skipped[id];
    return true;
  });
}

export function answerAiBasicsOffer(answer: AiBasicsOfferAnswer) {
  update((state) => {
    if (state.offer === answer) return false;
    state.offer = answer;
    return true;
  });
}

export function markGuideExplorerSent(group: GuideQuestGroupId) {
  update((state) => {
    if (state.explorer[group] !== undefined) return false;
    state.explorer[group] = Date.now();
    return true;
  });
}
