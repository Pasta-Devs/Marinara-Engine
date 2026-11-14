// ──────────────────────────────────────────────
// Climate and weather from the world's own map (user, 2026-11-13: "is weather reflected realistically in
// desert regions and so on"). The weather where the party stands is read from the ground around it, its
// latitude and height, the season there, and a weather pattern that drifts over the map with the wind:
// a desert rarely rains, snow needs cold, the south has its summer when the north has its winter, the
// tropics have wet and dry seasons instead, and two ends of a big map can have different skies. The
// Game Master can still ask for a weather; one the place could never have becomes the nearest it could.
// Everything here is deterministic (seed, place, game time), so the weather never flickers between reads.
// ──────────────────────────────────────────────
import { WEATHER_TYPES, type WeatherType } from "../combat-conditions.js";
import { WORLD_DAYS_PER_CELL } from "./compile.js";
import type { GameWorld } from "./game-world.js";
import {
  WORLD_SEASON_DAYS,
  WORLD_SEASONS,
  worldGroundCells,
  worldGroundLooks,
  worldSeason,
  type WorldGroundLook,
  type WorldSeason,
} from "./overworld.js";

/** Climate zones, after Köppen's groups, in words a Game Master and a player both read. */
export const WORLD_CLIMATE_ZONES = Object.freeze([
  "rainforest",
  "savanna",
  "hot_desert",
  "cold_desert",
  "steppe",
  "mediterranean",
  "subtropical",
  "oceanic",
  "continental",
  "subarctic",
  "tundra",
  "ice",
  "highland",
  "underground",
  "space",
] as const);
export type WorldClimateZone = (typeof WORLD_CLIMATE_ZONES)[number];

export const WORLD_CLIMATE_LABELS: Readonly<Record<WorldClimateZone, string>> = Object.freeze({
  rainforest: "tropical rainforest",
  savanna: "tropical wet-and-dry",
  hot_desert: "hot desert",
  cold_desert: "cold desert",
  steppe: "dry steppe",
  mediterranean: "mediterranean (dry summers, wet winters)",
  subtropical: "humid subtropical",
  oceanic: "mild and wet (oceanic)",
  continental: "continental (warm summers, cold winters)",
  subarctic: "subarctic",
  tundra: "tundra",
  ice: "ice cap",
  highland: "highland",
  underground: "underground",
  space: "no weather (space)",
});

export interface WorldClimate {
  zone: WorldClimateZone;
  /** Degrees, north positive; null where the map has no latitude (a drawn region read as the north's). */
  latitude: number | null;
  /** Mean yearly temperature at the spot, °C, after its height. */
  meanTemp: number;
  /** Half the gap between the warmest and the coldest month, °C. */
  swing: number;
  /** 0 bone dry to 1 soaking. */
  wet: number;
  /** Metres above the sea. */
  metres: number;
  coast: boolean;
  /** Loose sand or dust about (a sandstorm can rise). */
  sandy: boolean;
  /** Built up (a little warmer). */
  urban: boolean;
  /** Where on the map, in km, for the drifting weather pattern. */
  km: { x: number; y: number };
}

// ── Reading the ground ──

/** What each look says about the climate it grows in: mean yearly °C and wetness (0 to 1). Height (hills,
 *  mountains), water and built-up ground say nothing of the climate and are read apart. */
const LOOK_CLIMATE: Partial<Record<WorldGroundLook, { t: number; wet: number }>> = {
  grass: { t: 11, wet: 0.55 },
  plains: { t: 13, wet: 0.4 },
  farmland: { t: 12, wet: 0.6 },
  paddies: { t: 21, wet: 0.85 },
  forest: { t: 10, wet: 0.7 },
  conifer_forest: { t: 1, wet: 0.6 },
  autumn_forest: { t: 8, wet: 0.65 },
  jungle: { t: 26, wet: 0.95 },
  bamboo: { t: 17, wet: 0.8 },
  marsh: { t: 11, wet: 0.9 },
  scrub: { t: 17, wet: 0.25 },
  desert: { t: 22, wet: 0.04 },
  snow: { t: -9, wet: 0.4 },
  wasteland: { t: 14, wet: 0.2 },
  dead_forest: { t: 10, wet: 0.35 },
  craters: { t: 14, wet: 0.3 },
};
const WATER_LOOKS = new Set<WorldGroundLook>(["sea", "lake", "toxic_water"]);
const BUILT_LOOKS = new Set<WorldGroundLook>(["suburb", "city", "industry", "slums", "ruins"]);
const SPACE_LOOKS = new Set<WorldGroundLook>(["space", "nebula", "asteroids", "gravity_well"]);
const SANDY_LOOKS = new Set<WorldGroundLook>(["desert", "scrub", "wasteland", "plains", "craters"]);
const LOOK_METRES: Partial<Record<WorldGroundLook, number>> = { mountains: 2600, hills: 700 };

/** Sea-level mean yearly °C by latitude (degrees from the equator) by a sea-tempered coast; land far
 *  downwind of the sea runs colder toward the poles (continentalCooling). Fitted to London, Moscow,
 *  Reykjavik, Yakutsk, Cairo, Singapore, Mumbai, Rome, Sydney, Buenos Aires and Shanghai. */
