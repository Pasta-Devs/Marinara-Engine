// ──────────────────────────────────────────────
// Region spawns (Overworld, 2026-11-13): every stretch of the map has a fixed level band and a spawn
// table, so the world does not grow with the party and the Game Master cannot conjure whatever a player
// asks for. A band is a pure function of the map cell: it rises with the distance from where the world
// starts the party and with harsh ground (mountains, deserts, ruins), and sits lower by settlements and
// on the roads between them. The world's creator can set the band of a settlement's land by hand
// (`edits.bands`). A cell's table holds the setting's bestiary families whose habitats fit its ground.
//
// Dungeons and other sites build on these bands (the dungeon thread's site bands start from the band of
// the site's cell); everything inside a site is theirs.
// ──────────────────────────────────────────────
import {
  MARINARA_BESTIARY,
  marinaraBestiaryFor,
  marinaraBuildEncounter,
  marinaraEnemyFamily,
  marinaraEnemyName,
  type MarinaraBestiarySetting,
  type MarinaraEncounterDifficulty,
  type MarinaraEncounterFoe,
  type MarinaraHabitat,
} from "../marinara-bestiary.js";
import { MARINARA_LEVEL_CAP, marinaraRandom } from "../marinara-classes.js";
import { WORLD_DAYS_PER_CELL, type WorldPlace } from "./compile.js";
import type { GameWorld } from "./game-world.js";
import { worldGroundCells, worldGroundLooks, worldRoute, type WorldGroundLook, type WorldWalk } from "./overworld.js";

export interface WorldCell {
  x: number;
  y: number;
}

/** A stretch of land's level band: every foe of its own is between these levels, both included. */
export interface WorldLevelBand {
  low: number;
  high: number;
}

/** How wide a band is: its low level and the three above it. */
export const WORLD_BAND_WIDTH = 4;

/** How far the bands climb from where the party starts to the far edge of the map, by the map's scale. A
 *  small map (a town, a site) climbs slowly (owner 2026-11-14): its later danger comes from the creator's
 *  hand bands and the Game Master's `[danger:]` tags as the story moves, not from walking across town. */
export const WORLD_BAND_CLIMB: Record<GameWorld["kit"]["scale"], number> = {
  site: 3,
  town: 6,
  region: 22,
  realm: 24,
  world: 26,
  sector: 24,
};

/** How much harder than open grass each ground is, in levels (smoothed over its neighbours). */
const LOOK_HARSHNESS: Record<WorldGroundLook, number> = {
  grass: 0,
  plains: 0,
  farmland: -1,
  paddies: -1,
  suburb: -1,
  forest: 1,
  autumn_forest: 1,
  conifer_forest: 1,
  bamboo: 1,
  hills: 1,
  scrub: 1,
  city: 1,
  industry: 1,
  slums: 2,
  jungle: 2,
  marsh: 2,
  desert: 2,
  snow: 2,
  sea: 1,
  lake: 0,
  space: 0,
  asteroids: 1,
  nebula: 2,
  mountains: 3,
  craters: 3,
  dead_forest: 3,
  wasteland: 3,
  ruins: 3,
  toxic_water: 3,
  gravity_well: 3,
};

/** The habitats a ground's foes live in (the bestiary's `habitats`). Open space has the stations and wrecks. */
const LOOK_HABITATS: Record<WorldGroundLook, readonly MarinaraHabitat[]> = {
  grass: ["grassland"],
  plains: ["grassland"],
  farmland: ["grassland"],
  paddies: ["grassland", "swamp"],
  suburb: ["urban", "grassland"],
  city: ["urban"],
  industry: ["urban", "ruins"],
  slums: ["urban", "ruins"],
  forest: ["forest"],
  autumn_forest: ["forest"],
  conifer_forest: ["forest", "snow"],
  bamboo: ["forest"],
  jungle: ["forest", "swamp"],
  dead_forest: ["forest", "ruins"],
  hills: ["grassland", "mountain"],
  scrub: ["grassland", "desert"],
  marsh: ["swamp"],
  desert: ["desert"],
  snow: ["snow"],
  wasteland: ["desert", "ruins"],
  ruins: ["ruins"],
  mountains: ["mountain"],
  craters: ["mountain", "desert"],
  sea: ["coast"],
  lake: ["coast"],
  toxic_water: ["swamp", "coast"],
  space: ["urban", "ruins"],
  nebula: ["urban", "ruins"],
  asteroids: ["ruins", "mountain"],
  gravity_well: ["ruins"],
};

