// ──────────────────────────────────────────────
// Seasonal themes: holiday looks that switch on by themselves for a few days.
// ──────────────────────────────────────────────
// Each entry is worn for its window on the device's own clock. App.tsx marks
// <html data-seasonal-theme="<id>">, the look lives in
// styles/themes/seasonal-<id>.css, and SeasonalGreetingModal says hello once a
// year. Adding a holiday means one entry here, its stylesheet and its greeting copy.

/** A dated window on the device's local clock: "MM-DD HH:mm", `from` inclusive, `to` exclusive. */
export interface MariSeason {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthDayTime = (now: Date) =>
  `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

// ponytail: string compare, so a window cannot wrap New Year; split it in two if one ever must.
export function isInMariSeason(season: MariSeason, now: Date = new Date()): boolean {
  const today = monthDayTime(now);
  return today >= season.from && today < season.to;
}

/** Halloween: October 30 00:00 until November 1 12:00, for the theme and Professor Mari's dated pack alike. */
export const HALLOWEEN_SEASON: MariSeason = { from: "10-30 00:00", to: "11-01 12:00" };

export type SeasonalThemeId = "halloween";

export const SEASONAL_THEMES: ReadonlyArray<{ id: SeasonalThemeId; isActive: (date: Date) => boolean }> = [
  { id: "halloween", isActive: (date) => isInMariSeason(HALLOWEEN_SEASON, date) },
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

/** What a `?seasonalPreview=` page load has done so far. The UI store holds it and never saves or syncs it. */
export type SeasonalPreview = { themeId: SeasonalThemeId; greeted: SeasonalYears; turnedOff: SeasonalYears };

/** The UI store's seasonal settings (stores/ui.store.ts). */
export type SeasonalSettings = {
  seasonalThemesDisabled: boolean;
  seasonalGreetingYears: SeasonalYears;
  seasonalThemeOffYears: SeasonalYears;
  seasonalPreview: SeasonalPreview | null;
};

/**
 * `resolveSeasonalTheme` for the UI store's settings: a preview uses its own unsaved records. App.tsx wears the
 * result and Professor Mari's dated appearance packs follow its `themeId`, so both switch on and off together.
 */
export function seasonalThemeFor(settings: SeasonalSettings, date: Date = new Date()): SeasonalThemeState {
  const preview = settings.seasonalPreview;
  return resolveSeasonalTheme({
    date,
    disabled: settings.seasonalThemesDisabled,
    preview: preview?.themeId ?? null,
    greeted: preview ? preview.greeted : settings.seasonalGreetingYears,
    turnedOff: preview ? preview.turnedOff : settings.seasonalThemeOffYears,
  });
}
