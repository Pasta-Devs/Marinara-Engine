import type { CSSProperties } from "react";
import type { GameState } from "../../../../engine/contracts/types/game-state";
import {
  getLocationPinColor,
  getTemperatureColor,
  getTemperatureGaugeDisplay,
  getTemperatureKeywordHint,
  getWeatherEmoji,
  getWorldDateDisplay,
  getWorldTimeDisplay,
  parseTemperatureValue,
} from "../../world-state/index";
import { visibleText } from "./tracker-display.helpers";

export {
  getLocationPinColor,
  getTemperatureColor,
  getTemperatureGaugeDisplay,
  getTemperatureKeywordHint,
  getWeatherEmoji,
  getWorldDateDisplay,
  getWorldTimeDisplay,
  parseTemperatureValue,
};

export const WORLD_GRID_BASE_CLASS = "grid-cols-[2.5rem_2.5rem_minmax(0,1fr)]";
export const WORLD_FREEFORM_DATE_GRID_BASE_CLASS = "grid-cols-[minmax(3.8rem,4.45rem)_2.5rem_minmax(0,1fr)]";
const WORLD_GRID_BALANCED_CLASS =
  "@min-[380px]:grid-cols-[2.5rem_2.5rem_minmax(6.25rem,1fr)_minmax(7.5rem,1.35fr)]";
const WORLD_GRID_FORECAST_HEAVY_CLASS =
  "@min-[380px]:grid-cols-[2.5rem_2.5rem_minmax(7rem,1.05fr)_minmax(7.25rem,1.2fr)]";
const WORLD_GRID_LOCATION_HEAVY_CLASS =
  "@min-[380px]:grid-cols-[2.5rem_2.5rem_minmax(7rem,0.95fr)_minmax(9rem,1.45fr)]";
const WORLD_FREEFORM_DATE_GRID_BALANCED_CLASS =
  "@min-[380px]:grid-cols-[minmax(4.1rem,4.7rem)_2.5rem_minmax(5rem,0.86fr)_minmax(7.25rem,1.35fr)]";
const WORLD_FREEFORM_DATE_GRID_FORECAST_HEAVY_CLASS =
  "@min-[380px]:grid-cols-[minmax(4.1rem,4.7rem)_2.5rem_minmax(5.75rem,1fr)_minmax(6.75rem,1.1fr)]";
const WORLD_FREEFORM_DATE_GRID_LOCATION_HEAVY_CLASS =
  "@min-[380px]:grid-cols-[minmax(4.1rem,4.7rem)_2.5rem_minmax(5rem,0.75fr)_minmax(8.25rem,1.45fr)]";

type WorldDashboardGridClassOptions = {
  hasFreeformDate?: boolean;
};

function getWorldTileTextNeed(value: string | null | undefined, fallback: string) {
  const text = visibleText(value, fallback).replace(/\s+/g, " ");
  const longestWord = text.split(" ").reduce((longest, word) => Math.max(longest, word.length), 0);
  return text.length + longestWord * 0.7;
}

export function getWorldDashboardGridClass(
  weather: string | null | undefined,
  temperature: string | null | undefined,
  location: string | null | undefined,
  options: WorldDashboardGridClassOptions = {},
) {
  const { hasFreeformDate = false } = options;
  const forecastNeed =
    getWorldTileTextNeed(weather, "Set weather") + Math.min(8, getWorldTileTextNeed(temperature, "--") * 0.35);
  const locationNeed = getWorldTileTextNeed(location, "Set location");
  const hasLocation = visibleText(location, "").length > 0;
  if (hasLocation && locationNeed >= forecastNeed + 2) {
    return hasFreeformDate ? WORLD_FREEFORM_DATE_GRID_LOCATION_HEAVY_CLASS : WORLD_GRID_LOCATION_HEAVY_CLASS;
  }
  if (forecastNeed >= locationNeed + 4) {
    return hasFreeformDate ? WORLD_FREEFORM_DATE_GRID_FORECAST_HEAVY_CLASS : WORLD_GRID_FORECAST_HEAVY_CLASS;
  }
  if (hasLocation && locationNeed >= forecastNeed + 6) {
    return hasFreeformDate ? WORLD_FREEFORM_DATE_GRID_LOCATION_HEAVY_CLASS : WORLD_GRID_LOCATION_HEAVY_CLASS;
  }
  return hasFreeformDate ? WORLD_FREEFORM_DATE_GRID_BALANCED_CLASS : WORLD_GRID_BALANCED_CLASS;
}

export function getWorldAmbienceStyle(state: GameState | null): CSSProperties {
  const weather = (state?.weather ?? "").toLowerCase();
  const location = (state?.location ?? "").toLowerCase();
  const time = (state?.time ?? "").toLowerCase();
  const temperature = (state?.temperature ?? "").toLowerCase();
  const tempValue = parseTemperatureValue(state?.temperature) ?? getTemperatureKeywordHint(state?.temperature);
  let primary = "var(--primary)";
  let secondary = "var(--accent)";
  let primaryMix = 20;
  let secondaryMix = 22;

  if (weather.includes("rain") || weather.includes("storm") || weather.includes("thunder")) {
    primary = "rgb(56 189 248)";
    secondary = "rgb(59 130 246)";
    primaryMix = 24;
    secondaryMix = 30;
  } else if (
    weather.includes("snow") ||
    weather.includes("frost") ||
    weather.includes("blizzard") ||
    (tempValue !== null && tempValue < 4)
  ) {
    primary = "rgb(186 230 253)";
    secondary = "rgb(96 165 250)";
    primaryMix = 18;
    secondaryMix = 24;
  } else if (
    weather.includes("fire") ||
    weather.includes("ash") ||
    weather.includes("sunny") ||
    temperature.includes("hot") ||
    (tempValue !== null && tempValue > 32) ||
    /\b(desert|waste|volcano|forge|lava|dune)\b/.test(location)
  ) {
    primary = "rgb(245 158 11)";
    secondary = "rgb(244 63 94)";
    primaryMix = 24;
    secondaryMix = 26;
  } else if (/\b(night|midnight|dusk|moon|evening)\b/.test(time)) {
    primary = "rgb(129 140 248)";
    secondary = "rgb(168 85 247)";
    primaryMix = 22;
    secondaryMix = 26;
  } else if (/\b(forest|grove|garden|field|meadow|wild|trail|river|lake|sea|shore)\b/.test(location)) {
    primary = "rgb(52 211 153)";
    secondary = "rgb(132 204 22)";
    primaryMix = 18;
    secondaryMix = 20;
  } else if (/\b(city|market|inn|tavern|castle|room|hall|tower|street|shop|temple)\b/.test(location)) {
    primary = "var(--primary)";
    secondary = "rgb(168 85 247)";
    primaryMix = 22;
    secondaryMix = 20;
  }

  return {
    background:
      `linear-gradient(135deg, color-mix(in srgb, color-mix(in srgb, var(--card) ${100 - primaryMix}%, ${primary} ${primaryMix}%) 58%, transparent), ` +
      `color-mix(in srgb, color-mix(in srgb, var(--background) ${100 - secondaryMix}%, ${secondary} ${secondaryMix}%) 52%, transparent))`,
  };
}