const WATER_LOOKS: ReadonlySet<WorldGroundLook> = new Set(["sea", "lake", "toxic_water"]);

/** How the game's difficulty moves every band (Easy games are gentler, Brutal ones meaner). */
export const WORLD_BAND_DIFFICULTY_SHIFT: Record<string, number> = { casual: -2, normal: 0, hard: 1, brutal: 2 };

/** Smoothing reach for harshness, in cells, so a band is a patch of land rather than a speckle. */
const SMOOTH = 2;

interface BandGrid {
  /** Each cell's band centre before the difficulty and hand edits. */
  centre: Float32Array;
  /** Each cell's nearest settlement, by index into `settlements`. */
  nearest: Int16Array;
  settlements: WorldPlace[];
  looks: WorldGroundLook[];
  ground: Uint8Array;
}

const grids = new WeakMap<object, BandGrid>();

const settlementsOf = (game: GameWorld) => game.world.places.filter((place) => place.rank !== undefined);

/** Cells on a straight line between two points (both ends included). */
function lineCells(from: WorldCell, to: WorldCell): WorldCell[] {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
  const cells: WorldCell[] = [];
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(from.x + ((to.x - from.x) * step) / steps);
    const y = Math.round(from.y + ((to.y - from.y) * step) / steps);
    if (!cells.length || cells.at(-1)!.x !== x || cells.at(-1)!.y !== y) cells.push({ x, y });
  }
  return cells;
}

function bandGrid(game: GameWorld): BandGrid {
  const cached = grids.get(game.world);
  if (cached) return cached;
  const { world } = game;
  const { width, height } = world;
  const looks = worldGroundLooks(game);
  const ground = worldGroundCells(world);
  const settlements = settlementsOf(game);
  const startPlace = world.places.find((place) => place.id === world.startId);
  const start = (startPlace?.rank !== undefined ? startPlace : undefined)?.at ??
    (startPlace?.parentId ? settlements.find((place) => place.id === startPlace.parentId)?.at : undefined) ??
    startPlace?.at ?? { x: width / 2, y: height / 2 };
  // How far the far edge is from the start, so the climb spans the map whatever its size.
  const far = Math.max(
    ...[
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ].map(([x, y]) => Math.hypot(x! - start.x, y! - start.y)),
    1,
  );
  const climb = WORLD_BAND_CLIMB[game.kit.scale] ?? 14;
  // Harshness by ground, smoothed over a box round each cell.
  const harsh = new Float32Array(width * height);
  for (let cell = 0; cell < harsh.length; cell++) harsh[cell] = LOOK_HARSHNESS[looks[ground[cell]!] ?? "grass"] ?? 0;
  const smooth = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -SMOOTH; dy <= SMOOTH; dy++)
        for (let dx = -SMOOTH; dx <= SMOOTH; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += harsh[ny * width + nx]!;
          count++;
        }
      smooth[y * width + x] = sum / count;
    }
  // The roads between settlements are kept: a little calmer than the land either side.
  const road = new Uint8Array(width * height);
  const byId = new Map(world.places.map((place) => [place.id, place]));
  for (const link of world.links) {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b) continue;
    for (const cell of lineCells(a.at, b.at)) if (cell.x < width && cell.y < height) road[cell.y * width + cell.x] = 1;
  }
  // The start's own ground sets the floor: a party that starts in a fen or a desert meets that land at 1 to 4,
  // and only land harsher than its own climbs above it.
  const startHarsh = Math.max(
    0,
    smooth[
      Math.max(0, Math.min(height - 1, Math.round(start.y))) * width +
        Math.max(0, Math.min(width - 1, Math.round(start.x)))
    ] ?? 0,
  );
  const centre = new Float32Array(width * height);
  const nearest = new Int16Array(width * height).fill(-1);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      let best = -1;
      let bestDistance = Infinity;
      settlements.forEach((place, index) => {
        const d = Math.hypot(place.at.x - x, place.at.y - y);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      nearest[cell] = best;
      // By a settlement the land is watched; on the road a little, too.
      const calm = bestDistance <= 1 ? 2 : bestDistance <= 3 ? 1 : 0;
      centre[cell] =
        2 + (Math.hypot(x - start.x, y - start.y) / far) * climb + smooth[cell]! - startHarsh - calm - road[cell]!;
    }
  const grid = { centre, nearest, settlements, looks, ground };
  grids.set(game.world, grid);
  return grid;
}