const LAT_TEMP: Array<[number, number]> = [
  [0, 27],
  [10, 27],
  [20, 25.5],
  [30, 21],
  [40, 16],
  [50, 11],
  [60, 5],
  [70, -2],
  [80, -12],
  [90, -20],
];
/** °C lost per kilometre of height (yearly means over high ground fall a little slower than free air). */
const LAPSE_PER_KM = 4.5;
/** How far upwind the open sea must be (km) for a place to be wholly continental. */
const CONTINENTAL_KM = 2500;
function tempAtLatitude(lat: number): number {
  const a = Math.min(90, Math.abs(lat));
  for (let i = 1; i < LAT_TEMP.length; i++) {
    const [l1, t1] = LAT_TEMP[i]!;
    if (a <= l1) {
      const [l0, t0] = LAT_TEMP[i - 1]!;
      return t0 + ((a - l0) / (l1 - l0)) * (t1 - t0);
    }
  }
  return -20;
}
/** The latitude whose sea-level mean is this temperature (a drawn map with no latitude reads its own). */
function latitudeOfTemp(t: number): number {
  for (let i = 1; i < LAT_TEMP.length; i++) {
    const [l0, t0] = LAT_TEMP[i - 1]!;
    const [l1, t1] = LAT_TEMP[i]!;
    if (t <= t0 && t >= t1) return t0 === t1 ? l0 : l0 + ((t0 - t) / (t0 - t1)) * (l1 - l0);
  }
  return t > 27 ? 5 : 90;
}

/** Cold winters far from the sea: Yakutsk is fifteen degrees colder a year than a coast at its latitude. */
function continentalCooling(lat: number, continental: number) {
  return continental * Math.max(0, Math.abs(lat) - 35) * 0.4;
}
/** Half the yearly range: small in the tropics and by the sea, large toward the poles far inland, and
 *  smaller in the south, whose seas temper even its inland. */
function yearlySwing(lat: number, continental: number, coast: boolean, eastCoast: boolean) {
  const a = Math.abs(lat);
  const inland = continental * Math.max(0, a - 20) * 0.45 * (lat < 0 ? 0.5 : 1) * (coast && !eastCoast ? 0.6 : 1);
  return Math.max(1, a * 0.12 + inland);
}

/** The zone of a climate's numbers. `westSeaKm` is how far the sea lies to the west (the westerlies'
 *  side): the mediterranean climates are the west coasts of the thirties and forties. */
export function worldClimateZoneOf(c: Omit<WorldClimate, "zone" | "km">, westSeaKm = Infinity): WorldClimateZone {
  const coldest = c.meanTemp - c.swing;
  const warmest = c.meanTemp + c.swing;
  if (warmest < 0) return "ice";
  if (warmest < 10) return "tundra";
  if (c.metres >= 2500) return "highland";
  if (c.wet < 0.2) return c.meanTemp >= 18 ? "hot_desert" : "cold_desert";
  if (c.wet < 0.35) return "steppe";
  const lat = Math.abs(c.latitude ?? latitudeOfTemp(c.meanTemp + (c.metres / 1000) * LAPSE_PER_KM));
  // Near the equator rain all year; further out the monsoon's wet summer and dry winter.
  if (coldest >= 18) return lat < 10 && c.wet >= 0.6 ? "rainforest" : "savanna";
  // (A drawn map has no latitude to go by: there only ground drier than grass reads as mediterranean, never
  // the bamboo and paddies of a monsoon coast.)
  if (
    lat >= 30 &&
    lat <= 45 &&
    westSeaKm <= 400 &&
    c.meanTemp >= 12 &&
    c.meanTemp <= 21 &&
    (c.latitude !== null || c.wet <= 0.5)
  )
    return "mediterranean";
  if (coldest >= -3) return c.meanTemp >= 15 ? "subtropical" : "oceanic";
  return c.meanTemp < 3 ? "subarctic" : "continental";
}

/** Each world, read once: its looks, its cells, and which cells are open sea (the Earth's own sea, or on
 *  a drawn map a body of water that reaches the edge or is big; a lake drawn as sea is not). */
const groundCache = new WeakMap<GameWorld, { looks: WorldGroundLook[]; cells: Uint8Array; openSea: Uint8Array }>();
function groundOf(game: GameWorld) {
  let cached = groundCache.get(game);
  if (cached) return cached;
  const looks = worldGroundLooks(game);
  const cells = worldGroundCells(game.world);
  const { width, height } = game.world;
  const count = width * height;
  const openSea = new Uint8Array(count);
  {
    const isSea = (cell: number) => {
      const look = looks[cells[cell]!];
      return look === "sea" || look === "toxic_water";
    };
    const seen = new Uint8Array(count);
    const big = Math.max(24, Math.round(count * 0.01));
    for (let start = 0; start < count; start++) {
      if (seen[start] || !isSea(start)) continue;
      const body: number[] = [start];
      seen[start] = 1;
      let edge = false;
      for (let i = 0; i < body.length; i++) {
        const cell = body[i]!;
        const [x, y] = [cell % width, Math.floor(cell / width)];
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!seen[next] && isSea(next)) {
            seen[next] = 1;
            body.push(next);
          }
        }
      }
      if (edge || body.length >= big) for (const cell of body) openSea[cell] = 1;
    }
  }
  cached = { looks, cells, openSea };
  groundCache.set(game, cached);
  return cached;
}

