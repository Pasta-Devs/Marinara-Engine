import type { CSSProperties } from "react";
import type { TrackerTemperatureUnit } from "../../../stores/ui.store";
import {
  classifyWorldWeather,
  getTemperatureGaugeDisplay,
  getWorldTimeDisplay,
  type WorldWeatherFamily,
} from "../../../lib/world-state-helpers";
import { visibleText } from "./tracker-display";

export type WorldSceneGlyph = "sun" | "moon" | "cloud" | "rain" | "snow" | "storm" | "fog" | "wind" | "fire";
type WorldSceneTone = "warm" | "cool" | "muted" | "neutral";
type WorldTimeDisplay = ReturnType<typeof getWorldTimeDisplay>;
type WorldTimeOfDay = WorldTimeDisplay["timeOfDay"];

interface WorldScenePresentation {
  glyph?: WorldSceneGlyph;
  tone: WorldSceneTone;
}

interface TrackerWeatherStyle {
  tone: string;
  accent: string;
  scene?: WorldScenePresentation;
}

/**
 * Select one conservative cue for the whole scene. Individual field
 * presentations remain authoritative; this is only a compact, optional hint.
 */
function getWorldScenePresentation({
  time,
  weatherFamily,
  weatherText,
}: {
  time: WorldTimeDisplay;
  weatherFamily: WorldWeatherFamily;
  weatherText: string;
}): WorldScenePresentation {
  const normalizedWeather = weatherText.toLowerCase();
  const mentionsDay = /\b(day|daylight|morning|noon|afternoon|sunrise|sunny|sunlit)\b/.test(normalizedWeather);
  const mentionsNight = /\b(night|nighttime|midnight|evening|dusk|moonlit|starlit)\b/.test(normalizedWeather);
  const hasTimeConflict =
    (time.timeOfDay === "night" && mentionsDay) ||
    ((time.timeOfDay === "dawn" || time.timeOfDay === "day") && mentionsNight);

  if (hasTimeConflict) return { tone: "neutral" };

  if (weatherFamily === "clear") {
    if (time.timeOfDay === "night") return { glyph: "moon", tone: "cool" };
    if (time.timeOfDay === "dawn" || time.timeOfDay === "day") {
      return { glyph: "sun", tone: "warm" };
    }
  }

  const configuredScene = TRACKER_WEATHER_STYLES[weatherFamily].scene;
  if (configuredScene) return configuredScene;
  if (time.timeOfDay === "night") return { glyph: "moon", tone: "cool" };

  return { tone: "neutral" };
}

interface WorldStateInputs {
  time?: string | null;
  weather?: string | null;
  temperature?: string | null;
}

type WorldAmbienceStyle = CSSProperties & Record<`--${string}`, string | number>;

const WORLD_TIME_TONE: Record<WorldTimeOfDay, string> = {
  dawn: "color-mix(in srgb, var(--primary) 15%, transparent)",
  day: "color-mix(in srgb, var(--foreground) 8%, transparent)",
  dusk: "color-mix(in srgb, color-mix(in srgb, var(--primary) 70%, var(--destructive) 30%) 15%, transparent)",
  night: "color-mix(in srgb, var(--accent) 18%, transparent)",
  unknown: "transparent",
};

const WORLD_TIME_ACCENT: Record<WorldTimeOfDay, string> = {
  dawn: "oklch(0.8 0.13 72)",
  day: "oklch(0.82 0.055 225)",
  dusk: "oklch(0.72 0.135 38)",
  night: "oklch(0.7 0.12 255)",
  unknown: "var(--muted-foreground)",
};