const clampLevel = (level: number) => Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(level)));

/** A band whose low level is `low`, kept inside the level cap. */
function bandFrom(low: number): WorldLevelBand {
  const start = Math.max(1, Math.min(MARINARA_LEVEL_CAP - WORLD_BAND_WIDTH + 1, Math.round(low)));
  return { low: start, high: start + WORLD_BAND_WIDTH - 1 };
}

const cellIndex = (game: GameWorld, at: WorldCell) => {
  const x = Math.max(0, Math.min(game.world.width - 1, Math.round(at.x)));
  const y = Math.max(0, Math.min(game.world.height - 1, Math.round(at.y)));
  return y * game.world.width + x;
};

/**
 * The level band of a map cell: fixed for the whole game, never following the party. The start's land is
 * 1 to 4. The world's creator may set the band of a settlement's land by hand (`edits.bands`), which holds
 * for every cell nearer that settlement than any other. The game's difficulty shifts every band.
 */
export function worldRegionBand(game: WorldBandGame, at: WorldCell, difficulty?: string | null): WorldLevelBand {
  const grid = bandGrid(game);
  const cell = cellIndex(game, at);
  const shift = WORLD_BAND_DIFFICULTY_SHIFT[difficulty ?? "normal"] ?? 0;
  const home = grid.settlements[grid.nearest[cell]!];
  // The story's band (the Game Master's [danger:] tags) wins over the creator's, which wins over the map's.
  const byHand = home
    ? (game.storyBands?.get(home.id) ?? game.edits?.bands?.find((band) => band.place === home.id))
    : undefined;
  if (byHand) {
    const low = clampLevel(byHand.low + shift);
    return { low, high: Math.max(low, clampLevel(byHand.high + shift)) };
  }
  return bandFrom(grid.centre[cell]! - 1 + shift);
}

/** A world with the bands the story has set (the Game Master's `[danger:]` tags in the replies so far), by
 *  settlement id. Every band reader takes one; a plain world reads the creator's and the map's bands only. */
export type WorldBandGame = GameWorld & { storyBands?: ReadonlyMap<string, WorldLevelBand> };

/** A Game Master's `[danger:]` tag: a settlement's land set to a band, or put back to the creator's and map's. */
export interface WorldDangerTag {
  name: string;
  band?: WorldLevelBand;
  reset?: true;
}

/** The widest band the Game Master may set. */
export const WORLD_STORY_BAND_MAX_WIDTH = 6;

/** Reads `[danger: place="Ashby" low="8" high="11"]` and `[danger: place="Ashby" reset]` (high defaults to
 *  low + 3; a band is kept inside the level cap and at most six levels wide). */
