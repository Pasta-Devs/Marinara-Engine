// ──────────────────────────────────────────────
// Hook: the seasonal theme worn today, and its greeting
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import {
  readSeasonalPreview,
  resolveSeasonalTheme,
  withSeasonalYear,
  type SeasonalYears,
} from "../lib/seasonal-themes";
import { useUIStore } from "../stores/ui.store";

const DAY_CHECK_INTERVAL_MS = 60_000;

/** Local midnight as a number, so an unchanged day re-renders nothing. */
function startOfLocalDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function useSeasonalTheme() {
  const disabled = useUIStore((state) => state.seasonalThemesDisabled);
  const storedGreeted = useUIStore((state) => state.seasonalGreetingYears);
  const storedOff = useUIStore((state) => state.seasonalThemeOffYears);
  // The preview keeps its greeting and "Turn it off" in memory, so trying it never saves anything.
  const [preview] = useState(() => readSeasonalPreview(window.location.search));
  const [previewGreeted, setPreviewGreeted] = useState<SeasonalYears>({});
  const [previewOff, setPreviewOff] = useState<SeasonalYears>({});
  // Checked every minute, so the costume goes on and comes off at local midnight even while the app stays open.
  const [today, setToday] = useState(startOfLocalDay);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(startOfLocalDay()), DAY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Date(today);
  const year = date.getFullYear();
  const { themeId, showGreeting } = resolveSeasonalTheme({
    date,
    disabled,
    preview,
    greeted: preview ? previewGreeted : storedGreeted,
    turnedOff: preview ? previewOff : storedOff,
  });

  const markGreeted = useCallback(() => {
    if (!themeId) return;
    if (preview) setPreviewGreeted((years) => withSeasonalYear(years, themeId, year));
    else useUIStore.getState().markSeasonalGreetingShown(themeId, year);
  }, [preview, themeId, year]);

  const turnOff = useCallback(() => {
    if (!themeId) return;
    if (preview) setPreviewOff((years) => withSeasonalYear(years, themeId, year));
    else useUIStore.getState().turnOffSeasonalTheme(themeId, year);
  }, [preview, themeId, year]);

  return { themeId, showGreeting, markGreeted, turnOff };
}
