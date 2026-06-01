// ──────────────────────────────────────────────
// Game: Weather Progression Service
//
// Deterministic weather generation from weighted
// tables per biome and season. No LLM needed.
// ──────────────────────────────────────────────

type WeatherType =
  | "clear"
  | "cloudy"
  | "overcast"
  | "rain"
  | "heavy_rain"
  | "storm"
  | "snow"
  | "blizzard"
  | "fog"
  | "wind"
  | "hail"
  | "sandstorm"
  | "heat_wave";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Biome = "temperate" | "tropical" | "arctic" | "desert" | "mountain" | "coastal" | "underground" | "urban";

export interface WeatherState {
  type: WeatherType;
  temperature: number;
  description: string;
  /** Wind speed: calm, breezy, windy, gale */
  wind: "calm" | "breezy" | "windy" | "gale";
  /** Visibility: clear, reduced, poor */
  visibility: "clear" | "reduced" | "poor";
}

// ── Weather Tables ──

/** Weighted weather distribution per biome. */
const BIOME_WEATHER: Record<Biome, Partial<Record<WeatherType, number>>> = {
  temperate: { clear: 30, cloudy: 25, overcast: 15, rain: 15, fog: 5, wind: 5, storm: 3, snow: 2 },
  tropical: { clear: 25, cloudy: 20, rain: 25, heavy_rain: 15, storm: 10, fog: 3, heat_wave: 2 },
  arctic: { clear: 10, cloudy: 15, overcast: 15, snow: 25, blizzard: 15, fog: 10, wind: 10 },
  desert: { clear: 40, heat_wave: 20, sandstorm: 15, wind: 15, cloudy: 10 },
  mountain: { clear: 20, cloudy: 20, overcast: 15, wind: 15, fog: 10, snow: 10, storm: 5, blizzard: 5 },
  coastal: { clear: 25, cloudy: 20, fog: 15, wind: 15, rain: 10, storm: 10, overcast: 5 },
  underground: { clear: 100 }, // underground has no weather variation
  urban: { clear: 25, cloudy: 25, overcast: 15, rain: 15, fog: 10, wind: 5, storm: 5 },
};

/** Season modifiers (added to base weights). */
const SEASON_MODIFIERS: Record<Season, Partial<Record<WeatherType, number>>> = {
  spring: { rain: 10, fog: 5, clear: -5 },
  summer: { clear: 15, heat_wave: 5, storm: 5, snow: -15, blizzard: -15 },
  autumn: { overcast: 10, fog: 10, wind: 5, rain: 5, clear: -10 },
  winter: { snow: 15, blizzard: 5, fog: 5, clear: -10, rain: -5, heat_wave: -10 },
};

/** Base temperature ranges °C per biome. */
const BASE_TEMP: Record<Biome, [number, number]> = {
  temperate: [5, 28],
  tropical: [22, 38],
  arctic: [-30, 5],
  desert: [15, 50],
  mountain: [-10, 18],
  coastal: [10, 30],
  underground: [12, 18],
  urban: [8, 32],
};

/** Weather → description templates. */
const DESCRIPTIONS: Record<WeatherType, string[]> = {
  clear: ["Clear skies stretch overhead.", "The sky is bright and cloudless.", "A beautiful clear day."],
  cloudy: ["Scattered clouds drift across the sky.", "A partly cloudy sky hangs above."],
  overcast: ["Grey clouds blanket the sky.", "A thick overcast covers everything."],
  rain: ["A steady rain falls.", "Raindrops patter against every surface."],
  heavy_rain: ["Heavy rain pours down in sheets.", "A torrential downpour drenches everything."],
  storm: ["Thunder rumbles as lightning splits the sky.", "A violent storm rages overhead."],
  snow: ["Gentle snowflakes drift down.", "A light snowfall dusts the ground."],
  blizzard: ["A howling blizzard reduces visibility to nothing.", "Wind-driven snow blinds everything."],
  fog: ["A thick fog clings to the ground.", "Mist swirls through the air, limiting sight."],
  wind: ["Strong gusts whip through the area.", "The wind howls relentlessly."],
  hail: ["Pellets of ice clatter from the sky.", "Hailstones bounce off every surface."],
  sandstorm: ["Sand swirls in blinding clouds.", "A choking sandstorm obscures everything."],
  heat_wave: ["The air shimmers with oppressive heat.", "A relentless heat wave bakes the land."],
};