export function readWorldDangerTags(text: string): WorldDangerTag[] {
  const tags: WorldDangerTag[] = [];
  const opener = /\[danger:/giu;
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const close = text.indexOf("]", opener.lastIndex);
    if (close < 0) break;
    const body = text.slice(opener.lastIndex, close);
    opener.lastIndex = close + 1;
    const value = (key: string) =>
      body
        .match(new RegExp(`\\b${key}\\s*=\\s*"([^"]{0,80})"`, "iu"))?.[1]
        ?.replace(/[\p{Cc}\s]+/gu, " ")
        .trim();
    const name = value("place") ?? value("name");
    if (!name) continue;
    if (/\breset\b/iu.test(body.replace(/"[^"]*"/gu, ""))) {
      tags.push({ name, reset: true });
      continue;
    }
    const low = Number(value("low"));
    if (!Number.isFinite(low)) continue;
    const from = clampLevel(low);
    const asked = Number(value("high"));
    const high = Number.isFinite(asked) ? clampLevel(asked) : clampLevel(from + WORLD_BAND_WIDTH - 1);
    tags.push({
      name,
      band: { low: from, high: Math.min(Math.max(from, high), from + WORLD_STORY_BAND_MAX_WIDTH - 1) },
    });
  }
  return tags;
}

/** The settlement whose land a place names: the settlement itself, or the one nearest a place out in its land. */
function bandSettlementOf(game: GameWorld, name: string): WorldPlace | undefined {
  const lower = name.trim().toLowerCase();
  const place = game.world.places.find(
    (each) => each.name.toLowerCase() === lower || each.aliases?.some((alias) => alias.toLowerCase() === lower),
  );
  if (!place) return undefined;
  return place.rank !== undefined ? place : worldNearestSettlement(game, place.at);
}

/** The bands the story has set, read from the Game Master's replies so far (oldest first): a regenerated
 *  reply takes its tag with it. */
export function worldStoryBands(game: GameWorld, replies: readonly string[]): Map<string, WorldLevelBand> {
  const bands = new Map<string, WorldLevelBand>();
  for (const reply of replies) {
    if (!/\[danger:/iu.test(reply)) continue;
    for (const tag of readWorldDangerTags(reply)) {
      const settlement = bandSettlementOf(game, tag.name);
      if (!settlement) continue;
      if (tag.reset) bands.delete(settlement.id);
      else if (tag.band) bands.set(settlement.id, tag.band);
    }
  }
  return bands;
}

/** A world with the story's bands from these replies on it. */
export function worldWithStoryBands(game: GameWorld, replies: readonly string[]): WorldBandGame {
  const storyBands = worldStoryBands(game, replies);
  return storyBands.size ? { ...game, storyBands } : game;
}

/** Each settlement's band as it stands (story, hand or map, before difficulty), and where it came from:
 *  what the overworld's danger view shows and its band editor starts from. */
export function worldSettlementBands(
  game: WorldBandGame,
): Record<string, WorldLevelBand & { from: "map" | "edit" | "story"; map: WorldLevelBand }> {
  const out: Record<string, WorldLevelBand & { from: "map" | "edit" | "story"; map: WorldLevelBand }> = {};
  for (const place of settlementsOf(game)) {
    const map = worldSettlementBand(game, place.id)!;
    const story = game.storyBands?.get(place.id);
    const edit = game.edits?.bands?.find((band) => band.place === place.id);
    const band = story ?? edit ?? map;
    out[place.id] = { low: band.low, high: band.high, from: story ? "story" : edit ? "edit" : "map", map };
  }
  return out;
}

/** Each cell's band low level (difficulty applied) as one base-36 character a cell, row by row: what the
 *  overworld shades its danger view with. */
export function worldBandCells(game: WorldBandGame, difficulty?: string | null): string {
  let out = "";
  for (let y = 0; y < game.world.height; y++)
    for (let x = 0; x < game.world.width; x++) out += worldRegionBand(game, { x, y }, difficulty).low.toString(36);
  return out;
}

/** The band of a settlement's own land, as the world made it (before any hand edit or difficulty): what the
 *  world editor shows next to a settlement it lets the creator re-band. */
export function worldSettlementBand(game: GameWorld, placeId: string): WorldLevelBand | null {
  const grid = bandGrid(game);
  const index = grid.settlements.findIndex((place) => place.id === placeId);
  if (index < 0) return null;
  const place = grid.settlements[index]!;
  // The start's land is the first band, whatever its ground.
  const startPlace = game.world.places.find((each) => each.id === game.world.startId);
  if (place.id === startPlace?.id || place.id === startPlace?.parentId) return bandFrom(1);
  // The land round it: the cells it is nearest, at most four cells out, averaged.
  let sum = 0;
  let count = 0;
  const { width, height } = game.world;
  for (let y = Math.max(0, place.at.y - 4); y <= Math.min(height - 1, place.at.y + 4); y++)
    for (let x = Math.max(0, place.at.x - 4); x <= Math.min(width - 1, place.at.x + 4); x++) {
      const cell = y * width + x;
      if (grid.nearest[cell] !== index) continue;
      sum += grid.centre[cell]!;
      count++;
    }
  return bandFrom((count ? sum / count : grid.centre[cellIndex(game, place.at)]!) - 1);
}

/** The ground a cell has, as the overworld draws it. */
export function worldCellLook(game: GameWorld, at: WorldCell): WorldGroundLook {
  const grid = bandGrid(game);
  return grid.looks[grid.ground[cellIndex(game, at)]!] ?? "grass";
}

/** The habitats a cell's foes come from: its ground's, and the shore's where water is beside it. */
export function worldCellHabitats(game: GameWorld, at: WorldCell): MarinaraHabitat[] {
  const grid = bandGrid(game);
  const { width, height } = game.world;
  const look = worldCellLook(game, at);
  const habitats = new Set<MarinaraHabitat>(LOOK_HABITATS[look] ?? ["grassland"]);
  // Water itself is fought on its shore: the land beside it lends its own habitats too.
  const x0 = Math.round(at.x);
  const y0 = Math.round(at.y);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x >= width || y >= height) continue;
      const beside = grid.looks[grid.ground[y * width + x]!] ?? "grass";
      if (WATER_LOOKS.has(beside) && !WATER_LOOKS.has(look)) habitats.add("coast");
      if (WATER_LOOKS.has(look) && !WATER_LOOKS.has(beside))
        for (const h of LOOK_HABITATS[beside] ?? []) habitats.add(h);
    }
  return [...habitats];
}

