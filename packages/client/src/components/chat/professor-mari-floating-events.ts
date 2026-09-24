export const PROFESSOR_MARI_FLOATING_SHOW_EVENT = "marinara:professor-mari-floating-show";
export const PROFESSOR_MARI_FLOATING_HIDE_EVENT = "marinara:professor-mari-floating-hide";
export const PROFESSOR_MARI_FLOATING_STORAGE_KEY = "marinara:professor-mari-floating-enabled";

export type ProfessorMariFloatingEventType =
  typeof PROFESSOR_MARI_FLOATING_SHOW_EVENT | typeof PROFESSOR_MARI_FLOATING_HIDE_EVENT;

export function readProfessorMariFloatingEnabled() {
  try {
    return window.localStorage.getItem(PROFESSOR_MARI_FLOATING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasProfessorMariFloatingFollowup() {
  return readProfessorMariFloatingEnabled();
}

export function rememberProfessorMariFloatingEnabled(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(PROFESSOR_MARI_FLOATING_STORAGE_KEY, "1");
    else window.localStorage.removeItem(PROFESSOR_MARI_FLOATING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function dispatchProfessorMariFloatingEvent(type: ProfessorMariFloatingEventType) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(type));
}