/** The kilometres one cell of this world's map spans. */
export function worldKmPerCell(game: GameWorld): number {
  // Thirty kilometres a day on foot, as the Earth maps count it on the Overworld branch.
  return WORLD_DAYS_PER_CELL[game.kit.scale] * 30;
}

// This build has no real-Earth maps (the Overworld branch's Earth seed): every map is drawn.
function earthAt(
  _game: GameWorld,
  _cell: number,
): { latitude: number; metres: number | null; dry: number | null } | null {
  return null;
}

/** How far the open sea lies from a cell to the west and to the east along its row (km): on the map
 *  when the map shows it, else past the edge (a drawn map is taken to run on inland a little). */
function seaAlongRow(game: GameWorld, x: number, y: number, openSea: Uint8Array) {
  const { width } = game.world;
  const kmPerCell = worldKmPerCell(game);
  const isSea = (cx: number) => openSea[y * width + cx] === 1;
  let west = Infinity;
  for (let cx = x - 1; cx >= 0; cx--)
    if (isSea(cx)) {
      west = (x - cx) * kmPerCell;
      break;
    }
  if (!Number.isFinite(west)) west = x * kmPerCell + 400;
  let east = Infinity;
  for (let cx = x + 1; cx < width; cx++)
    if (isSea(cx)) {
      east = (cx - x) * kmPerCell;
      break;
    }
  if (!Number.isFinite(east)) east = (width - 1 - x) * kmPerCell + 400;
  return { west, east };
}

/**
 * The climate at a cell of a world's map: its latitude (the Earth's real one, a whole drawn world's from
 * pole to pole down the map), its height, how wet and how warm the ground around it says it is, and how
 * far upwind the sea lies (inland swings harder between summer and winter, and runs colder).
 */
export function worldClimateAt(game: GameWorld, cell: number): WorldClimate {
  const { width, height } = game.world;
  const { looks, cells, openSea } = groundOf(game);
  const at = Math.max(0, Math.min(width * height - 1, Math.floor(cell)));
  const [x, y] = [at % width, Math.floor(at / width)];
  const kmPerCell = worldKmPerCell(game);
  const km = { x: x * kmPerCell, y: y * kmPerCell };
  const look = looks[cells[at]!] ?? "grass";
  const base = {
    latitude: null as number | null,
    meanTemp: 20,
    swing: 0,
    wet: 0.5,
    metres: 0,
    coast: false,
    sandy: false,
    urban: false,
  };
  if (SPACE_LOOKS.has(look) || game.kit.scale === "sector") return { ...base, zone: "space", km };

  // The ground round the spot, nearer counting more; the spot itself twice. A town reads the land about it.
  const radius = Math.max(2, Math.min(6, Math.round(45 / kmPerCell)));
  const coastReach = Math.max(1.5, 20 / kmPerCell);
  let tSum = 0;
  let wetSum = 0;
  let weight = 0;
  let sandy = 0;
  let land = 0;
  let coast = false;
  let seaEast = false;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const each = looks[cells[ny * width + nx]!] ?? "grass";
      const d = Math.hypot(dx, dy);
      if (d > radius) continue;
      if (WATER_LOOKS.has(each)) {
        if (d <= coastReach) {
          coast = true;
          if (dx > 0 && openSea[ny * width + nx]) seaEast = true;
        }
        continue;
      }
      land++;
      if (SANDY_LOOKS.has(each)) sandy++;
      const says = LOOK_CLIMATE[each];
      if (!says) continue;
      const w = (d === 0 ? 2 : 1) / (1 + d);
      tSum += says.t * w;
      wetSum += says.wet * w;
      weight += w;
    }
  // The whole map, faintly: a ring of fields in the snow is still in the snow.
  {
    let mt = 0;
    let mw = 0;
    let n = 0;
    for (let index = 0; index < cells.length; index += 3) {
      const says = LOOK_CLIMATE[looks[cells[index]!] ?? "grass"];
      if (!says) continue;
      mt += says.t;
      mw += says.wet;
      n++;
    }
    if (n) {
      const w = Math.max(0.15, weight * 0.15);
      tSum += (mt / n) * w;
      wetSum += (mw / n) * w;
      weight += w;
    }
  }
  const groundTemp = weight ? tSum / weight : 11;
  let wet = weight ? wetSum / weight : 0.5;
  let metres = LOOK_METRES[look] ?? 150;

  let latitude: number | null = null;
  const earth = earthAt(game, at);
  if (earth) {
    latitude = earth.latitude;
    if (earth.metres !== null) metres = earth.metres;
    if (earth.dry !== null && !WATER_LOOKS.has(look)) wet = 1 - earth.dry;
  } else if (game.kit.scale === "world") {
    // A whole drawn world runs from 70° north at the top to 70° south at the bottom, as its winds do.
    latitude = 70 - (y / Math.max(1, height - 1)) * 140;
  }
  const lat = latitude ?? latitudeOfTemp(groundTemp);
  // The westerlies from 25° to 65°; the trade winds and the polar easterlies elsewhere, and in the tropics
  // whichever sea is nearer.
  const sea = seaAlongRow(game, x, y, openSea);
  const a = Math.abs(lat);
  const upwindKm = a >= 25 && a <= 65 ? sea.west : a > 65 ? sea.east : Math.min(sea.west, sea.east);
  const continental = Math.max(0, Math.min(1, upwindKm / CONTINENTAL_KM));
  const eastCoast = coast && seaEast && sea.west > 600;

  let seaLevelTemp: number;
  if (earth) seaLevelTemp = tempAtLatitude(lat) - continentalCooling(lat, continental);
  else if (latitude !== null)
    // A drawn world: its latitude, and the ground still has its say (its snow is cold, its jungle warm).
    seaLevelTemp = (tempAtLatitude(lat) - continentalCooling(lat, continental)) * 0.6 + groundTemp * 0.4;
  else seaLevelTemp = groundTemp;
  if (look === "snow") seaLevelTemp = Math.min(seaLevelTemp, -6);
  if (look === "jungle") seaLevelTemp = Math.max(seaLevelTemp, 23);
  const meanTemp = seaLevelTemp - (Math.max(0, metres - 150) / 1000) * LAPSE_PER_KM;
  const swing = yearlySwing(lat, continental, coast, eastCoast) * (wet < 0.2 ? 1.1 : 1);

  const climate = {
    latitude,
    meanTemp,
    swing,
    wet: Math.max(0, Math.min(1, wet)),
    metres,
    coast,
    sandy: land > 0 && sandy / land >= 0.3,
    urban: BUILT_LOOKS.has(look) && look !== "ruins",
  };
  return { ...climate, zone: worldClimateZoneOf(climate, sea.west), km };
}

