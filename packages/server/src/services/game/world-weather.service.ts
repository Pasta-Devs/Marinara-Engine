// ──────────────────────────────────────────────
// Game: the weather where the party is (user, 2026-11-13: "is weather reflected realistically in desert
// regions and so on"). A game with a world reads its climate from the map cell the party stands on
// (shared climate.ts); one without reads the old biome from the place's name. Either way the weather
// follows the game's clock and drifts rather than being rolled fresh, the season is the place's own (the
// south's summer, the tropics' wet season), and a weather the Game Master asks for is fitted to the place.
// ──────────────────────────────────────────────
import {
  gameStoryFromMetadata,
  readStoryLedger,
  storySeasonAt,
  storyState,
  worldClimateAt,
  worldClimateOfBiome,
  worldWeatherAt,
  worldWeatherFit,
  worldWeatherNote,
  WORLD_CLIMATE_LABELS,
  type WeatherType,
  type WorldClimate,
  type WorldClimateZone,
  type WorldSeason,
  type WorldWeather,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { loadGameWorld } from "./game-world.service.js";
import { gamePartyPlace } from "./made-battlefield.service.js";
import { createInitialTime, type GameTime } from "./time.service.js";
import { inferBiome, weatherDescription, type WeatherState } from "./weather.service.js";

/** How long a weather the Game Master set holds before the sky takes over again (game minutes). */
export const GAME_WEATHER_FORCED_MINUTES = 8 * 60;

/** What the chat keeps as `gameWeather`: the old shape, plus where it came from. */
export interface GameWeatherState extends WeatherState {
  climate?: { zone: WorldClimateZone; label: string; season: WorldSeason; seasonLabel: string };
  /** One line for the Game Master on the climate and what cannot happen here now. */
  note?: string;
  /** A weather the Game Master or scene asked for, held until `until` (game minutes); `asked` when it was
   *  changed to fit the place. */
  forced?: { type: WeatherType; asked: WeatherType; until: number };
}

function minutesOf(time: GameTime) {
  return (time.day - 1) * 24 * 60 + time.hour * 60 + time.minute;
}

function chatSeed(chatId: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < chatId.length; i++) h = Math.imul(h ^ chatId.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/** The climate where the party is, and the season the story holds the place at, if any. */
async function climateHere(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  location: string,
  day: number,
): Promise<{ climate: WorldClimate; seed: number; held: WorldSeason | null }> {
  const indoorsByName = inferBiome(location) === "underground";
  try {
    const world = await loadGameWorld(db, chatId, meta);
    if (world) {
      const replies = await gameRepliesBefore(db, chatId);
      const placeId = await gamePartyPlace(world, chatId, meta, replies);
      const place = world.world.places.find((each) => each.id === placeId);
      const start = world.world.places.find((each) => each.id === world.world.startId);
      const at = place?.at ?? start?.at ?? { x: 0, y: 0 };
      const climate = worldClimateAt(world, at.y * world.world.width + at.x);
      const story = gameStoryFromMetadata(meta, world);
      const season = story
        ? storySeasonAt(story, storyState(story, readStoryLedger(replies.all)).seasons, world, placeId, day)
        : null;
      return {
        climate: indoorsByName ? { ...climate, zone: "underground", meanTemp: 13, swing: 0 } : climate,
        seed: world.seed,
        held: season?.held ? season.season : null,
      };
    }
  } catch (err) {
    logger.warn(err, "Game weather: could not read the world for chat %s; using the place name", chatId);
  }
  return { climate: worldClimateOfBiome(inferBiome(location)), seed: chatSeed(chatId), held: null };
}

function stateOf(weather: WorldWeather, seed: number, minutes: number): GameWeatherState {
  return {
    type: weather.type,
    temperature: weather.temperature,
    description: weatherDescription(weather.type, seed + Math.floor(minutes / 360)),
    wind: weather.wind,
    visibility: weather.visibility,
    climate: {
      zone: weather.zone,
      label: WORLD_CLIMATE_LABELS[weather.zone],
      season: weather.season,
      seasonLabel: weather.seasonLabel,
    },
    note: worldWeatherNote(weather),
  };
}

/**
 * The weather where the party is now. `wanted` is a weather the Game Master or scene asks for: fitted to
 * the place and held for a while. Without it, a weather set earlier still holds until its time is up.
 */
export async function gameWeatherNow(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  options: { location?: string; wanted?: WeatherType | null } = {},
): Promise<GameWeatherState> {
  const time = (meta.gameTime as GameTime | undefined) ?? createInitialTime();
  const minutes = minutesOf(time);
  const { climate, seed, held } = await climateHere(db, chatId, meta, options.location ?? "", time.day);
  const input = { seed, climate, day: time.day, hour: time.hour + time.minute / 60, heldSeason: held };
  const previous = meta.gameWeather as GameWeatherState | undefined;
  const standing =
    !options.wanted && previous?.forced && previous.forced.until > minutes && previous.forced.until - minutes <= 24 * 60
      ? previous.forced
      : null;
  const wanted = options.wanted ?? standing?.asked ?? null;
  if (!wanted) return stateOf(worldWeatherAt(input), seed, minutes);
  const fitted = worldWeatherFit(input, wanted);
  return {
    ...stateOf(fitted, seed, minutes),
    forced: {
      type: fitted.type,
      asked: wanted,
      until: standing?.until ?? minutes + GAME_WEATHER_FORCED_MINUTES,
    },
  };
}
