// ──────────────────────────────────────────────
// Seasonal themes: holiday looks that switch on by themselves for one day.
// ──────────────────────────────────────────────
// Each entry is worn for its day on the device's own calendar. App.tsx marks
// <html data-seasonal-theme="<id>">, the look lives in
// styles/themes/seasonal-<id>.css, and SeasonalGreetingModal says hello once a
// year. Adding a holiday means one entry here, its stylesheet and its greeting copy.

export type SeasonalThemeId = "halloween";

export const SEASONAL_THEMES: ReadonlyArray<{ id: SeasonalThemeId; isActive: (date: Date) => boolean }> = [
  // October 31 from 00:00 to 23:59 local time. getMonth() counts from 0.
  { id: "halloween", isActive: (date) => date.getMonth() === 9 && date.getDate() === 31 },
];

/** `?seasonalPreview=halloween` wears that theme and shows its greeting on any date, saving nothing. */
export const SEASONAL_PREVIEW_PARAM = "seasonalPreview";

/** Per theme, the year something happened: its greeting was shown, or it was turned off. */
export type SeasonalYears = Partial<Record<SeasonalThemeId, number>>;

export type SeasonalThemeState = { themeId: SeasonalThemeId | null; showGreeting: boolean };

export function readSeasonalPreview(search: string): SeasonalThemeId | null {
  const requested = new URLSearchParams(search).get(SEASONAL_PREVIEW_PARAM);
  return SEASONAL_THEMES.find((theme) => theme.id === requested)?.id ?? null;
}

/** Records `year` for `id`, keeping the other themes' years. Tolerates a malformed synced value. */
export function withSeasonalYear(years: unknown, id: SeasonalThemeId, year: number): SeasonalYears {
  const previous = years && typeof years === "object" && !Array.isArray(years) ? (years as SeasonalYears) : {};
  return { ...previous, [id]: year };
}

export function resolveSeasonalTheme({
  date,
  disabled,
  turnedOff,
  greeted,
  preview = null,
}: {
  date: Date;
  disabled: boolean;
  turnedOff: SeasonalYears | undefined;
  greeted: SeasonalYears | undefined;
  preview?: SeasonalThemeId | null;
}): SeasonalThemeState {
  const themeId = preview ?? (disabled ? null : (SEASONAL_THEMES.find((theme) => theme.isActive(date))?.id ?? null));
  const year = date.getFullYear();
  if (!themeId || turnedOff?.[themeId] === year) return { themeId: null, showGreeting: false };
  return { themeId, showGreeting: greeted?.[themeId] !== year };
}