/** Climates for a game with no world map, from the old words-in-the-place-name biomes. */
export type WorldLegacyBiome =
  "temperate" | "tropical" | "arctic" | "desert" | "mountain" | "coastal" | "underground" | "urban";
export function worldClimateOfBiome(biome: WorldLegacyBiome): WorldClimate {
  const km = { x: 0, y: 0 };
  const base = { latitude: null, coast: false, sandy: false, urban: false, km };
  switch (biome) {
    case "tropical":
      return { ...base, zone: "rainforest", meanTemp: 26, swing: 1.5, wet: 0.9, metres: 100 };
    case "arctic":
      return { ...base, zone: "tundra", meanTemp: -10, swing: 14, wet: 0.4, metres: 100 };
    case "desert":
      return { ...base, zone: "hot_desert", meanTemp: 24, swing: 8, wet: 0.05, metres: 300, sandy: true };
    case "mountain":
      return { ...base, zone: "highland", meanTemp: 2, swing: 9, wet: 0.55, metres: 2600 };
    case "coastal":
      return { ...base, zone: "oceanic", meanTemp: 11, swing: 6, wet: 0.65, metres: 10, coast: true };
    case "underground":
      return { ...base, zone: "underground", meanTemp: 13, swing: 0, wet: 0.6, metres: 0 };
    case "urban":
      return { ...base, zone: "continental", meanTemp: 11, swing: 10, wet: 0.55, metres: 150, urban: true };
    default:
      return { ...base, zone: "continental", meanTemp: 10, swing: 10, wet: 0.55, metres: 150 };
  }
}

// ── Seasons where the party is ──

/** The day of the year (0 to 359; 0 the first day of the calendar's spring). */
function yearDay(day: number): number {
  return (Math.max(1, Math.floor(day)) - 1) % (WORLD_SEASON_DAYS * WORLD_SEASONS.length);
}

/**
 * The season at a spot: the calendar's in the north, the opposite in the south. A season the story holds
 * the place at stands as it is. In the tropics the year is a wet and a dry season instead.
 */
export function worldLocalSeason(
  climate: WorldClimate,
  day: number,
  held?: WorldSeason | null,
): { season: WorldSeason; label: string; held: boolean } {
  const calendar = worldSeason(day);
  const flip = !held && (climate.latitude ?? 1) < 0;
  const season = held ?? (flip ? WORLD_SEASONS[(WORLD_SEASONS.indexOf(calendar) + 2) % 4]! : calendar);
  const lat = Math.abs(climate.latitude ?? 45);
  const wetDry =
    climate.zone === "savanna" ||
    (lat < 23.5 && (climate.zone === "highland" || climate.zone === "steppe" || climate.zone === "subtropical"));
  // The wet season comes with the high sun: from mid-spring to mid-autumn of the place's own year.
  const phase = Math.cos(((localYearDay(climate, day, held) - 135) / 360) * Math.PI * 2);
  const label =
    climate.zone === "space" || climate.zone === "underground"
      ? season
      : climate.zone === "rainforest"
        ? "wet all year"
        : wetDry
          ? phase > 0.3
            ? "wet season"
            : "dry season"
          : season;
  return { season, label, held: Boolean(held) };
}

/** Where in the year a season puts the spot: the local day of the year, mid-season when the story holds it. */
function localYearDay(climate: WorldClimate, day: number, held?: WorldSeason | null): number {
  if (held) return WORLD_SEASONS.indexOf(held) * WORLD_SEASON_DAYS + WORLD_SEASON_DAYS / 2;
  const d = yearDay(day);
  return (climate.latitude ?? 1) < 0 ? (d + 180) % 360 : d;
}

// ── The weather pattern ──

