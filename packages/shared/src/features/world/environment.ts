// ──────────────────────────────────────────────
// Environment holds (user, 2026-11-14: "there may be powerful curses or entities that should be able to
// lock an area to an environment ... a city that is locked in darkness"). The Game Master puts a place,
// and every place inside it, under a lasting weather, season or darkness with the `[environment: ...]`
// tag, and lets it go the same way. A hold beats the climate (climate.ts): a cursed desert can snow. It
// is read from the replies, like the story's ledger, so a swipe or a deleted reply takes it back. A
// world can start with holds of its own (user, 2026-11-14: a lorebook's "cursed to forever winters"): the
// brief's `environments`, read from the lore or the setting at creation; the replies then change them.
//
//   [environment: place="Gotham" light="dark" weather="rain" note="the Court's long night"]
//   [environment: place="Sallowmarch" season="autumn"]
//   [environment: place="world" weather="snow"]      the whole world
//   [environment: place="Gotham" weather="none"]     lets one part go
//   [environment: place="Gotham" release]            lets the place go
// ──────────────────────────────────────────────
import { normalizeWeatherType, type WeatherType } from "../combat-conditions.js";
import { worldPlaceByName, type GameWorld } from "./game-world.js";
import { WORLD_SEASONS, type WorldSeason } from "./overworld.js";

/** The light a place can be held at: always night, always dusk, or always day. */
export const GAME_LIGHT_HOLDS = Object.freeze(["dark", "dusk", "day"] as const);
export type GameLightHold = (typeof GAME_LIGHT_HOLDS)[number];

export interface GameEnvironmentHold {
  /** The place's name as the Game Master gave it; "world" for the whole world. */
  place: string;
  weather?: WeatherType;
  season?: WorldSeason;
  light?: GameLightHold;
  /** Why (the curse, the power), for the Game Master. */
  note?: string;
}

export const GAME_ENVIRONMENT_WORLD = "world";
const TAG = /\[environment:([^\]]*)\]/gi;
const ATTRIBUTE = /(\w+)\s*=\s*"([^"]*)"/g;
const fold = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** The holds a world starts with, from its brief (the lore's or setting's places outside nature). */
export function worldEnvironmentHolds(game: Pick<GameWorld, "brief"> | null | undefined): GameEnvironmentHold[] {
  const out: GameEnvironmentHold[] = [];
  for (const each of game?.brief?.environments ?? []) {
    const hold: GameEnvironmentHold = { place: each.place };
    const weather = normalizeWeatherType(each.weather);
    if (weather) hold.weather = weather;
    if (each.season) hold.season = each.season;
    if (each.light) hold.light = each.light;
    if (each.note) hold.note = each.note;
    if (hold.weather || hold.season || hold.light) out.push(hold);
  }
  return out;
}

/** The holds in force after these replies, oldest first: each tag sets or lets go its parts of a place's,
 *  over the holds the world `start`s with (worldEnvironmentHolds). */
export function readEnvironmentHolds(
  replies: readonly string[],
  start: readonly GameEnvironmentHold[] = [],
): GameEnvironmentHold[] {
  const holds = new Map<string, GameEnvironmentHold>();
  for (const hold of start) {
    const key =
      fold(hold.place) === "everywhere" || fold(hold.place) === "*" ? GAME_ENVIRONMENT_WORLD : fold(hold.place);
    holds.set(key, { ...holds.get(key), ...hold });
  }
  for (const reply of replies) {
    for (const match of reply.matchAll(TAG)) {
      const body = match[1] ?? "";
      const values = new Map([...body.matchAll(ATTRIBUTE)].map((each) => [each[1]!.toLowerCase(), each[2]!.trim()]));
      const placeName = values.get("place")?.slice(0, 120);
      if (!placeName) continue;
      const key =
        fold(placeName) === "everywhere" || fold(placeName) === "*" ? GAME_ENVIRONMENT_WORLD : fold(placeName);
      if (/(^|\s)release(\s|$)/i.test(body.replace(ATTRIBUTE, " "))) {
        holds.delete(key);
        continue;
      }
      const hold: GameEnvironmentHold = { ...(holds.get(key) ?? { place: placeName.trim() }) };
      const said = (name: string) => values.get(name);
      const none = (value: string | undefined) => value !== undefined && /^(none|off|release)$/i.test(value);
      const weather = said("weather");
      if (none(weather)) delete hold.weather;
      else if (weather) hold.weather = normalizeWeatherType(weather) ?? hold.weather;
      const season = said("season")?.toLowerCase();
      if (none(season)) delete hold.season;
      else if (season && (WORLD_SEASONS as readonly string[]).includes(season)) hold.season = season as WorldSeason;
      const light = said("light")?.toLowerCase();
      if (none(light)) delete hold.light;
      else if (light && (GAME_LIGHT_HOLDS as readonly string[]).includes(light)) hold.light = light as GameLightHold;
      const note = said("note");
      if (note !== undefined) {
        if (note) hold.note = note.slice(0, 200);
        else delete hold.note;
      }
      if (hold.weather || hold.season || hold.light) holds.set(key, hold);
      else holds.delete(key);
    }
  }
  return [...holds.values()];
}

