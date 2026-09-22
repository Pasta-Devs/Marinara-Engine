import { z } from "zod";

export const GAME_DIFFICULTIES = ["casual", "normal", "hard", "brutal"] as const;
export type GameDifficulty = (typeof GAME_DIFFICULTIES)[number];
/** Older setups stored display labels; unknown imported values retain Normal rules. */
export function normalizeGameDifficulty(value: unknown): GameDifficulty {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return GAME_DIFFICULTIES.includes(key as GameDifficulty) ? (key as GameDifficulty) : "normal";
}
/** Traditional/legacy Engine rules only. Alternative rulesets must supply their own difficulty policy;
 * do not carry these damage multipliers into 5e, V20, or another ruleset by default. */
export const ENEMY_DAMAGE_MULTIPLIERS: Record<GameDifficulty, number> = {
  casual: 0.6,
  normal: 1,
  hard: 1.3,
  brutal: 1.6,
};
/** Changes decision consistency, never personality, legality or companion competence. */
export const ENEMY_AI_VARIATION: Record<GameDifficulty, number> = {
  casual: 2.5,
  normal: 1,
  hard: 0.4,
  brutal: 0.15,
};

export const WEATHER_TYPES = [
  "clear",
  "cloudy",
  "overcast",
  "rain",
  "heavy_rain",
  "storm",
  "snow",
  "blizzard",
  "fog",
  "wind",
  "hail",
  "sandstorm",
  "heat_wave",
] as const;
export type WeatherType = (typeof WEATHER_TYPES)[number];
export function normalizeWeatherType(value: unknown): WeatherType | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  const aliases: Record<string, WeatherType> = {
    rainy: "rain",
    snowy: "snow",
    windy: "wind",
    stormy: "storm",
    foggy: "fog",
    sunny: "clear",
  };
  return WEATHER_TYPES.includes(key as WeatherType)
    ? (key as WeatherType)
    : Object.hasOwn(aliases, key)
      ? aliases[key]
      : undefined;
}
export const combatWeatherSchema = z.object({
  version: z.literal(1),
  type: z.enum(WEATHER_TYPES),
  wind: z.enum(["calm", "breezy", "windy", "gale"]),
  visibility: z.enum(["clear", "reduced", "poor"]),
  exposure: z.enum(["exposed", "sheltered", "unknown"]),
});
export type CombatWeather = z.infer<typeof combatWeatherSchema>;
export interface CombatAttackTraits {
  projectile?: boolean;
  requiresSight?: boolean;
}
/** Engine weather rules use explicit traits, never translated ability names. */
export function combatWeatherEffects(weather?: CombatWeather) {
  const exposed = weather?.exposure === "exposed";
  const wet = exposed && ["rain", "heavy_rain", "storm"].includes(weather.type);
  return {
    fireMultiplier: wet ? 0.85 : 1,
    lightningMultiplier: wet ? 1.15 : 1,
    projectilePenalty: exposed ? (weather.wind === "gale" ? 15 : weather.wind === "windy" ? 10 : 0) : 0,
    sightPenalty: exposed ? (weather.visibility === "poor" ? 15 : weather.visibility === "reduced" ? 5 : 0) : 0,
    walkingCost: exposed && ["snow", "blizzard"].includes(weather.type) ? 1 : 0,
  };
}
/** Percentage points, bounded so weather never makes a legal attack impossible. */
export function weatherHitPenalty(weather: CombatWeather | undefined, traits: CombatAttackTraits): number {
  const effects = combatWeatherEffects(weather);
  return Math.min(
    25,
    (traits.projectile ? effects.projectilePenalty : 0) + (traits.requiresSight ? effects.sightPenalty : 0),
  );
}
export function weatherDamageMultiplier(weather: CombatWeather | undefined, element?: string): number {
  const effects = combatWeatherEffects(weather);
  return element?.toLowerCase() === "fire"
    ? effects.fireMultiplier
    : element?.toLowerCase() === "lightning"
      ? effects.lightningMultiplier
      : 1;
}

/** Classic uses opposed d20 rolls; five percentage points become one roll modifier. */
export function classicAttackModifier(
  attack: number,
  weather: CombatWeather | undefined,
  traits: CombatAttackTraits,
): number {
  return Math.floor(attack / 3) - Math.ceil(weatherHitPenalty(weather, traits) / 5);
}
/** Exact hit probability for opposed rolls, without consuming the combat RNG. */
export function classicHitProbability(
  attack: number,
  defense: number,
  weather: CombatWeather | undefined,
  traits: CombatAttackTraits,
): number {
  const difference = classicAttackModifier(attack, weather, traits) - Math.floor(defense / 3);
  let hits = 0;
  for (let roll = 1; roll <= 20; roll++) hits += Math.max(0, Math.min(20, roll + difference));
  return hits / 400;
}