interface ZoneWeather {
  /** Share of the time it rains or snows, over the year, and how much that swings by season. */
  wetMean: number;
  wetSwing: number;
  /** When the wet time comes: with the summer sun (monsoons, thunderstorms) or in winter (westerly storms). */
  wetPeak: "summer" | "winter" | null;
  fog: number;
  overcast: number;
  cloudy: number;
  /** Share of the rain that comes as thunderstorms, when it is warm enough. */
  thunder: number;
  /** How windy it runs. */
  wind: number;
  /** Day-to-night swing, °C. */
  diurnal: number;
}
const ZONE_WEATHER: Record<WorldClimateZone, ZoneWeather> = {
  rainforest: {
    wetMean: 0.3,
    wetSwing: 0.06,
    wetPeak: "summer",
    fog: 0.05,
    overcast: 0.12,
    cloudy: 0.28,
    thunder: 0.45,
    wind: 0,
    diurnal: 8,
  },
  savanna: {
    wetMean: 0.17,
    wetSwing: 0.17,
    wetPeak: "summer",
    fog: 0.03,
    overcast: 0.15,
    cloudy: 0.25,
    thunder: 0.4,
    wind: 0.05,
    diurnal: 12,
  },
  hot_desert: {
    wetMean: 0.02,
    wetSwing: 0.01,
    wetPeak: null,
    fog: 0.01,
    overcast: 0.03,
    cloudy: 0.12,
    thunder: 0.35,
    wind: 0.12,
    diurnal: 13,
  },
  cold_desert: {
    wetMean: 0.03,
    wetSwing: 0.015,
    wetPeak: "summer",
    fog: 0.01,
    overcast: 0.06,
    cloudy: 0.18,
    thunder: 0.2,
    wind: 0.12,
    diurnal: 15,
  },
  steppe: {
    wetMean: 0.1,
    wetSwing: 0.05,
    wetPeak: "summer",
    fog: 0.02,
    overcast: 0.08,
    cloudy: 0.25,
    thunder: 0.35,
    wind: 0.12,
    diurnal: 13,
  },
  mediterranean: {
    wetMean: 0.14,
    wetSwing: 0.12,
    wetPeak: "winter",
    fog: 0.04,
    overcast: 0.1,
    cloudy: 0.22,
    thunder: 0.12,
    wind: 0.05,
    diurnal: 11,
  },
  subtropical: {
    wetMean: 0.25,
    wetSwing: 0.08,
    wetPeak: "summer",
    fog: 0.05,
    overcast: 0.15,
    cloudy: 0.25,
    thunder: 0.3,
    wind: 0,
    diurnal: 8,
  },
  oceanic: {
    wetMean: 0.26,
    wetSwing: 0.06,
    wetPeak: "winter",
    fog: 0.07,
    overcast: 0.25,
    cloudy: 0.22,
    thunder: 0.06,
    wind: 0.1,
    diurnal: 7,
  },
  continental: {
    wetMean: 0.22,
    wetSwing: 0.04,
    wetPeak: "summer",
    fog: 0.05,
    overcast: 0.18,
    cloudy: 0.25,
    thunder: 0.2,
    wind: 0.05,
    diurnal: 10,
  },
  subarctic: {
    wetMean: 0.2,
    wetSwing: 0.05,
    wetPeak: "summer",
    fog: 0.05,
    overcast: 0.2,
    cloudy: 0.25,
    thunder: 0.08,
    wind: 0.05,
    diurnal: 9,
  },
  tundra: {
    wetMean: 0.15,
    wetSwing: 0.04,
    wetPeak: "summer",
    fog: 0.1,
    overcast: 0.25,
    cloudy: 0.25,
    thunder: 0.02,
    wind: 0.2,
    diurnal: 5,
  },
  ice: {
    wetMean: 0.08,
    wetSwing: 0,
    wetPeak: null,
    fog: 0.06,
    overcast: 0.2,
    cloudy: 0.25,
    thunder: 0,
    wind: 0.3,
    diurnal: 4,
  },
  highland: {
    wetMean: 0.26,
    wetSwing: 0.06,
    wetPeak: "summer",
    fog: 0.14,
    overcast: 0.15,
    cloudy: 0.25,
    thunder: 0.25,
    wind: 0.2,
    diurnal: 12,
  },
  underground: {
    wetMean: 0,
    wetSwing: 0,
    wetPeak: null,
    fog: 0,
    overcast: 0,
    cloudy: 0,
    thunder: 0,
    wind: 0,
    diurnal: 0,
  },
  space: { wetMean: 0, wetSwing: 0, wetPeak: null, fog: 0, overcast: 0, cloudy: 0, thunder: 0, wind: 0, diurnal: 0 },
};