/** A cell's main habitat: the first of its ground's. */
export function worldCellHabitat(game: GameWorld, at: WorldCell): MarinaraHabitat {
  return (LOOK_HABITATS[worldCellLook(game, at)] ?? ["grassland"])[0]!;
}

/** The fewest families a table should offer; a thinner one borrows from open country, then the whole setting. */
const TABLE_MIN = 3;

/** One family of a region's spawn table: its id and its name at the band's middle. */
export interface WorldSpawnEntry {
  familyId: string;
  name: string;
}

export interface WorldSpawnTable {
  band: WorldLevelBand;
  habitats: MarinaraHabitat[];
  families: WorldSpawnEntry[];
}

/** The families a setting has somewhere in a band, never a treasure foe (those come by the rare roll). */
function familiesInBand(setting: MarinaraBestiarySetting, band: WorldLevelBand) {
  const seen = new Map<string, (typeof MARINARA_BESTIARY)[number]>();
  for (let level = band.low; level <= band.high; level++)
    for (const family of marinaraBestiaryFor(setting, level)) if (!seen.has(family.id)) seen.set(family.id, family);
  return [...seen.values()];
}

/**
 * A cell's spawn table: the setting's families that live in its habitats and exist in its band. A table
 * thinner than three families (a 1920s swamp, a modern coast) takes in the open country's families, then
 * any of the setting's, so no fight is ever without foes.
 */
export function worldRegionSpawnTable(
  game: WorldBandGame,
  at: WorldCell,
  setting: MarinaraBestiarySetting,
  difficulty?: string | null,
): WorldSpawnTable {
  const band = worldRegionBand(game, at, difficulty);
  const habitats = worldCellHabitats(game, at);
  const all = familiesInBand(setting, band);
  const living = (wanted: readonly MarinaraHabitat[]) =>
    all.filter((family) => family.habitats?.some((habitat) => wanted.includes(habitat)));
  let chosen = living(habitats);
  if (chosen.length < TABLE_MIN) chosen = [...new Set([...chosen, ...living(["grassland", "urban"])])];
  if (chosen.length < TABLE_MIN) chosen = all.filter((family) => family.habitats?.length);
  const middle = Math.round((band.low + band.high) / 2);
  return {
    band,
    habitats,
    families: chosen.map((family) => ({
      familyId: family.id,
      name:
        marinaraEnemyName(family, setting, Math.min(Math.max(middle, family.levels[0]), family.levels[1])) ??
        marinaraEnemyName(family, setting, band.low) ??
        family.id,
    })),
  };
}

/** A fight a region's own land throws at the party: where, at what level, and who. */
export interface WorldRegionEncounter {
  at: WorldCell;
  look: WorldGroundLook;
  band: WorldLevelBand;
  level: number;
  foes: MarinaraEncounterFoe[];
}

/** Builds a fight from a cell's table: every foe at a level inside its band, sized for a party of that band
 *  (an outmatched party meets the land as it is, and the fight start trims it, never re-levels it). */
export function worldRollRegionFoes(input: {
  game: WorldBandGame;
  at: WorldCell;
  setting: MarinaraBestiarySetting;
  difficulty?: string | null;
  partySize: number;
  random: () => number;
  encounter?: MarinaraEncounterDifficulty;
}): WorldRegionEncounter | null {
  const table = worldRegionSpawnTable(input.game, input.at, input.setting, input.difficulty);
  if (!table.families.length) return null;
  const level = table.band.low + Math.floor(input.random() * (table.band.high - table.band.low + 1));
  const built = marinaraBuildEncounter({
    setting: input.setting,
    party: { level, size: Math.max(1, input.partySize) },
    difficulty: input.encounter ?? "normal",
    random: input.random,
    pool: table.families.map((entry) => entry.familyId),
  });
  if (!built.foes.length) return null;
  return { at: input.at, look: worldCellLook(input.game, input.at), band: table.band, level, foes: built.foes };
}