/** Weather → wind intensity mapping. */
const WEATHER_WIND: Record<WeatherType, Array<"calm" | "breezy" | "windy" | "gale">> = {
  clear: ["calm", "breezy"],
  cloudy: ["calm", "breezy"],
  overcast: ["calm", "breezy"],
  rain: ["breezy", "windy"],
  heavy_rain: ["windy", "gale"],
  storm: ["windy", "gale"],
  snow: ["calm", "breezy", "windy"],
  blizzard: ["gale"],
  fog: ["calm"],
  wind: ["windy", "gale"],
  hail: ["windy", "gale"],
  sandstorm: ["gale"],
  heat_wave: ["calm", "breezy"],
};

/** Weather → visibility mapping. */
const WEATHER_VIS: Record<WeatherType, Array<"clear" | "reduced" | "poor">> = {
  clear: ["clear"],
  cloudy: ["clear"],
  overcast: ["clear", "reduced"],
  rain: ["reduced"],
  heavy_rain: ["reduced", "poor"],
  storm: ["poor"],
  snow: ["reduced"],
  blizzard: ["poor"],
  fog: ["poor"],
  wind: ["clear", "reduced"],
  hail: ["reduced"],
  sandstorm: ["poor"],
  heat_wave: ["clear", "reduced"],
};

// ── Core Functions ──

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Generate weather for a given biome and season. */
export function generateWeather(biome: Biome, season: Season = "summer"): WeatherState {
  const baseWeights = { ...BIOME_WEATHER[biome] };
  const mods = SEASON_MODIFIERS[season] ?? {};

  // Apply seasonal modifiers
  for (const [type, mod] of Object.entries(mods)) {
    const key = type as WeatherType;
    if (baseWeights[key] !== undefined) {
      baseWeights[key] = Math.max(0, (baseWeights[key] ?? 0) + mod);
    }
  }

  // Weighted random selection
  const entries = Object.entries(baseWeights).filter(([, w]) => w && w > 0);
  const total = entries.reduce((s, [, w]) => s + (w ?? 0), 0);
  let roll = Math.random() * total;

  let weatherType: WeatherType = "clear";
  for (const [type, weight] of entries) {
    roll -= weight ?? 0;
    if (roll <= 0) {
      weatherType = type as WeatherType;
      break;
    }
  }

  // Temperature
  const [minT, maxT] = BASE_TEMP[biome] ?? [10, 25];
  const seasonTempMod: Record<Season, number> = { spring: 0, summer: 5, autumn: -3, winter: -10 };
  const weatherTempMod: Partial<Record<WeatherType, number>> = {
    clear: 2,
    heat_wave: 8,
    storm: -3,
    snow: -5,
    blizzard: -10,
    rain: -2,
    fog: -1,
  };
  const baseTempRange = maxT - minT;
  const temperature = Math.round(
    minT + Math.random() * baseTempRange + (seasonTempMod[season] ?? 0) + (weatherTempMod[weatherType] ?? 0),
  );

  return {
    type: weatherType,
    temperature,
    description: pick(DESCRIPTIONS[weatherType] ?? DESCRIPTIONS.clear!),
    wind: pick(WEATHER_WIND[weatherType] ?? ["calm"]),
    visibility: pick(WEATHER_VIS[weatherType] ?? ["clear"]),
  };
}

/** Infer biome from location string (heuristic). */
export function inferBiome(location: string): Biome {
  const lower = location.toLowerCase();
  if (/arctic|tundra|frozen|ice|glacier/.test(lower)) return "arctic";
  if (/desert|sand|dune|oasis|wasteland/.test(lower)) return "desert";
  if (/mountain|peak|summit|highland|cliff/.test(lower)) return "mountain";
  if (/coast|beach|harbor|port|sea|ocean|shore/.test(lower)) return "coastal";
  if (/jungle|tropic|swamp|marsh/.test(lower)) return "tropical";
  if (/cave|cavern|mine|underground|dungeon|cellar|crypt|tomb/.test(lower)) return "underground";
  if (/city|town|village|market|tavern|inn|castle|fortress|tower/.test(lower)) return "urban";
  return "temperate";
}
