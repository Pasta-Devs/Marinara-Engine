/**
 * "Things to try" progress kept in this browser: tasks seen done (by the server, by the app, or ticked
 * by hand), tasks skipped, and Explorer achievements already sent. Once a task is seen done it stays
 * done here, so deleting the chat that showed it doesn't untick it.
 */
import type { DiscoveryTrailId } from "@marinara-engine/shared";
import { markFeatureTipSeen, type FeatureTipId } from "./feature-tips";
import { THINGS_TO_TRY_BY_ID } from "./things-to-try";

const STORAGE_KEY = "marinara:things-to-try:v1";
export const THINGS_TO_TRY_CHANGED_EVENT = "marinara:things-to-try-changed";

export interface ThingsToTryState {
  /** Task id -> when it was first seen done (0 = already done the first time the list loaded). */
  done: Record<string, number>;
  /** Task ids ticked by hand, so Undo can untick them. */
  ticked: Record<string, number>;
  skipped: Record<string, number>;
  /** Trails whose Explorer achievement was sent. */
  explorer: Record<string, number>;
  /** Whether the first load has set the baseline. */
  started: boolean;
}

const EMPTY: ThingsToTryState = { done: {}, ticked: {}, skipped: {}, explorer: {}, started: false };

/** The in-place tips that name a task: finishing the task retires its tip. */
const TASK_TIPS: Partial<Record<string, FeatureTipId>> = {
  M1: "chatDefaultsConversation",
  M2: "settingsProfilesRoleplay",
  S1: "branches",
  S2: "peekPrompt",
};

const record = (value: unknown): Record<string, number> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : {};

export function readThingsToTry(): ThingsToTryState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ThingsToTryState> | null;
    if (!parsed) return { ...EMPTY };
    return {
      done: record(parsed.done),
      ticked: record(parsed.ticked),
      skipped: record(parsed.skipped),
      explorer: record(parsed.explorer),
      started: parsed.started === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(state: ThingsToTryState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: progress shows again from the server's data next time.
  }
  window.dispatchEvent(new Event(THINGS_TO_TRY_CHANGED_EVENT));
}

function update(change: (state: ThingsToTryState) => boolean) {
  if (typeof window === "undefined") return;
  const state = readThingsToTry();
  if (change(state)) write(state);
}

/**
 * Records tasks seen done. The first call only sets the baseline (time 0), so an experienced user's
 * existing work doesn't count as "just done" and reorder the list.
 */
export function recordThingsDone(ids: Iterable<string>) {
  update((state) => {
    let changed = !state.started;
    const at = state.started ? Date.now() : 0;
    for (const id of ids) {
      if (!THINGS_TO_TRY_BY_ID.has(id) || state.done[id] !== undefined) continue;
      state.done[id] = at;
      const tip = TASK_TIPS[id];
      if (tip) markFeatureTipSeen(tip);
      changed = true;
    }
    state.started = true;
    return changed;
  });
}

/** An action that has no saved trace (opened a search result, Peek prompt) counts its task as done. */
export function markThingTried(id: string) {
  recordThingsDone([id]);
}

export function tickThing(id: string) {
  update((state) => {
    if (state.done[id] !== undefined) return false;
    state.done[id] = Date.now();
    state.ticked[id] = Date.now();
    delete state.skipped[id];
    const tip = TASK_TIPS[id];
    if (tip) markFeatureTipSeen(tip);
    return true;
  });
}

export function untickThing(id: string) {
  update((state) => {
    if (state.ticked[id] === undefined) return false;
    delete state.ticked[id];
    delete state.done[id];
    return true;
  });
}

export function skipThing(id: string) {
  update((state) => {
    state.skipped[id] = Date.now();
    return true;
  });
}

export function unskipThing(id: string) {
  update((state) => {
    if (state.skipped[id] === undefined) return false;
    delete state.skipped[id];
    return true;
  });
}

export function markExplorerSent(trail: DiscoveryTrailId) {
  update((state) => {
    if (state.explorer[trail] !== undefined) return false;
    state.explorer[trail] = Date.now();
    return true;
  });
}

const HOT_TRAIL_MS = 24 * 60 * 60 * 1000;

/** The trail of the task done most recently, for a day: its next step moves to the top. */
export function hotTrail(state: ThingsToTryState, now = Date.now()): DiscoveryTrailId | null {
  let best: { trail: DiscoveryTrailId; at: number } | null = null;
  for (const [id, at] of Object.entries(state.done)) {
    if (!at || now - at > HOT_TRAIL_MS) continue;
    const task = THINGS_TO_TRY_BY_ID.get(id);
    if (task && (!best || at > best.at)) best = { trail: task.trail, at };
  }
  return best?.trail ?? null;
}