const TRACKER_WEATHER_STYLES: Record<WorldWeatherFamily, TrackerWeatherStyle> = {
  thunder: {
    tone: "color-mix(in srgb, var(--muted-foreground) 16%, transparent)",
    accent: "oklch(0.68 0.14 285)",
    scene: { glyph: "storm", tone: "muted" },
  },
  blizzard: {
    tone: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    accent: "oklch(0.86 0.07 220)",
    scene: { glyph: "snow", tone: "cool" },
  },
  "heavy-rain": {
    tone: "color-mix(in srgb, var(--muted-foreground) 16%, transparent)",
    accent: "oklch(0.68 0.14 285)",
    scene: { glyph: "storm", tone: "muted" },
  },
  rain: {
    tone: "color-mix(in srgb, var(--primary) 10%, transparent)",
    accent: "oklch(0.7 0.13 235)",
    scene: { glyph: "rain", tone: "cool" },
  },
  hail: {
    tone: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    accent: "oklch(0.86 0.07 220)",
    scene: { glyph: "snow", tone: "cool" },
  },
  snow: {
    tone: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    accent: "oklch(0.86 0.07 220)",
    scene: { glyph: "snow", tone: "cool" },
  },
  fog: {
    tone: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)",
    accent: "oklch(0.72 0.035 240)",
    scene: { glyph: "fog", tone: "muted" },
  },
  sand: {
    tone: "color-mix(in srgb, var(--destructive) 9%, transparent)",
    accent: "oklch(0.76 0.12 72)",
    scene: { glyph: "wind", tone: "warm" },
  },
  ash: {
    tone: "color-mix(in srgb, var(--muted-foreground) 14%, transparent)",
    accent: "oklch(0.62 0.025 250)",
    scene: { glyph: "fog", tone: "muted" },
  },
  fire: {
    tone: "color-mix(in srgb, var(--destructive) 12%, transparent)",
    accent: "oklch(0.73 0.17 44)",
    scene: { glyph: "fire", tone: "warm" },
  },
  wind: {
    tone: "color-mix(in srgb, var(--foreground) 7%, transparent)",
    accent: "oklch(0.76 0.09 210)",
    scene: { glyph: "wind", tone: "cool" },
  },
  blossom: {
    tone: "color-mix(in srgb, var(--primary) 10%, transparent)",
    accent: "oklch(0.78 0.12 15)",
    scene: { glyph: "sun", tone: "warm" },
  },
  aurora: {
    tone: "color-mix(in srgb, var(--accent) 15%, transparent)",
    accent: "oklch(0.76 0.13 190)",
    scene: { glyph: "moon", tone: "cool" },
  },
  cloud: {
    tone: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)",
    accent: "oklch(0.7 0.035 235)",
    scene: { glyph: "cloud", tone: "muted" },
  },
  clear: {
    tone: "color-mix(in srgb, var(--primary) 9%, transparent)",
    accent: "oklch(0.81 0.12 85)",
  },
  heat: {
    tone: "color-mix(in srgb, var(--destructive) 12%, transparent)",
    accent: "oklch(0.7 0.17 38)",
    scene: { glyph: "fire", tone: "warm" },
  },
  cold: {
    tone: "color-mix(in srgb, var(--primary) 9%, transparent)",
    accent: "oklch(0.74 0.11 235)",
    scene: { glyph: "snow", tone: "cool" },
  },
  atmosphere: {
    tone: "transparent",
    accent: "var(--muted-foreground)",
  },
};

const WORLD_SCENE_INK: Record<WorldSceneTone, string> = {
  cool: "oklch(0.76 0.105 232)",
  warm: "oklch(0.79 0.125 76)",
  muted: "color-mix(in oklch, var(--muted-foreground) 78%, var(--foreground) 22%)",
  neutral: "color-mix(in oklch, var(--muted-foreground) 64%, var(--foreground) 36%)",
};

function getWorldAmbienceStyle({
  time,
  weatherFamily,
  hasWeatherText,
  temperature,
  scene,
}: {
  time: WorldTimeDisplay;
  weatherFamily: WorldWeatherFamily;
  hasWeatherText: boolean;
  temperature: ReturnType<typeof getTemperatureGaugeDisplay>;
  scene: WorldScenePresentation;
}): WorldAmbienceStyle {
  const weatherStyle = TRACKER_WEATHER_STYLES[weatherFamily];
  const sceneInk = WORLD_SCENE_INK[scene.tone];
  const temperatureTone =
    temperature.value === null ? "transparent" : `color-mix(in srgb, ${temperature.color} 8%, transparent)`;
  const hasAtmosphere =
    time.timeOfDay !== "unknown" ||
    weatherFamily !== "atmosphere" ||
    temperature.value !== null;

  return {
    background: "var(--tracker-panel-section-background, color-mix(in srgb, var(--card) 6%, transparent))",
    "--tracker-world-time-tone": WORLD_TIME_TONE[time.timeOfDay],
    "--tracker-world-weather-tone": weatherStyle.tone,
    "--tracker-world-temperature-tone": temperatureTone,
    "--tracker-world-time-accent": time.timeOfDay === "unknown" ? sceneInk : WORLD_TIME_ACCENT[time.timeOfDay],
    "--tracker-world-weather-accent": hasWeatherText ? weatherStyle.accent : sceneInk,
    "--tracker-world-temperature-accent": temperature.value !== null ? temperature.color : sceneInk,
    "--tracker-world-scene-ink": sceneInk,
    "--tracker-world-scene-wash": `color-mix(in oklch, ${sceneInk} 16%, transparent)`,
    "--tracker-world-scene-stroke": `color-mix(in oklch, ${sceneInk} 34%, transparent)`,
    "--tracker-world-atmosphere-opacity": hasAtmosphere ? "0.78" : "0.36",
  };
}

export function getWorldStatePresentation(
  inputs: WorldStateInputs = {},
  temperatureUnit: TrackerTemperatureUnit = "celsius",
) {
  const time = getWorldTimeDisplay(inputs.time);
  const weatherText = visibleText(inputs.weather, "");
  const weatherFamily = classifyWorldWeather(weatherText);
  const temperature = getTemperatureGaugeDisplay(inputs.temperature, temperatureUnit);
  const scene = getWorldScenePresentation({ time, weatherFamily, weatherText });

  return {
    time,
    weatherText,
    temperature,
    sceneGlyph: scene.glyph,
    ambienceStyle: getWorldAmbienceStyle({
      time,
      weatherFamily,
      hasWeatherText: Boolean(weatherText),
      temperature,
      scene,
    }),
  } as const;
}

export type WorldStatePresentation = ReturnType<typeof getWorldStatePresentation>;