/** The world place a hold names, or "*" for the whole world; undefined when the world has no such place. */
function heldPlaceId(game: GameWorld, hold: GameEnvironmentHold): string | undefined {
  if (fold(hold.place) === GAME_ENVIRONMENT_WORLD) return "*";
  return worldPlaceByName(game.world, hold.place)?.id;
}

/**
 * The hold over where the party is, part by part: the nearest holding place's (the place, then each place
 * it is inside), then the whole world's. Without a world, a hold whose place the location's name says.
 */
export function environmentHoldAt(
  holds: readonly GameEnvironmentHold[],
  game: GameWorld | null,
  placeId: string | null | undefined,
  location = "",
): Omit<GameEnvironmentHold, "place"> & { places: string[] } {
  const out: Omit<GameEnvironmentHold, "place"> & { places: string[] } = { places: [] };
  const take = (hold: GameEnvironmentHold | undefined) => {
    if (!hold) return;
    let used = false;
    for (const part of ["weather", "season", "light"] as const) {
      if (hold[part] !== undefined && out[part] === undefined) {
        (out as Record<string, unknown>)[part] = hold[part];
        used = true;
      }
    }
    if (used) {
      out.places.push(hold.place);
      if (hold.note && !out.note) out.note = hold.note;
    }
  };
  const worldHold = holds.find((hold) => fold(hold.place) === GAME_ENVIRONMENT_WORLD);
  if (game) {
    const parents = new Map(game.world.places.map((place) => [place.id, place.parentId]));
    const byId = new Map<string, GameEnvironmentHold>();
    for (const hold of holds) {
      const id = heldPlaceId(game, hold);
      if (id && id !== "*") byId.set(id, hold);
    }
    for (let at = placeId ?? null, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) take(byId.get(at));
  } else {
    const here = fold(location);
    for (const hold of holds) {
      const name = fold(hold.place);
      if (name !== GAME_ENVIRONMENT_WORLD && here && (here.includes(name) || name.includes(here))) take(hold);
    }
  }
  take(worldHold);
  return out;
}

/** Every place of the world under a hold's part, and every place inside it, with what it is held at
 *  (`*` the whole world): for the overworld to draw the seasons and the dark. */
export function environmentHeldPlaces<P extends "season" | "light">(
  holds: readonly GameEnvironmentHold[],
  game: GameWorld,
  part: P,
): Record<string, NonNullable<GameEnvironmentHold[P]>> {
  const out: Record<string, NonNullable<GameEnvironmentHold[P]>> = {};
  if (!holds.some((hold) => hold[part] !== undefined)) return out;
  for (const place of game.world.places) {
    const at = environmentHoldAt(holds, game, place.id);
    const value = at[part];
    if (value !== undefined) out[place.id] = value as NonNullable<GameEnvironmentHold[P]>;
  }
  const world = holds.find((hold) => fold(hold.place) === GAME_ENVIRONMENT_WORLD)?.[part];
  if (world !== undefined) out["*"] = world as NonNullable<GameEnvironmentHold[P]>;
  return out;
}

/** The Game Master's line for a hold in force where the party is. */
export function environmentHoldNote(hold: Omit<GameEnvironmentHold, "place"> & { places: string[] }): string {
  const parts = [
    hold.weather ? `the weather is always ${hold.weather.replace(/_/g, " ")}` : "",
    hold.season ? `it is always ${hold.season}` : "",
    hold.light === "dark"
      ? "it is always night: no sun rises here"
      : hold.light === "dusk"
        ? "it is always dusk"
        : hold.light === "day"
          ? "it is always day: the sun never sets here"
          : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `Held here (${hold.places.join(", ")})${hold.note ? `, by ${hold.note}` : ""}: ${parts.join("; ")}. This holds whatever the climate or the clock until you let it go.`;
}

/** What each cell of the world is held at (its nearest place's value, as the held seasons are drawn), row
 *  by row, null where nothing is; null when nothing is held. `*` holds every cell. */
export function environmentHeldCells<T extends string>(
  game: GameWorld,
  values: Readonly<Record<string, T>> | undefined,
): Array<T | null> | null {
  if (!values || !Object.keys(values).length) return null;
  const { width, height, places } = game.world;
  const everywhere = values["*"] ?? null;
  const parents = new Set(places.flatMap((place) => (place.parentId ? [place.parentId] : [])));
  const leaves = places.filter((place) => !parents.has(place.id));
  const cells: Array<T | null> = new Array(width * height).fill(everywhere);
  if (!leaves.some((place) => values[place.id])) return everywhere ? cells : null;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let best = Infinity;
      let value: T | null = everywhere;
      for (const place of leaves) {
        const far = (place.at.x - x) ** 2 + (place.at.y - y) ** 2;
        if (far < best) {
          best = far;
          value = values[place.id] ?? everywhere;
        }
      }
      cells[y * width + x] = value;
    }
  return cells;
}

/** The hour a held light shows the scene at (the scene's sky and its weather effects). */
export const GAME_LIGHT_HOURS: Readonly<Record<GameLightHold, string>> = Object.freeze({
  dark: "23:00",
  dusk: "19:30",
  day: "12:00",
});