function hash(seed: number, ...parts: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const part of parts) {
    h = Math.imul(h ^ (part | 0), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Value noise over space (km) and time (hours), each lattice a scale apart. */
function noise3(seed: number, x: number, y: number, t: number): number {
  const [ix, iy, it] = [Math.floor(x), Math.floor(y), Math.floor(t)];
  const [fx, fy, ft] = [smooth(x - ix), smooth(y - iy), smooth(t - it)];
  let out = 0;
  for (let dz = 0; dz <= 1; dz++)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? ft : 1 - ft);
        out += w * hash(seed, ix + dx, iy + dy, it + dz);
      }
  return out;
}
/** Smoothed noise bunches round the middle: rank it back to an even spread so the zone's shares hold. */
const cdfCache = new Map<string, number[]>();
function evenOut(kind: string, raw: (s: number, x: number, y: number, t: number) => number, value: number): number {
  let sorted = cdfCache.get(kind);
  if (!sorted) {
    sorted = [];
    for (let i = 0; i < 4096; i++)
      sorted.push(raw(hash(7, i) * 1e6, hash(11, i) * 50, hash(13, i) * 50, hash(17, i) * 500));
    sorted.sort((a, b) => a - b);
    cdfCache.set(kind, sorted);
  }
  let [lo, hi] = [0, sorted.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

/** Weather systems: some 400 km across, drifting east at a walking front's pace, growing and dying over days. */
const SYSTEM_KM = 400;
const DRIFT_KM_PER_HOUR = 25;
const wetRaw = (s: number, x: number, y: number, t: number) =>
  noise3(s, x, y, t / 30) * 0.6 + noise3(s + 1, x * 2.3, y * 2.3, t / 9) * 0.4;
const windRaw = (s: number, x: number, y: number, t: number) =>
  noise3(s + 2, x * 1.7, y * 1.7, t / 10) * 0.7 + noise3(s + 3, x * 4, y * 4, t / 4) * 0.3;
const warmRaw = (s: number, x: number, y: number, t: number) => noise3(s + 4, x * 0.7, y * 0.7, t / 60);

export interface WorldWeatherInput {
  seed: number;
  climate: WorldClimate;
  /** Game day (1 is the first) and hour (0 to 23, may carry minutes as a fraction). */
  day: number;
  hour: number;
  /** The season the story holds the place at, if it holds one. */
  heldSeason?: WorldSeason | null;
}

export interface WorldWeather {
  type: WeatherType;
  temperature: number;
  wind: "calm" | "breezy" | "windy" | "gale";
  visibility: "clear" | "reduced" | "poor";
  zone: WorldClimateZone;
  season: WorldSeason;
  seasonLabel: string;
  /** What this place cannot have right now, for the Game Master. */
  impossible: WeatherType[];
}

/** The day's temperature curve: coldest at dawn, warmest mid-afternoon. */
function diurnalShape(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return Math.cos(((h - 15) / 24) * Math.PI * 2);
}

/** What the place's air is doing at a time, before the sky is read (shared by the roll and the fit). */
function airAt(input: WorldWeatherInput) {
  const { climate, seed } = input;
  const z = ZONE_WEATHER[climate.zone];
  const t = (Math.max(1, input.day) - 1) * 24 + input.hour;
  const sx = (climate.km.x - t * DRIFT_KM_PER_HOUR) / SYSTEM_KM;
  const sy = climate.km.y / SYSTEM_KM;
  const s = Math.floor(hash(seed, 101) * 1e6);
  const uWet = evenOut("wet", wetRaw, wetRaw(s, sx, sy, t));
  const uWind = evenOut("wind", windRaw, windRaw(s, sx, sy, t));
  const uWarm = evenOut("warm", warmRaw, warmRaw(s, sx, sy, t));
  const d = localYearDay(climate, input.day, input.heldSeason);
  // Mid-summer (local day 135) warmest; the wet time peaks with it or half a year off.
  const yearPhase = Math.cos(((d - 135) / 360) * Math.PI * 2);
  // A monsoon's wet season is short and its dry season long: the wet peak is sharpened.
  const peak = z.wetPeak === "summer" ? yearPhase : z.wetPeak === "winter" ? -yearPhase : 0;
  const wetPhase = climate.zone === "savanna" ? 2 * ((1 + peak) / 2) ** 2 - 1 : peak;
  // Showers and thunderstorms in the warm climates build through the day and die off by night.
  const convective = z.thunder >= 0.2 && climate.meanTemp + climate.swing * yearPhase >= 15;
  const afternoon = Math.cos(((input.hour - 16) / 24) * Math.PI * 2);
  const wetShare = Math.max(
    0,
    Math.min(0.85, (z.wetMean + z.wetSwing * wetPhase) * (convective ? 1 + 0.5 * afternoon : 1)),
  );
  const diurnal = z.diurnal * (climate.coast ? 0.7 : 1);
  const anomaly = (uWarm - 0.5) * 2 * (2.5 + climate.swing * 0.2);
  const seasonal = climate.meanTemp + climate.swing * yearPhase + (climate.urban ? 1 : 0);
  return { z, uWet, uWind, uWarm, wetShare, diurnal, anomaly, seasonal, d, convective };
}

function temperatureFor(air: ReturnType<typeof airAt>, hour: number, type: WeatherType): number {
  const covered = ["overcast", "rain", "heavy_rain", "storm", "snow", "blizzard", "fog", "hail", "sandstorm"].includes(
    type,
  );
  const day = (air.diurnal / 2) * diurnalShape(hour) * (covered ? 0.4 : type === "cloudy" ? 0.7 : 1);
  const wetChill: Partial<Record<WeatherType, number>> = {
    rain: -1.5,
    heavy_rain: -2.5,
    storm: -3,
    hail: -4,
    blizzard: -3,
  };
  return air.seasonal + air.anomaly + day + (wetChill[type] ?? 0);
}

function windOf(u: number, type: WeatherType): WorldWeather["wind"] {
  const base: WorldWeather["wind"] = u < 0.3 ? "calm" : u < 0.65 ? "breezy" : u < 0.9 ? "windy" : "gale";
  const order = ["calm", "breezy", "windy", "gale"] as const;
  const at = (w: WorldWeather["wind"]) => order.indexOf(w);
  const floor: Partial<Record<WeatherType, WorldWeather["wind"]>> = {
    storm: "windy",
    heavy_rain: "breezy",
    blizzard: "gale",
    sandstorm: "gale",
    wind: "windy",
    hail: "windy",
  };
  const ceiling: Partial<Record<WeatherType, WorldWeather["wind"]>> = { fog: "calm", heat_wave: "breezy" };
  let w = base;
  if (floor[type] && at(w) < at(floor[type]!)) w = floor[type]!;
  if (ceiling[type] && at(w) > at(ceiling[type]!)) w = ceiling[type]!;
  return w;
}
const VISIBILITY: Record<WeatherType, WorldWeather["visibility"]> = {
  clear: "clear",
  cloudy: "clear",
  overcast: "clear",
  rain: "reduced",
  heavy_rain: "reduced",
  storm: "poor",
  snow: "reduced",
  blizzard: "poor",
  fog: "poor",
  wind: "clear",
  hail: "reduced",
  sandstorm: "poor",
  heat_wave: "clear",
};

/** The coldest and warmest the place can plausibly be at this time of year and hour. */
function plausibleRange(air: ReturnType<typeof airAt>, climate: WorldClimate, hour: number): [number, number] {
  const spread = 2 * (2.5 + climate.swing * 0.2) + 3;
  const day = (air.diurnal / 2) * diurnalShape(hour);
  return [air.seasonal + day - spread, air.seasonal + day + spread];
}

/** What a place can never have right now (snow in the hot desert, a sandstorm in the rainforest). */
function impossibleNow(climate: WorldClimate, low: number, high: number): WeatherType[] {
  const out: WeatherType[] = [];
  if (climate.zone === "space" || climate.zone === "underground")
    return WEATHER_TYPES.filter((type) => type !== "clear");
  if (low > 1.5) out.push("snow");
  if (low > -1) out.push("blizzard");
  if (high < 28) out.push("heat_wave");
  if (high < 0 || climate.zone === "ice") out.push("rain", "heavy_rain", "storm", "hail");
  else if (high < 10) out.push("storm", "hail");
  const dryZone = climate.zone === "hot_desert" || climate.zone === "cold_desert" || climate.zone === "steppe";
  if (!(dryZone && climate.sandy) && !(climate.sandy && climate.wet < 0.4)) out.push("sandstorm");
  return [...new Set(out)];
}

/** The weather at a place and time, from its climate: deterministic, drifting, and fit for the place. */
export function worldWeatherAt(input: WorldWeatherInput): WorldWeather {
  const { climate, hour } = input;
  const local = worldLocalSeason(climate, input.day, input.heldSeason);
  if (climate.zone === "space" || climate.zone === "underground") {
    return {
      type: "clear",
      temperature: Math.round(climate.meanTemp),
      wind: "calm",
      visibility: "clear",
      zone: climate.zone,
      season: local.season,
      seasonLabel: local.label,
      impossible: impossibleNow(climate, 0, 0),
    };
  }
  const air = airAt(input);
  const { z, uWet, uWind } = air;
  // The sky, from clear to stormy along the wet axis, in the zone's shares for the season.
  const p = air.wetShare;
  const rest = 1 - p;
  // The wet time of year is the cloudy time too: a monsoon's dry days are clear, its wet ones grey.
  const clouds = z.wetMean > 0 ? Math.max(0.4, Math.min(2, p / z.wetMean)) : 1;
  const scale = Math.min(1, rest / Math.max(1e-6, (z.cloudy + z.overcast + z.fog) * clouds + 0.05));
  const fog = (z.fog + (climate.coast ? 0.04 : 0)) * scale;
  const overcast = z.overcast * clouds * scale;
  const cloudy = z.cloudy * Math.sqrt(clouds) * scale;
  const clear = Math.max(0, rest - fog - overcast - cloudy);
  let type: WeatherType;
  let u = uWet;
  if ((u -= clear) < 0) type = "clear";
  else if ((u -= cloudy) < 0) type = "cloudy";
  else if ((u -= overcast) < 0) type = "overcast";
  else if ((u -= fog) < 0) type = "fog";
  else {
    const into = Math.min(1, u / Math.max(1e-6, p));
    type = into > 1 - z.thunder ? "storm" : into > 1 - z.thunder - 0.25 ? "heavy_rain" : "rain";
  }
  // Fog burns off by afternoon inland and clears in a wind.
  if (type === "fog" && (uWind > 0.6 || (hour >= 11 && hour < 19 && !climate.coast && climate.zone !== "highland")))
    type = uWind > 0.6 ? "overcast" : "cloudy";
  let temperature = temperatureFor(air, hour, type);
  // Rain off the sea comes on mild air: the westerlies' fronts are warm, so a maritime winter mostly rains.
  const maritime = climate.zone === "oceanic" || climate.zone === "mediterranean" || climate.zone === "subtropical";
  if (maritime && (type === "rain" || type === "heavy_rain" || type === "storm")) air.seasonal += 1.5;
  temperature = temperatureFor(air, hour, type);
  // Rain falls as snow in the cold (in dry continental air at a degree or so above freezing); thunder
  // needs warm air.
  const snowLine = maritime ? 0.5 : 1.5;
  if (type === "storm" && (temperature < 12 || (air.convective && (hour < 12 || hour >= 23)))) type = "heavy_rain";
  if ((type === "rain" || type === "heavy_rain") && temperature <= snowLine)
    type = type === "heavy_rain" && uWind > 0.65 ? "blizzard" : "snow";
  if (type === "storm" && uWind > 0.85 && temperature >= 10 && temperature <= 28) type = "hail";
  // Dry, windy hours: a gale, or a sandstorm where there is loose ground.
  const calmSky = type === "clear" || type === "cloudy" || type === "overcast";
  const windy = 1 - (0.07 + z.wind * 0.35);
  if (calmSky && uWind > windy) {
    const dust =
      climate.sandy && (climate.zone === "hot_desert" || climate.zone === "cold_desert" || climate.zone === "steppe");
    type = dust && uWind > 1 - (1 - windy) * 0.45 ? "sandstorm" : "wind";
  }
  temperature = temperatureFor(air, hour, type);
  // A heat wave: a hot spell well above the season's norm, on a clear or dry day.
  if ((type === "clear" || type === "cloudy") && air.uWarm > 0.85 && temperature >= 30 && hour >= 9 && hour <= 20) {
    type = "heat_wave";
    temperature += 3;
  }
  const [low, high] = plausibleRange(air, climate, hour);
  return {
    type,
    temperature: Math.round(temperature),
    wind: windOf(uWind, type),
    visibility: VISIBILITY[type],
    zone: climate.zone,
    season: local.season,
    seasonLabel: local.label,
    impossible: impossibleNow(climate, low, high),
  };
}

/** The nearest weather the place could have to one it cannot. */
const NEAREST: Partial<Record<WeatherType, WeatherType[]>> = {
  snow: ["rain", "overcast", "wind"],
  blizzard: ["storm", "sandstorm", "wind"],
  heat_wave: ["clear"],
  rain: ["snow", "overcast"],
  heavy_rain: ["snow", "overcast"],
  storm: ["blizzard", "heavy_rain", "wind"],
  hail: ["storm", "snow", "wind"],
  sandstorm: ["wind"],
  fog: ["overcast"],
  wind: ["cloudy"],
};

/**
 * A weather the Game Master or the scene asked for, made to fit the place: kept when it could happen
 * here now (a rare desert storm can), else the nearest that could (snow in a hot desert is a cold wind,
 * a blizzard in the jungle a thunderstorm). The temperature follows what is falling.
 */
export function worldWeatherFit(
  input: WorldWeatherInput,
  wanted: WeatherType,
  /** A hold the Game Master put on the place (a curse, a power, environment.ts): kept whatever the climate. */
  held = false,
): WorldWeather & { asked: WeatherType } {
  const natural = worldWeatherAt(input);
  const local = { zone: natural.zone, season: natural.season, seasonLabel: natural.seasonLabel };
  let type = wanted;
  if (!held && natural.impossible.includes(type)) {
    const options = NEAREST[type] ?? [];
    type = options.find((each) => !natural.impossible.includes(each)) ?? natural.type;
  }
  if (!held && (input.climate.zone === "space" || input.climate.zone === "underground")) type = "clear";
  const air = airAt(input);
  let temperature = temperatureFor(air, input.hour, type);
  if (type === "snow") temperature = Math.min(temperature, 1);
  if (type === "blizzard") temperature = Math.min(temperature, -3);
  if (type === "heat_wave") temperature = Math.max(temperature + 3, 32);
  if (type === "storm" || type === "hail") temperature = Math.max(temperature, 8);
  if (!held && (input.climate.zone === "space" || input.climate.zone === "underground"))
    temperature = input.climate.meanTemp;
  return {
    ...local,
    type,
    temperature: Math.round(temperature),
    wind: windOf(air.uWind, type),
    visibility: VISIBILITY[type],
    impossible: natural.impossible,
    asked: wanted,
  };
}

/** One line for the Game Master on the climate and what the place cannot have now. */
export function worldWeatherNote(weather: Pick<WorldWeather, "zone" | "seasonLabel" | "impossible">): string {
  const cannot = weather.impossible.filter((type) => type !== "clear").map((type) => type.replace(/_/g, " "));
  return `Climate here: ${WORLD_CLIMATE_LABELS[weather.zone]}, ${weather.seasonLabel}.${
    cannot.length ? ` Not possible here now: ${cannot.join(", ")}.` : ""
  }`;
}

/**
 * The season the overworld draws a map in: the calendar's in the north, the opposite on a map south of the
 * equator, and always the green of summer where there is no winter to show (the wet tropics, hot deserts).
 * Read at the map's middle; a story's held seasons still draw over it place by place.
 */
export function worldDrawnSeason(game: GameWorld, day: number): WorldSeason {
  const { width, height } = game.world;
  const climate = worldClimateAt(game, Math.floor(height / 2) * width + Math.floor(width / 2));
  if (climate.zone === "space" || climate.zone === "underground") return worldSeason(day);
  if (climate.zone === "rainforest" || climate.zone === "savanna" || climate.zone === "hot_desert") return "summer";
  return worldLocalSeason(climate, day).season;
}
