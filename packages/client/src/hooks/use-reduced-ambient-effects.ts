import { useSyncExternalStore } from "react";
import { useUIStore } from "../stores/ui.store";

let reducedMotionQuery: MediaQueryList | null = null;
const reducedMotionListeners = new Set<() => void>();

function getReducedMotionQuery(): MediaQueryList | null {
  if (reducedMotionQuery) return reducedMotionQuery;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery;
}

function notifyReducedMotionListeners() {
  reducedMotionListeners.forEach((listener) => listener());
}

function subscribeToReducedMotion(listener: () => void) {
  reducedMotionListeners.add(listener);
  const query = getReducedMotionQuery();
  if (query && reducedMotionListeners.size === 1) {
    query.addEventListener("change", notifyReducedMotionListeners);
  }
  return () => {
    reducedMotionListeners.delete(listener);
    if (query && reducedMotionListeners.size === 0) {
      query.removeEventListener("change", notifyReducedMotionListeners);
    }
  };
}

function getSystemPreference(): boolean {
  return getReducedMotionQuery()?.matches === true;
}

export function useReducedAmbientEffects(): boolean {
  const manualPreference = useUIStore((state) => state.reduceAmbientEffects);
  const systemPreference = useSyncExternalStore(subscribeToReducedMotion, getSystemPreference, () => false);

  return manualPreference || systemPreference;
}