// ── Chance encounters on the road ──

/** The chance of meeting the land's foes per day of travel through a cell, before its danger. */
export const WORLD_ENCOUNTER_PER_DAY = 0.2;
/** At most this chance of a fight on one walk, however long. */
export const WORLD_ENCOUNTER_CAP = 0.85;
const DIFFICULTY_ENCOUNTERS: Record<string, number> = { casual: 0.5, normal: 1, hard: 1.3, brutal: 1.6 };

/** The cells a walk crosses, from the place it set out from to the place it ended: along the world's links
 *  between the settlements on its way; for a trip out and back, the land round where it set out. */
export function worldWalkCells(game: GameWorld, walk: Pick<WorldWalk, "from" | "to">): WorldCell[] {
  const byId = new Map(game.world.places.map((place) => [place.id, place]));
  const from = byId.get(walk.from);
  if (!from) return [];
  if (walk.from === walk.to) {
    const cells: WorldCell[] = [];
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = from.at.x + dx;
        const y = from.at.y + dy;
        if (x >= 0 && y >= 0 && x < game.world.width && y < game.world.height && Math.hypot(dx, dy) >= 2)
          cells.push({ x, y });
      }
    return cells;
  }
  const route = worldRoute(game.world, walk.from, walk.to);
  const path = route ? route.path.map((id) => byId.get(id)).filter((place): place is WorldPlace => !!place) : [];
  const stops = path.length >= 2 ? path : [from, byId.get(walk.to)].filter((place): place is WorldPlace => !!place);
  const cells: WorldCell[] = [];
  for (let i = 1; i < stops.length; i++) {
    const leg = lineCells(stops[i - 1]!.at, stops[i]!.at);
    cells.push(...(i === 1 ? leg : leg.slice(1)));
  }
  return cells;
}

/**
 * Whether a walk meets the land's own foes on the way, and who: seeded by the walk, so telling it again (a
 * regenerated reply) meets the same foes. Each cell crossed adds its chance by the days it takes and its
 * danger (its band's harshness over the start's); water crossed by boat and the cells by a settlement are
 * safe. Null on a quiet road.
 */
export function worldWalkEncounter(input: {
  game: WorldBandGame;
  walk: Pick<WorldWalk, "id" | "from" | "to">;
  setting: MarinaraBestiarySetting;
  difficulty?: string | null;
  partySize: number;
}): WorldRegionEncounter | null {
  const { game } = input;
  const grid = bandGrid(game);
  const random = marinaraRandom(`region-walk:${game.seed}:${input.walk.id}`);
  // A town's or a site's map is crossed in hours, but its streets have their own trouble: never less than an eighth of a day's chance a cell.
  const perCell = Math.max(1 / 8, WORLD_DAYS_PER_CELL[game.kit.scale] ?? 1 / 4);
  const more = DIFFICULTY_ENCOUNTERS[input.difficulty ?? "normal"] ?? 1;
  const weights = worldWalkCells(game, input.walk).map((cell) => {
    const index = cellIndex(game, cell);
    const look = grid.looks[grid.ground[index]!] ?? "grass";
    const home = grid.settlements[grid.nearest[index]!];
    if (WATER_LOOKS.has(look) || (home && Math.hypot(home.at.x - cell.x, home.at.y - cell.y) <= 1)) return 0;
    const danger = 1 + Math.max(0, LOOK_HARSHNESS[look] ?? 0) * 0.25;
    return Math.min(0.9, perCell * WORLD_ENCOUNTER_PER_DAY * danger * more);
  });
  const quiet = weights.reduce((left, p) => left * (1 - p), 1);
  if (random() >= Math.min(WORLD_ENCOUNTER_CAP, 1 - quiet)) return null;
  const total = weights.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return null;
  const cells = worldWalkCells(game, input.walk);
  let roll = random() * total;
  let at = cells[0]!;
  for (let i = 0; i < cells.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0 && weights[i]! > 0) {
      at = cells[i]!;
      break;
    }
  }
  return worldRollRegionFoes({
    game,
    at,
    setting: input.setting,
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    partySize: input.partySize,
    random,
  });
}

