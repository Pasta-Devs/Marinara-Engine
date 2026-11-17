/**
 * "Things to try" tasks this app can see for itself (a font picked, two tabs open, a split): each is
 * recorded the moment it becomes true, wherever it happens, and stays done after that.
 */
import { useOverhaulStore } from "../stores/overhaul.store";
import { useUIStore } from "../stores/ui.store";
import { readThingsToTry, recordThingsDone, THINGS_TO_TRY_CHANGED_EVENT } from "./things-to-try-progress";

const HOME_WIDGET_VISIBILITY_STORAGE_KEY = "marinara:home:widget-visibility:v2";
const DEFAULT_GROUP_NAME = /^Group \d+$/u;

function homeHasExtraWidget() {
  try {
    const visible = JSON.parse(window.localStorage.getItem(HOME_WIDGET_VISIBILITY_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(visible) && (visible.includes("character") || visible.includes("discovery"));
  } catch {
    return false;
  }
}

/** Task ids the app's own state shows as done right now. Reads stores only, so it is cheap. */
function storeDoneThings(): string[] {
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
  const done: string[] = [];
  const mark = (id: string, when: unknown) => {
    if (when) done.push(id);
  };
  mark("C11", Object.keys(overhaul.chatSettingsLayouts ?? {}).length > 0);
  mark("T2", !!ui.fontFamily?.trim());
  mark("T3", ui.chatBackgroundBlur > 0);
  mark("KT2", Object.keys(ui.characterThemeDefaults ?? {}).length > 0);
  mark("KW1", overhaul.tabs.length >= 2);
  mark(
    "KW2",
    Object.values(overhaul.tabGroups ?? {}).some((group) => !!group.name && !DEFAULT_GROUP_NAME.test(group.name)),
  );
  mark("KW4", !!overhaul.split);
  mark("KW5", overhaul.split?.page.kind === "library" && overhaul.split.page.id === "settings");
  mark("KW7", overhaul.allTabsOpen && !overhaul.desktop);
  return done;
}

/** Everything the app can see, including Home's saved widget list (read from storage, so not per store change). */
export function appDoneThings(): string[] {
  const done = storeDoneThings();
  if (homeHasExtraWidget()) done.push("C10");
  return done;
}

let started = false;

/** Starts watching once per page. Waits for the first list load to set the baseline. */
export function watchThingsToTry() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Store changes are frequent (streaming, typing), so the done list is kept in memory and storage is
  // only touched when something new turns true.
  let known: { started: boolean; done: Set<string> } | null = null;
  const refresh = () => {
    const state = readThingsToTry();
    known = { started: state.started, done: new Set(Object.keys(state.done)) };
  };
  const check = () => {
    if (!known) refresh();
    if (!known?.started) return;
    const fresh = storeDoneThings().filter((id) => !known?.done.has(id));
    if (fresh.length) recordThingsDone(fresh);
  };
  window.addEventListener(THINGS_TO_TRY_CHANGED_EVENT, refresh);
  window.addEventListener("storage", refresh);
  useOverhaulStore.subscribe(check);
  useUIStore.subscribe(check);
}
