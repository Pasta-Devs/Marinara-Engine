import { parseBackgroundWeatherVersionName } from "@marinara-engine/shared";

type Localize = (key: string, options?: Record<string, unknown>) => string;

/**
 * What a weather or time of day version shows, such as "rain at night" or "night". The weather is
 * the story's own word; the time words are localized. Empty for a plain picture.
 */
export function backgroundVersionLabel(filename: string, localizeUi: Localize): string {
  const { version, time } = parseBackgroundWeatherVersionName(filename);
  const weather = version.replace(/-/gu, " ");
  if (weather && time) return localizeUi(`ui.panels.backgroundpicker.versionWeatherAtTime.${time}`, { weather });
  if (time) return localizeUi(`ui.panels.backgroundpicker.versionTime.${time}`);
  return weather;
}