/** The nearest settlement to a cell, for telling where on the road a fight happens. */
export function worldNearestSettlement(game: GameWorld, at: WorldCell): WorldPlace | undefined {
  const grid = bandGrid(game);
  return grid.settlements[grid.nearest[cellIndex(game, at)]!];
}

/** The foes of a region encounter, one line each, as the Game Master is told them. */
export function worldRegionFoeLines(setting: MarinaraBestiarySetting, foes: readonly MarinaraEncounterFoe[]): string[] {
  const groups = new Map<string, { name: string; tier: string; level: number; count: number }>();
  for (const foe of foes) {
    const family = marinaraEnemyFamily(foe.familyId);
    const name = (family && marinaraEnemyName(family, setting, foe.level)) ?? foe.familyId;
    const key = `${name}|${foe.tier}|${foe.level}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { name, tier: foe.tier, level: foe.level, count: 1 });
  }
  return [...groups.values()].map(
    (group) =>
      `${group.count > 1 ? `${group.count} × ` : ""}${group.name} (${group.tier === "standard" ? "" : `${group.tier}, `}level ${group.level})`,
  );
}

/** What the Game Master is told of a fight the road brought: where, who, and that it may not change them. */
export function worldRegionEncounterText(
  game: GameWorld,
  setting: MarinaraBestiarySetting,
  encounter: WorldRegionEncounter,
): string {
  const near = worldNearestSettlement(game, encounter.at);
  const kitTerrain = game.kit.terrain ?? [];
  const index = bandGrid(game).ground[cellIndex(game, encounter.at)]!;
  const ground = kitTerrain.find((entry) => entry.id === game.world.terrain[index])?.label ?? encounter.look;
  return [
    `On the way, in the ${ground.toLowerCase()}${near ? ` near ${near.name}` : ""}, the party meets the land's own foes: ${worldRegionFoeLines(setting, encounter.foes).join(", ")}.`,
    `They are what lives here (foes of this land are level ${encounter.band.low} to ${encounter.band.high}): tell the meeting as part of the journey and start the fight with a [combat] tag naming them. Do not add, swap or re-level them.`,
  ].join(" ");
}

/** One line for the Game Master on the party's surroundings: how dangerous the land is for the party, so
 *  it can warn of it (rumours, signs, wary locals) before the party walks into more than it can take. */
export function worldRegionDangerText(
  game: WorldBandGame,
  at: WorldCell,
  partyLevel: number,
  difficulty?: string | null,
): string {
  const band = worldRegionBand(game, at, difficulty);
  const gap = band.low - Math.round(partyLevel);
  const how =
    gap >= 3
      ? "far beyond the party: warn them plainly (locals, rumours, signs of what lives here) and let them turn back or flee"
      : gap >= 1
        ? "a stretch above the party: hint at the danger"
        : band.high < partyLevel - 4
          ? "well below the party: its foes are no real threat any more"
          : "about right for the party";
  const near = worldNearestSettlement(game, at);
  return [
    `The land round here holds foes of level ${band.low} to ${band.high}, ${how}. Foes come from what lives here, never at a player's asking.`,
    `When the story changes how dangerous a settlement's land is (an army or a monster moves in, a lair is cleared, a war ends), set its band with [danger: place="${near?.name ?? "Settlement"}" low="N" high="N"] (at most ${WORLD_STORY_BAND_MAX_WIDTH} levels wide), or put it back with [danger: place="..." reset]. Only for a change the story has shown, never because a player asked.`,
  ].join(" ");
}

/** Why a layer's hand-set bands do not fit its world, or nothing: each on a settlement, one band a place. */
export function worldBandEditIssues(game: GameWorld, edits: { bands?: ReadonlyArray<{ place: string }> }): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const band of edits.bands ?? []) {
    const place = game.world.places.find((each) => each.id === band.place);
    if (!place) issues.push(`No place "${band.place}" to set a level band for.`);
    else if (place.rank === undefined)
      issues.push(`${place.name} is not a settlement: bands are set for a settlement's land.`);
    else if (seen.has(band.place)) issues.push(`${place.name} has two level bands.`);
    seen.add(band.place);
  }
  return issues;
}
