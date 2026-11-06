// ──────────────────────────────────────────────
// Hook: the seasonal theme worn now, and its greeting
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { seasonalThemeFor, seasonYear } from "../lib/seasonal-themes";
import { useUIStore } from "../stores/ui.store";

const MINUTE_MS = 60_000;

/** The current minute as a number, so an unchanged minute re-renders nothing. */
function startOfMinute() {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

/** Ticks once a minute, so dated windows open and close on time even while the app stays open. */
export function useMinuteClock(): Date {
  const [minute, setMinute] = useState(startOfMinute);
  useEffect(() => {
    const timer = window.setInterval(() => setMinute(startOfMinute()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return new Date(minute);
}

export function useSeasonalTheme() {
  const date = useMinuteClock();
  // The `?seasonalPreview=` page keeps its greeting and "Turn it off" in the store, unsaved, so trying it never
  // saves anything and Professor Mari's dated pack sees them too.
  const { themeId, showGreeting } = useUIStore(useShallow((state) => seasonalThemeFor(state, date)));
  const year = themeId ? seasonYear(themeId, date) : date.getFullYear();

  const markGreeted = useCallback(() => {
    if (themeId) useUIStore.getState().markSeasonalGreetingShown(themeId, year);
  }, [themeId, year]);

  const turnOff = useCallback(() => {
    if (themeId) useUIStore.getState().turnOffSeasonalTheme(themeId, year);
  }, [themeId, year]);

  return { themeId, showGreeting, markGreeted, turnOff };
}
