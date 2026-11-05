// ──────────────────────────────────────────────
// Tactical Combat — seeded procedural grid + spawn placement
// ──────────────────────────────────────────────
// Deterministic given the rng stream: terrain clusters (forest/mountain/ruin/
// water/wall blobs) over a plains base, spawn columns kept clear, and a
// guaranteed-connected corridor carved between the party (left) and enemy
// (right) spawn strips so a battle can never generate an unwinnable no-path map.
//
// Round 2: terrain-blob WEIGHTS are themed by `environment`, and spawn placement
// is arranged by `formation` (line/ambush/surrounded/skirmish/defense). Whatever
// the formation, placement guarantees (see placeSpawns): every unit lands on a
// passable tile, no two units share a tile, and every enemy is BFS-reachable
// from every party unit (corridors are carved to a central hub when needed).

import { clamp, climbCost, isImpassable, manhattan } from "./math.js";
import { TERRAIN_DATA } from "./types.js";
import {
  TACTICAL_BOARD_OUTLINES,
  tacticalOutlineCells,
  tacticalOutlineFor,
  type TacticalBoardOutline,
} from "./board-outline.js";
import type {
  TacticalBattlefieldBrief,
  TacticalBattlefieldFeature,
  TacticalBattlefieldProvenance,
  TacticalBattlefieldSize,
  TacticalCoord,
  TacticalEnvironment,
  TacticalFormation,
  TacticalGrid,
  TacticalMadeBattlefield,
  TacticalTerrain,
  TacticalUnit,
} from "./types.js";

/** Increment when a generated brief's resolved-grid semantics intentionally change. Version 2 (combat C6b)
 *  adds foothills: the same tiles as version 1 for the same seed, with height read off them. */
export const TACTICAL_BATTLEFIELD_GENERATOR_VERSION = 3 as const;

/**
 * Foothills (combat C6b): a mountain stands two levels high, ground beside one (any of its eight
 * neighbours) one level, and everything else is level ground. A generated board so only ever slopes one
 * level a step, even diagonally, and has no cliff; cliffs are for boards painted by hand. Read from the
 * tiles alone, with no dice, so a seed still lays out the tiles it always did. None on a board with no
 * mountain, which stays flat. Read after deployment, which may clear a mountain to make room.
 */
export function foothillElevation(grid: TacticalGrid): number[][] | undefined {
  const mountain = (x: number, y: number) => grid.tiles[y]?.[x] === "mountain";
  let any = false;
  const elevation = grid.tiles.map((row, y) =>
    row.map((terrain, x) => {
      if (terrain === "mountain") {
        any = true;
        return 2;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (mountain(x + dx, y + dy)) return 1;
      return 0;
    }),
  );
  return any ? elevation : undefined;
}

/**
 * The only thing placement reads off a unit: which side it is on, whether it anchors the group, and
 * the tile it ends up on. A `TacticalUnit` is one of these; so is a stand-in for a combatant of a
 * fight some ruleset resolves by its own numbers, which never becomes a tactical unit at all.
 */
export interface TacticalPlaceable {
  side: TacticalUnit["side"];
  isBoss?: boolean;
  /** How far it keeps from the rest of its side, where it can (combat AI S1a): past the size of a
   *  blast the other side holds, for one that thinks ahead about it. */
  spread?: number;
  x: number;
  y: number;
}

/** The larger three (2026-10-24, Alyssa): a great hall or a big blast's room to spread out, a lair
 *  (a dragon's castle ruins), a war's battlefield. 64 across is the most a board may be. */
const BATTLEFIELD_SIZES: Record<TacticalBattlefieldSize, { width: number; height: number }> = {
  small: { width: 12, height: 8 },
  medium: { width: 13, height: 9 },
  large: { width: 14, height: 10 },
  huge: { width: 24, height: 16 },
  vast: { width: 40, height: 26 },
  colossal: { width: 64, height: 40 },
};

const FEATURE_PLACEMENTS = ["center", "north", "south", "east", "west"] as const;
const FEATURE_SHAPES = ["patch", "barrier"] as const;

function hasOwnKey(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export type TacticalBattlefieldBriefValidation =
  { ok: true; brief?: TacticalBattlefieldBrief } | { ok: false; error: string };

/**
 * Validates only the bounded structured brief. Board-specific checks happen
 * after placement because they depend on the resolved dimensions.
 */
export function validateTacticalBattlefieldBrief(value: unknown): TacticalBattlefieldBriefValidation {
  if (value === undefined) return { ok: true };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, error: "Invalid battlefield brief." };
  const source = value as {
    size?: unknown;
    features?: unknown;
    exposure?: unknown;
    outline?: unknown;
    scatter?: unknown;
  };
  if (
    source.exposure !== undefined &&
    (typeof source.exposure !== "string" || !["exposed", "sheltered", "unknown"].includes(source.exposure))
  )
    return { ok: false, error: "Unknown battlefield exposure." };
  if (source.size !== undefined && (typeof source.size !== "string" || !hasOwnKey(BATTLEFIELD_SIZES, source.size))) {
    return { ok: false, error: "Unknown battlefield size." };
  }
  if (
    source.outline !== undefined &&
    (typeof source.outline !== "string" || !TACTICAL_BOARD_OUTLINES.includes(source.outline as TacticalBoardOutline))
  ) {
    return { ok: false, error: "Unknown battlefield outline." };
  }
  const scatter = source.scatter as { terrain?: unknown; share?: unknown } | undefined;
  if (
    scatter !== undefined &&
    (!scatter ||
      typeof scatter !== "object" ||
      typeof scatter.terrain !== "string" ||
      scatter.terrain === "plains" ||
      !hasOwnKey(TERRAIN_DATA, scatter.terrain) ||
      typeof scatter.share !== "number" ||
      !(scatter.share >= 0.05 && scatter.share <= 0.6))
  ) {
    return { ok: false, error: "Scattered terrain needs a terrain other than plains and a share from 0.05 to 0.6." };
  }
  if (source.features !== undefined && !Array.isArray(source.features)) {
    return { ok: false, error: "Battlefield features must be a list." };
  }
  if ((source.features?.length ?? 0) > 4) return { ok: false, error: "A battlefield can have at most four features." };

  const seen = new Set<string>();
  const features: TacticalBattlefieldFeature[] = [];
  for (const rawFeature of source.features ?? []) {
    if (!rawFeature || typeof rawFeature !== "object" || Array.isArray(rawFeature))
      return { ok: false, error: "Invalid battlefield feature." };
    const feature = rawFeature as { terrain?: unknown; placement?: unknown; shape?: unknown };
    if (!(typeof feature.terrain === "string" && hasOwnKey(TERRAIN_DATA, feature.terrain))) {
      return { ok: false, error: "Unknown battlefield terrain." };
    }
    if (!(
      typeof feature.placement === "string" &&
      FEATURE_PLACEMENTS.includes(feature.placement as (typeof FEATURE_PLACEMENTS)[number])
    )) {
      return { ok: false, error: "Unknown battlefield feature placement." };
    }
    if (!(
      typeof feature.shape === "string" && FEATURE_SHAPES.includes(feature.shape as (typeof FEATURE_SHAPES)[number])
    )) {
      return { ok: false, error: "Unknown battlefield feature shape." };
    }
    if (feature.shape === "barrier" && !TERRAIN_DATA[feature.terrain as TacticalTerrain].impassable) {
      return { ok: false, error: "Barrier features must use wall, water, or mountain terrain." };
    }
    const key = `${feature.terrain}:${feature.placement}:${feature.shape}`;
    if (seen.has(key)) return { ok: false, error: "Duplicate battlefield feature." };
    seen.add(key);
    features.push({
      terrain: feature.terrain as TacticalTerrain,
      placement: feature.placement as TacticalBattlefieldFeature["placement"],
      shape: feature.shape as TacticalBattlefieldFeature["shape"],
    });
  }

  return {
    ok: true,
    brief: {
      ...(source.exposure ? { exposure: source.exposure as TacticalBattlefieldBrief["exposure"] } : {}),
      ...(source.size ? { size: source.size as TacticalBattlefieldSize } : {}),
      ...(source.outline ? { outline: source.outline as TacticalBoardOutline } : {}),
      ...(features.length ? { features } : {}),
      ...(scatter
        ? {
            scatter: {
              terrain: scatter.terrain as Exclude<TacticalTerrain, "plains">,
              share: scatter.share as number,
            },
          }
        : {}),
    },
  };
}

/**
 * What can be kept of a brief that does not validate (laptop interim 2026-10-26: one barrier of
 * passable terrain threw away a whole defense board's brief): each of its size, outline and exposure
 * that is good on its own, and each good feature, a barrier of terrain that does not block made a
 * wall. Undefined when nothing of it is good.
 */
export function salvageTacticalBattlefieldBrief(value: unknown): TacticalBattlefieldBrief | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as {
    size?: unknown;
    features?: unknown;
    exposure?: unknown;
    outline?: unknown;
    scatter?: unknown;
  };
  const kept: Record<string, unknown> = {};
  for (const key of ["size", "outline", "exposure", "scatter"] as const) {
    if (source[key] !== undefined && validateTacticalBattlefieldBrief({ [key]: source[key] }).ok)
      kept[key] = source[key];
  }
  const features: unknown[] = [];
  for (const raw of Array.isArray(source.features) ? source.features : []) {
    if (features.length >= 4) break;
    const feature =
      raw &&
      typeof raw === "object" &&
      (raw as { shape?: unknown }).shape === "barrier" &&
      typeof (raw as { terrain?: unknown }).terrain === "string" &&
      hasOwnKey(TERRAIN_DATA, (raw as { terrain: string }).terrain) &&
      !TERRAIN_DATA[(raw as { terrain: TacticalTerrain }).terrain].impassable
        ? { ...(raw as object), terrain: "wall" }
        : raw;
    if (validateTacticalBattlefieldBrief({ features: [...features, feature] }).ok) features.push(feature);
  }
  if (features.length) kept.features = features;
  const checked = validateTacticalBattlefieldBrief(kept);
  return checked.ok && checked.brief && Object.keys(checked.brief).length > 0 ? checked.brief : undefined;
}

// ── Environment theming ──
// Blob weights over the five non-plains terrains, plus a density factor that
// scales the number of blobs (sparse deserts/plains vs. dense caves/swamps).
// Same 6 TacticalTerrain values everywhere — theming is purely weights here and
// palette client-side.

interface EnvProfile {
  weights: Record<Exclude<TacticalTerrain, "plains">, number>;
  /** Multiplies the base blob count (sparse < 1 < dense). */
  density: number;
}

const DEFAULT_PROFILE: EnvProfile = {
  weights: { forest: 4, mountain: 3, ruin: 3, water: 2, wall: 1 },
  density: 1.0,
};

const ENV_PROFILES: Record<TacticalEnvironment, EnvProfile> = {
  forest: { weights: { forest: 8, mountain: 2, ruin: 2, water: 1, wall: 1 }, density: 1.1 },
  dungeon: { weights: { forest: 0, mountain: 3, ruin: 3, water: 0, wall: 5 }, density: 1.0 },
  desert: { weights: { forest: 1, mountain: 2, ruin: 3, water: 0, wall: 1 }, density: 0.7 },
  cave: { weights: { forest: 0, mountain: 5, ruin: 1, water: 1, wall: 4 }, density: 1.1 },
  city: { weights: { forest: 1, mountain: 1, ruin: 5, water: 0, wall: 4 }, density: 1.0 },
  ruins: { weights: { forest: 2, mountain: 1, ruin: 6, water: 0, wall: 3 }, density: 1.0 },
  snow: { weights: { forest: 3, mountain: 3, ruin: 2, water: 2, wall: 1 }, density: 1.0 },
  water: { weights: { forest: 2, mountain: 1, ruin: 1, water: 6, wall: 1 }, density: 1.1 },
  castle: { weights: { forest: 0, mountain: 1, ruin: 4, water: 0, wall: 5 }, density: 1.0 },
  wasteland: { weights: { forest: 1, mountain: 2, ruin: 4, water: 0, wall: 2 }, density: 0.7 },
  plains: { weights: { forest: 2, mountain: 1, ruin: 1, water: 1, wall: 1 }, density: 0.5 },
  mountains: { weights: { forest: 2, mountain: 6, ruin: 1, water: 1, wall: 3 }, density: 1.1 },
  swamp: { weights: { forest: 4, mountain: 1, ruin: 1, water: 6, wall: 1 }, density: 1.1 },
  volcanic: { weights: { forest: 0, mountain: 4, ruin: 4, water: 0, wall: 3 }, density: 1.0 },
  spaceship: { weights: { forest: 0, mountain: 0, ruin: 4, water: 0, wall: 6 }, density: 1.0 },
  mansion: { weights: { forest: 1, mountain: 0, ruin: 5, water: 0, wall: 5 }, density: 1.0 },
};

function envProfile(environment?: TacticalEnvironment): EnvProfile {
  return environment ? ENV_PROFILES[environment] : DEFAULT_PROFILE;
}

const BLOB_TERRAINS: Exclude<TacticalTerrain, "plains">[] = ["forest", "mountain", "ruin", "water", "wall"];

function pickTerrain(weights: EnvProfile["weights"], rng: () => number): TacticalTerrain {
  const total = BLOB_TERRAINS.reduce((s, t) => s + weights[t], 0);
  if (total <= 0) return "plains";
  let roll = rng() * total;
  for (const t of BLOB_TERRAINS) {
    if (roll < weights[t]) return t;
    roll -= weights[t];
  }
  return "forest";
}

export function defaultBattlefieldSize(unitCount: number): TacticalBattlefieldSize {
  return unitCount > 20 ? "huge" : unitCount > 8 ? "large" : unitCount > 5 ? "medium" : "small";
}

/** Grid dimensions scale with the number of combatants. Default 12x8; past 20 fighters, 24x16. The
 *  vast and colossal boards only when asked for. */
export function gridDimensions(unitCount: number, size?: TacticalBattlefieldSize): { width: number; height: number } {
  return { ...BATTLEFIELD_SIZES[size ?? defaultBattlefieldSize(unitCount)] };
}

const SPAWN_COLS = 2;

/** A cell off the map (2026-10-24): outside the board's outline. Nothing is ever painted on it. */
function offMap(grid: TacticalGrid, x: number, y: number): boolean {
  return grid.outside?.[y]?.[x] === true;
}

function set(grid: TacticalGrid, x: number, y: number, terrain: TacticalTerrain): void {
  if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.width && y < grid.height)
    // fill() rather than an indexed write: x and y are bounded integers, never property names.
    if (!offMap(grid, x, y)) grid.tiles[y]!.fill(terrain, x, x + 1);
}

function inBounds(grid: TacticalGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/**
 * Where the fighting starts on a board (2026-10-24): all of a board up to the huge one's 24 by 16; on
 * a larger one, the middle of it, half of it each way and never less than that, so the sides do not
 * start a whole battlefield apart and there is ground behind each to fall back on or come round by.
 */
export function tacticalArena(grid: Pick<TacticalGrid, "width" | "height">): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const width = Math.min(grid.width, Math.max(24, Math.round(grid.width / 2)));
  const height = Math.min(grid.height, Math.max(16, Math.round(grid.height / 2)));
  return { x: Math.floor((grid.width - width) / 2), y: Math.floor((grid.height - height) / 2), width, height };
}

/**
 * Where the sides line up on the arena (re-test B1, 2026-10-24): as far apart across as on a large
 * board, 14 wide, in its middle, however wide the board. On a vast one they had started 21 squares
 * apart, and casters fired freely the three rounds a sword took to reach them; a board taken for a
 * blast's room gives that room along the sides and round them, not between them.
 */
export function tacticalEngagement(grid: Pick<TacticalGrid, "width" | "height">): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const arena = tacticalArena(grid);
  const width = Math.min(arena.width, 14);
  return { ...arena, x: arena.x + Math.floor((arena.width - width) / 2), width };
}

/** The two columns at each side of where the sides engage, along its rows: where they line up. */
function inSpawnZone(grid: TacticalGrid, x: number, y: number): boolean {
  const arena = tacticalEngagement(grid);
  if (y < arena.y || y >= arena.y + arena.height) return false;
  const at = x - arena.x;
  return (at >= 0 && at < SPAWN_COLS) || (at >= arena.width - SPAWN_COLS && at < arena.width);
}

/** The middle of the two strips where the sides engage, the party's and the other side's. */
function spawnAnchors(grid: TacticalGrid): { party: TacticalCoord; enemy: TacticalCoord } {
  const arena = tacticalEngagement(grid);
  const y = arena.y + Math.floor(arena.height / 2);
  return { party: { x: arena.x + SPAWN_COLS - 1, y }, enemy: { x: arena.x + arena.width - SPAWN_COLS, y } };
}

/** Grow a blob of `terrain` around a center via a bounded random walk. */
function growBlob(
  grid: TacticalGrid,
  cx: number,
  cy: number,
  size: number,
  terrain: TacticalTerrain,
  rng: () => number,
): void {
  let x = cx;
  let y = cy;
  for (let i = 0; i < size; i++) {
    if (!inSpawnZone(grid, x, y)) set(grid, x, y, terrain);
    const dir = Math.floor(rng() * 4);
    if (dir === 0) x += 1;
    else if (dir === 1) x -= 1;
    else if (dir === 2) y += 1;
    else y -= 1;
    x = Math.max(0, Math.min(grid.width - 1, x));
    y = Math.max(0, Math.min(grid.height - 1, y));
  }
}

/** Convert impassable tiles along a greedy path from → to into plains. */
function carveCorridor(grid: TacticalGrid, from: TacticalCoord, to: TacticalCoord): void {
  let { x, y } = from;
  let guard = 0;
  const limit = grid.width * grid.height * 2;
  while ((x !== to.x || y !== to.y) && guard++ < limit) {
    set(grid, x, y, "plains");
    if (x < to.x) x += 1;
    else if (x > to.x) x -= 1;
    else if (y < to.y) y += 1;
    else if (y > to.y) y -= 1;
  }
  set(grid, to.x, to.y, "plains");
}

/** BFS reachability over passable tiles. */
function reachable(grid: TacticalGrid, from: TacticalCoord, to: TacticalCoord): boolean {
  const seen = new Set<string>();
  const queue: TacticalCoord[] = [from];
  seen.add(`${from.x},${from.y}`);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (seen.has(key) || isImpassable(grid, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

/** Build a seeded terrain grid with clear spawn strips and guaranteed left↔right connectivity. */
export function generateGrid(
  unitCount: number,
  rng: () => number,
  environment?: TacticalEnvironment,
  size?: TacticalBattlefieldSize,
): TacticalGrid {
  const { width, height } = gridDimensions(unitCount, size);
  const tiles: TacticalTerrain[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "plains" as TacticalTerrain),
  );
  const grid: TacticalGrid = { width, height, tiles };
  const profile = envProfile(environment);

  // Terrain clusters over the contested middle band, themed + densitied by environment.
  // On a big board fewer, larger clusters, the same share of it covered (2026-10-24).
  const scale = boardScale(grid);
  const blobCount = Math.round((profile.density * (width * height)) / 14 / scale ** 2) + Math.floor(rng() * 3);
  for (let i = 0; i < blobCount; i++) {
    const cx = SPAWN_COLS + Math.floor(rng() * Math.max(1, width - SPAWN_COLS * 2));
    const cy = Math.floor(rng() * height);
    const size = (3 + Math.floor(rng() * 5)) * scale ** 2;
    growBlob(grid, cx, cy, size, pickTerrain(profile.weights, rng), rng);
  }

  // Spawn strips stay plains so units always have clean footing.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inSpawnZone(grid, x, y)) set(grid, x, y, "plains");
    }
  }

  // Guarantee a passable route between the spawn strips.
  const { party: partyAnchor, enemy: enemyAnchor } = spawnAnchors(grid);
  if (!reachable(grid, partyAnchor, enemyAnchor)) {
    carveCorridor(grid, partyAnchor, enemyAnchor);
  }

  return grid;
}

export type GenerateTacticalBattlefieldResult =
  | { ok: true; grid: TacticalGrid; protectedTiles: Set<string>; battlefield: TacticalBattlefieldProvenance }
  | { ok: false; error: string };

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function featureAnchor(grid: TacticalGrid, placement: TacticalBattlefieldFeature["placement"]): TacticalCoord {
  const center = { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  switch (placement) {
    case "north":
      return { x: center.x, y: tacticalArena(grid).y + 1 };
    case "south": {
      const arena = tacticalArena(grid);
      return { x: center.x, y: arena.y + arena.height - 2 };
    }
    case "east":
      return { x: spawnAnchors(grid).enemy.x - 1, y: center.y };
    case "west":
      return { x: spawnAnchors(grid).party.x + 1, y: center.y };
    default:
      return center;
  }
}

function featureTiles(grid: TacticalGrid, feature: TacticalBattlefieldFeature): TacticalCoord[] {
  const anchor = featureAnchor(grid, feature.placement);
  const horizontal = feature.placement === "center" || feature.placement === "north" || feature.placement === "south";
  const offsets: Array<readonly [number, number]> =
    feature.shape === "barrier"
      ? horizontal
        ? [
            [-1, 0],
            [0, 0],
            [1, 0],
          ]
        : [
            [0, -1],
            [0, 0],
            [0, 1],
          ]
      : horizontal
        ? [
            [-1, 0],
            [0, 0],
            [1, 0],
            [0, 1],
          ]
        : [
            [0, -1],
            [0, 0],
            [0, 1],
            [1, 0],
          ];
  // Each tile of the shape a block as wide as the board's scale, so a wall stays a wall on a big one.
  const scale = boardScale(grid);
  const lead = Math.floor(scale / 2);
  const tiles = new Map<string, TacticalCoord>();
  for (const [dx, dy] of offsets)
    for (let j = 0; j < scale; j++)
      for (let i = 0; i < scale; i++) {
        const tile = { x: anchor.x + dx * scale + i - lead, y: anchor.y + dy * scale + j - lead };
        tiles.set(tileKey(tile.x, tile.y), tile);
      }
  return [...tiles.values()].filter(
    (tile) => inBounds(grid, tile.x, tile.y) && !inSpawnZone(grid, tile.x, tile.y) && !offMap(grid, tile.x, tile.y),
  );
}

/** How many times a standard board's size a board is, each way (2026-10-24): 1 up to the huge one,
 *  2 on the vast, 4 on the colossal. Terrain grows with it, so a big board is not speckled. */
function boardScale(grid: Pick<TacticalGrid, "width" | "height">): number {
  return Math.max(1, Math.floor(Math.sqrt((grid.width * grid.height) / 140)));
}

function carveCorridorWithoutProtectedTiles(
  grid: TacticalGrid,
  from: TacticalCoord,
  to: TacticalCoord,
  protectedTiles: ReadonlySet<string>,
): boolean {
  const queue: TacticalCoord[] = [from];
  const parent = new Map<string, string | null>([[tileKey(from.x, from.y), null]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = tileKey(next.x, next.y);
      if (!inBounds(grid, next.x, next.y) || parent.has(key) || offMap(grid, next.x, next.y)) continue;
      if (protectedTiles.has(key) && isImpassable(grid, next.x, next.y)) continue;
      parent.set(key, tileKey(current.x, current.y));
      queue.push(next);
    }
  }

  const targetKey = tileKey(to.x, to.y);
  if (!parent.has(targetKey)) return false;
  for (let key: string | null = targetKey; key; key = parent.get(key) ?? null) {
    if (!protectedTiles.has(key)) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      set(grid, x, y, "plains");
    }
  }
  return true;
}

/**
 * Builds a generated battlefield from the bounded terrain brief. Feature tiles
 * are protected after painting: later connectivity repair may route around them
 * but cannot silently turn them back into plains.
 */
export function generateTacticalBattlefield(
  unitCount: number,
  rng: () => number,
  environment: TacticalEnvironment | undefined,
  requestedBrief: unknown,
): GenerateTacticalBattlefieldResult {
  const validated = validateTacticalBattlefieldBrief(requestedBrief);
  if (!validated.ok) return validated;
  const brief = validated.brief;
  const size = brief?.size ?? defaultBattlefieldSize(unitCount);
  const grid = generateGrid(unitCount, rng, environment, size);
  const protectedTiles = new Set<string>();
  // Cut to the place's outline (2026-10-24): what is off the map is a wall nobody sees, keeping the
  // strips the sides line up on and the middle on it.
  const outline = brief?.outline ?? tacticalOutlineFor(environment);
  const middle = { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  const inside = tacticalOutlineCells(
    grid.width,
    grid.height,
    outline,
    rng,
    (x, y) => inSpawnZone(grid, x, y) || (Math.abs(x - middle.x) <= 1 && Math.abs(y - middle.y) <= 1),
  );
  if (inside) {
    grid.outside = inside.map((row) => row.map((on) => !on));
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) if (grid.outside[y]![x]) grid.tiles[y]![x] = "wall";
  }

  for (const feature of brief?.features ?? []) {
    for (const tile of featureTiles(grid, feature)) {
      const key = tileKey(tile.x, tile.y);
      const existing = grid.tiles[tile.y]![tile.x]!;
      // A brief declares constraints, not ordered paint layers. Silently
      // overwriting one landmark would violate it; the UI offers explicit
      // generated-terrain fallback when constraints conflict.
      if (protectedTiles.has(key) && existing !== feature.terrain) {
        return { ok: false, error: "Battlefield features overlap with different terrain." };
      }
      set(grid, tile.x, tile.y, feature.terrain);
      protectedTiles.add(key);
    }
  }

  // Scattered over the open ground the features left, never in a deployment strip; a route the
  // scatter closes is carved open again below. The share is of the whole board as a player counts it
  // (laptop 2026-10-30: "every other cell" came out a third, the strips and features dry), so the open
  // ground it may fall on takes more of it, all of it at the most.
  if (brief?.scatter) {
    const open: Array<{ x: number; y: number }> = [];
    let board = 0;
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        if (grid.outside?.[y]?.[x]) continue;
        board += 1;
        if (grid.tiles[y]![x] === "plains" && !inSpawnZone(grid, x, y) && !protectedTiles.has(tileKey(x, y)))
          open.push({ x, y });
      }
    const already = grid.tiles.reduce(
      (count, row, y) =>
        count + row.filter((terrain, x) => terrain === brief.scatter!.terrain && !grid.outside?.[y]?.[x]).length,
      0,
    );
    const chance = open.length > 0 ? Math.min(1, Math.max(0, brief.scatter.share * board - already) / open.length) : 0;
    for (const { x, y } of open) if (rng() < chance) set(grid, x, y, brief.scatter.terrain);
  }

  const { party: partyAnchor, enemy: enemyAnchor } = spawnAnchors(grid);
  if (
    !reachable(grid, partyAnchor, enemyAnchor) &&
    !carveCorridorWithoutProtectedTiles(grid, partyAnchor, enemyAnchor, protectedTiles)
  ) {
    return { ok: false, error: "Battlefield features block every route between deployment zones." };
  }

  return {
    ok: true,
    grid,
    protectedTiles,
    battlefield: {
      kind: "generated",
      generatorVersion: TACTICAL_BATTLEFIELD_GENERATOR_VERSION,
      size,
      ...(inside ? { outline } : {}),
      ...(brief && (brief.size || brief.features?.length || brief.outline || brief.scatter) ? { brief } : {}),
    },
  };
}

// ── Hand-made boards (worldgen W9g) ──

/**
 * Why a board painted by hand cannot be fought on, or nothing: it is one of the standard sizes, its
 * deployment strips (the two columns at each side) are plains like a generated board's, and every tile a
 * fighter can stand on connects to the rest, so placement never has to change a painted tile. The strips
 * and a way between them are room for 40 at the least, the most fighters a battle has. Columns and rows
 * in the reasons count from 1.
 */
export function tacticalMadeBoardIssues(size: TacticalBattlefieldSize, grid: TacticalGrid): string[] {
  const { width, height } = BATTLEFIELD_SIZES[size];
  if (
    grid.width !== width ||
    grid.height !== height ||
    grid.tiles.length !== height ||
    grid.tiles.some((row) => row.length !== width)
  ) {
    return [`A ${size} battlefield is ${width} tiles across and ${height} down.`];
  }
  if (grid.tiles.some((row) => row.some((terrain) => !Object.prototype.hasOwnProperty.call(TERRAIN_DATA, terrain)))) {
    return ["The battlefield has a tile that is none of the six kinds."];
  }
  // Heights (combat C6b), when painted: one a tile, each a whole number from 0 to 3.
  if (
    grid.elevation &&
    (grid.elevation.length !== height ||
      grid.elevation.some(
        (row) => row.length !== width || row.some((level) => !Number.isInteger(level) || level < 0 || level > 3),
      ))
  ) {
    return ["The battlefield's heights are one a tile, from 0 to 3."];
  }
  const issues: string[] = [];
  if (grid.tiles.some((row, y) => row.some((terrain, x) => inSpawnZone(grid, x, y) && terrain !== "plains"))) {
    const arena = tacticalEngagement(grid);
    issues.push(
      arena.width === grid.width && arena.height === grid.height
        ? "The two columns at each side are where the sides line up: they must be plains."
        : `The two columns at each side of the middle ${arena.width} by ${arena.height} (columns ${arena.x + 1} to ${arena.x + arena.width}, rows ${arena.y + 1} to ${arena.y + arena.height}) are where the sides line up: they must be plains.`,
    );
  }
  // Every open tile, flooded from ONE open tile of the first column: the column's tiles must reach each
  // other too, which a cliff round some of them would prevent (combat C6b).
  const seen = new Set<string>();
  const queue: TacticalCoord[] = [];
  for (let y = 0; y < height; y++) {
    if (!isImpassable(grid, 0, y)) {
      seen.add(tileKey(0, y));
      queue.push({ x: 0, y });
      break;
    }
  }
  while (queue.length) {
    const current = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = tileKey(next.x, next.y);
      if (!inBounds(grid, next.x, next.y) || seen.has(key) || isImpassable(grid, next.x, next.y)) continue;
      // A cliff (a step of two levels or more) is no way across on foot (combat C6b), so a tile behind
      // one is cut off unless another way leads round. Walking connects both ways, so the flood is fair.
      if (climbCost(grid, current, next) === null) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isImpassable(grid, x, y) || seen.has(tileKey(x, y))) continue;
      issues.push(
        `The tile at column ${x + 1}, row ${y + 1} is cut off: every tile a fighter can stand on must connect to both sides.`,
      );
      return issues;
    }
  }
  return issues;
}

/**
 * A hand-made board, as a battle is fought on it: exactly as painted. Every tile but plains is kept, so
 * placement, which only ever turns a tile it may change into plains, leaves the painting as it is.
 */
export function madeTacticalBattlefield(made: TacticalMadeBattlefield): GenerateTacticalBattlefieldResult {
  const issues = tacticalMadeBoardIssues(made.size, made.grid);
  if (issues.length) return { ok: false, error: `${made.name}: ${issues[0]}` };
  const grid: TacticalGrid = {
    width: made.grid.width,
    height: made.grid.height,
    tiles: made.grid.tiles.map((row) => [...row]),
    ...(made.grid.elevation ? { elevation: made.grid.elevation.map((row) => [...row]) } : {}),
  };
  const protectedTiles = new Set<string>();
  grid.tiles.forEach((row, y) =>
    row.forEach((terrain, x) => {
      if (terrain !== "plains") protectedTiles.add(tileKey(x, y));
    }),
  );
  return {
    ok: true,
    grid,
    protectedTiles,
    battlefield: { kind: "hand-made", size: made.size, id: made.id, name: made.name, scene: made.scene },
  };
}

// ── Spawn placement (formation-aware) ──

/**
 * Claim the free tile nearest `target` (BFS outward, fixed neighbor order so it's
 * deterministic). Impassable tiles are cleared to plains when claimed, so every
 * placed unit is guaranteed to stand on passable footing. Records the tile in
 * `occupied` so no two units ever share it.
 */
function claimNear(
  grid: TacticalGrid,
  occupied: Set<string>,
  target: TacticalCoord,
  protectedTiles: ReadonlySet<string>,
): TacticalCoord {
  const sx = clamp(Math.round(target.x), 0, grid.width - 1);
  const sy = clamp(Math.round(target.y), 0, grid.height - 1);
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: TacticalCoord[] = [{ x: sx, y: sy }];
  while (queue.length) {
    const cur = queue.shift()!;
    const key = `${cur.x},${cur.y}`;
    if (
      !occupied.has(key) &&
      !offMap(grid, cur.x, cur.y) &&
      (!isImpassable(grid, cur.x, cur.y) || !protectedTiles.has(key))
    ) {
      occupied.add(key);
      if (isImpassable(grid, cur.x, cur.y)) set(grid, cur.x, cur.y, "plains");
      return cur;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nkey = `${nx},${ny}`;
      if (!inBounds(grid, nx, ny) || seen.has(nkey)) continue;
      seen.add(nkey);
      queue.push({ x: nx, y: ny });
    }
  }
  return { x: sx, y: sy };
}

/** Spread `count` slots across the given columns, distributed over rows. Mirrors legacy line spacing. */
function columnTargets(grid: TacticalGrid, cols: number[], count: number): TacticalCoord[] {
  const out: TacticalCoord[] = [];
  const perCol = Math.max(1, Math.ceil(count / cols.length));
  for (let i = 0; i < count; i++) {
    const col = cols[i % cols.length]!;
    const slot = Math.floor(i / cols.length);
    const y = perCol <= 1 ? Math.floor(grid.height / 2) : Math.round((slot * (grid.height - 1)) / (perCol - 1));
    out.push({ x: clamp(col, 0, grid.width - 1), y });
  }
  return out;
}

/** Spread `count` slots along a horizontal edge row `y`, over the inner columns. */
function rowTargets(grid: TacticalGrid, y: number, count: number): TacticalCoord[] {
  const out: TacticalCoord[] = [];
  for (let i = 0; i < count; i++) {
    const x = count <= 1 ? Math.floor(grid.width / 2) : Math.round((i * (grid.width - 1)) / (count - 1));
    out.push({ x, y: clamp(y, 0, grid.height - 1) });
  }
  return out;
}

/** Points spread around the whole perimeter, cycling top → right → bottom → left. */
function perimeterTargets(grid: TacticalGrid, count: number): TacticalCoord[] {
  const W = grid.width;
  const H = grid.height;
  const edges: ((t: number) => TacticalCoord)[] = [
    (t) => ({ x: Math.round(t * (W - 1)), y: 0 }), // top
    (t) => ({ x: W - 1, y: Math.round(t * (H - 1)) }), // right
    (t) => ({ x: Math.round((1 - t) * (W - 1)), y: H - 1 }), // bottom
    (t) => ({ x: 0, y: Math.round((1 - t) * (H - 1)) }), // left
  ];
  const out: TacticalCoord[] = [];
  for (let i = 0; i < count; i++) {
    const edge = edges[i % 4]!;
    const ring = Math.floor(i / 4);
    // Stagger successive rings so they don't stack on the same corner tiles.
    const t = ((ring + 1) / (Math.floor(count / 4) + 2)) * 0.8 + 0.1;
    out.push(edge(t));
  }
  return out;
}

/** Score a tile by how many orthogonally-adjacent tiles carry defensive terrain (forest/mountain/ruin). */
function defensiveAdjacency(grid: TacticalGrid, x: number, y: number): number {
  let score = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(grid, nx, ny)) continue;
    const t = grid.tiles[ny]![nx]!;
    if (t === "forest" || t === "mountain" || t === "ruin") score += 1;
  }
  return score;
}

interface FormationTargets {
  party: TacticalCoord[];
  /** Aligned with the boss-first enemy ordering used by placeSpawns. */
  enemies: TacticalCoord[];
}

/**
 * Compute per-unit target tiles for a formation. Targets are approximate; the
 * caller resolves collisions + passability via claimNear, so overlapping or
 * impassable targets are fine.
 */
function formationTargets(
  grid: TacticalGrid,
  formation: TacticalFormation,
  partyCount: number,
  enemyCount: number,
  rng: () => number,
  partyTogether = false,
): FormationTargets {
  // On a board wider than a large one, the formations are laid on where the sides engage (B1).
  const arena = tacticalEngagement(grid);
  if (arena.width < grid.width || arena.height < grid.height) {
    const view: TacticalGrid = {
      ...grid,
      width: arena.width,
      height: arena.height,
      tiles: grid.tiles.slice(arena.y, arena.y + arena.height).map((row) => row.slice(arena.x, arena.x + arena.width)),
    };
    delete view.elevation;
    const laid = formationTargets(view, formation, partyCount, enemyCount, rng, partyTogether);
    const back = (cell: TacticalCoord) => ({ x: cell.x + arena.x, y: cell.y + arena.y });
    return { party: laid.party.map(back), enemies: laid.enemies.map(back) };
  }
  const W = grid.width;
  const H = grid.height;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);

  switch (formation) {
    case "ambush": {
      // Party clustered mid-field; enemies split onto two opposite edges.
      const party = Array.from({ length: partyCount }, () => ({ x: cx, y: cy }));
      const half = Math.ceil(enemyCount / 2);
      const groupA = half;
      const groupB = enemyCount - half;
      const horizontal = rng() < 0.5;
      const enemies = horizontal
        ? [...columnTargets(grid, [W - 1], groupA), ...columnTargets(grid, [0], groupB)]
        : [...rowTargets(grid, 0, groupA), ...rowTargets(grid, H - 1, groupB)];
      return { party, enemies };
    }

    case "surrounded": {
      // Party tight center cluster; enemies ring the whole perimeter.
      const party = Array.from({ length: partyCount }, () => ({ x: cx, y: cy }));
      const enemies = perimeterTargets(grid, enemyCount);
      return { party, enemies };
    }

    case "skirmish": {
      // Both sides in loose scattered clusters ~4-6 tiles apart in the middle band.
      const gap = 4 + Math.floor(rng() * 3); // 4..6
      const partyCenter = { x: clamp(cx - Math.ceil(gap / 2), SPAWN_COLS, W - 1 - SPAWN_COLS), y: cy };
      const enemyCenter = { x: clamp(cx + Math.ceil(gap / 2), SPAWN_COLS, W - 1 - SPAWN_COLS), y: cy };
      const scatter = (center: TacticalCoord, count: number): TacticalCoord[] =>
        Array.from({ length: count }, () => ({
          x: clamp(center.x + Math.round((rng() - 0.5) * 3), 0, W - 1),
          y: clamp(center.y + Math.round((rng() - 0.5) * 3), 0, H - 1),
        }));
      return { party: scatter(partyCenter, partyCount), enemies: scatter(enemyCenter, enemyCount) };
    }

    case "defense": {
      // Party holds one corner quadrant (favoring defensive terrain); enemies
      // sweep in a wide arc from the opposite corner.
      const corner = Math.floor(rng() * 4); // 0 TL, 1 TR, 2 BL, 3 BR
      const corners: TacticalCoord[] = [
        { x: 0, y: 0 },
        { x: W - 1, y: 0 },
        { x: 0, y: H - 1 },
        { x: W - 1, y: H - 1 },
      ];
      const home = corners[corner]!;
      const opposite = corners[3 - corner]!;
      const halfW = Math.ceil(W / 2);
      const halfH = Math.ceil(H / 2);
      // Rank the party's quadrant tiles by defensive adjacency (desc), then by
      // closeness to the home corner (asc) — deterministic best-first order.
      const quadrant: { c: TacticalCoord; def: number; dist: number }[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const inQuadX = home.x === 0 ? x < halfW : x >= W - halfW;
          const inQuadY = home.y === 0 ? y < halfH : y >= H - halfH;
          if (inQuadX && inQuadY) {
            quadrant.push({ c: { x, y }, def: defensiveAdjacency(grid, x, y), dist: manhattan({ x, y }, home) });
          }
        }
      }
      quadrant.sort((a, b) => b.def - a.def || a.dist - b.dist);
      const party = Array.from({ length: partyCount }, (_, i) => quadrant[i]?.c ?? home);
      // Enemies fan out along the far halves of the two edges meeting at the opposite corner: never
      // along the party's own half, where a fan to the board's far ends set them two steps from it
      // (laptop pass 6 2026-10-26: "start far apart" in a huge cavern).
      const midX = (W - 1) / 2;
      const midY = (H - 1) / 2;
      const enemies: TacticalCoord[] = [];
      for (let i = 0; i < enemyCount; i++) {
        const t = enemyCount <= 1 ? 0.5 : i / (enemyCount - 1);
        if (i % 2 === 0) {
          enemies.push({ x: opposite.x, y: Math.round(midY + (opposite.y - midY) * t) });
        } else {
          enemies.push({ x: Math.round(midX + (opposite.x - midX) * t), y: opposite.y });
        }
      }
      return { party, enemies };
    }

    case "line":
    default: {
      // Legacy: party on the left strip, enemies on the right strip. A party kept together stands
      // around the strip's middle instead of spread to its corners.
      const party = partyTogether
        ? Array.from({ length: partyCount }, (_, i) => {
            const rows = Math.ceil(partyCount / SPAWN_COLS);
            const slot = Math.floor(i / SPAWN_COLS);
            return {
              x: clamp(i % SPAWN_COLS, 0, W - 1),
              y: clamp(Math.floor(H / 2) - Math.floor(rows / 2) + slot, 0, H - 1),
            };
          })
        : columnTargets(grid, [0, 1].slice(0, SPAWN_COLS), partyCount);
      const enemies = columnTargets(grid, [W - 1, W - 2].slice(0, SPAWN_COLS), enemyCount);
      return { party, enemies };
    }
  }
}

/**
 * After placement, guarantee every enemy is reachable from every party unit:
 * connect every unit tile to a central hub via a carved corridor when a passable
 * route doesn't already exist. Connectivity to a common hub over an undirected
 * passable graph makes all units mutually reachable.
 */
function nearestUnprotectedHub(grid: TacticalGrid, protectedTiles: ReadonlySet<string>): TacticalCoord | null {
  const center = { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  const queue: TacticalCoord[] = [center];
  const seen = new Set<string>([tileKey(center.x, center.y)]);
  let firstUnprotected: TacticalCoord | null = null;
  while (queue.length) {
    const current = queue.shift()!;
    if (!protectedTiles.has(tileKey(current.x, current.y))) {
      firstUnprotected ??= current;
      if (!isImpassable(grid, current.x, current.y)) return current;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = tileKey(next.x, next.y);
      if (!inBounds(grid, next.x, next.y) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return firstUnprotected;
}

function ensureConnectivity(
  grid: TacticalGrid,
  units: TacticalPlaceable[],
  protectedTiles: ReadonlySet<string>,
): boolean {
  if (!units.length) return true;
  // Preserve legacy output exactly: its hub is the board center. Briefed maps
  // choose the closest unprotected tile so a center landmark stays intact.
  const hub =
    protectedTiles.size === 0
      ? { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) }
      : nearestUnprotectedHub(grid, protectedTiles);
  if (!hub) return false;
  set(grid, hub.x, hub.y, "plains");
  for (const u of units) {
    const from = { x: u.x, y: u.y };
    if (reachable(grid, from, hub)) continue;
    // A straight corridor may run off a shaped board's map, so one goes round inside it instead.
    if (protectedTiles.size === 0 && !grid.outside) {
      carveCorridor(grid, from, hub);
    } else if (
      !carveCorridorWithoutProtectedTiles(grid, from, hub, protectedTiles) &&
      // On a shaped board a feature may close the only way through a narrow of it: the way is cut.
      !(grid.outside && carveCorridorWithoutProtectedTiles(grid, from, hub, new Set()))
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Targets moved apart where they can (combat AI S1a): each one's `gaps` entry is how far it keeps from
 * the rest of its side, so a pair stands at least the larger of their two gaps apart and a pair that
 * keeps none stays together (a zombie beside a zombie, while the cultist among them keeps clear of
 * both). A target too close to one kept before it moves to the nearest open cell clear of all of
 * them, a step toward the other side counting double and never more than half the gap nearer it.
 * Where the board has no room for the gaps, the widest it has room for.
 */
function spreadTargets(
  grid: TacticalGrid,
  targets: readonly TacticalCoord[],
  gaps: readonly number[],
  others: readonly TacticalCoord[],
  /** A little give in where each one moved settles, so a spaced side is no exact lattice (laptop
   *  playtest 2026-10-24: every foe on x 20/25/30/35). */
  rng: () => number = () => 0,
): TacticalCoord[] {
  const gap = Math.max(0, ...gaps);
  if (gap < 2 || targets.length < 2) return [...targets];
  const apart = (a: TacticalCoord, b: TacticalCoord) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const fromOthers = (at: TacticalCoord) =>
    others.length > 0 ? Math.min(...others.map((one) => apart(at, one))) : Number.POSITIVE_INFINITY;
  // `packed`: those that keep apart start from the top of their column instead, so a column holds as
  // many as its height allows, not two either side of its middle.
  const lay = (width: number, packed = false) => {
    const kept: TacticalCoord[] = [];
    let fits = true;
    targets.forEach((target, index) => {
      const at = {
        x: clamp(Math.round(target.x), 0, grid.width - 1),
        y: packed && (gaps[index] ?? 0) >= 2 ? 0 : clamp(Math.round(target.y), 0, grid.height - 1),
      };
      const needs = (other: number) => Math.min(width, Math.max(gaps[index] ?? 0, gaps[other] ?? 0));
      const clear = (cell: TacticalCoord) => kept.every((one, other) => apart(cell, one) >= needs(other));
      if (clear(at)) {
        kept.push(at);
        return;
      }
      const from = fromOthers(at);
      let best: TacticalCoord | undefined;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const cell = { x, y };
          if (isImpassable(grid, x, y) || !clear(cell)) continue;
          const nearer = Math.max(0, from - fromOthers(cell));
          if (nearer > Math.ceil(width / 2)) continue;
          const cost = (x - at.x) ** 2 + (y - at.y) ** 2 + 3 * nearer ** 2 + rng() * 2 * width;
          if (cost < bestCost) {
            best = cell;
            bestCost = cost;
          }
        }
      }
      if (!best) fits = false;
      kept.push(best ?? at);
    });
    return { kept, fits };
  };
  for (let width = gap; width > 2; width--) {
    const laid = lay(width);
    if (laid.fits) return laid.kept;
    const packed = lay(width, true);
    if (packed.fits) return packed.kept;
  }
  return lay(2).kept;
}

/**
 * Place units according to `formation`. Party/enemy target tiles come from
 * `formationTargets`; claimNear resolves collisions + passability so every unit
 * lands on a unique passable tile; ensureConnectivity carves corridors so every
 * enemy is BFS-reachable from every party unit. Mutates each unit's x/y in place.
 *
 * Deterministic: given the same grid + units + formation + rng stream, the
 * placement is identical.
 */
export function placeSpawns(
  grid: TacticalGrid,
  units: TacticalPlaceable[],
  formation: TacticalFormation = "line",
  rng: () => number = () => 0,
  protectedTiles: ReadonlySet<string> = new Set(),
  /** The party starts together around its strip's middle, not spread to its corners (a ruleset
   *  fight's, re-test 2026-10-23: a rogue's first turn spent dashing nine squares to the leader). */
  partyTogether = false,
): boolean {
  const occupied = new Set<string>();
  const party = units.filter((u) => u.side === "party");
  const enemies = units.filter((u) => u.side === "enemy");
  // Bosses claim their spot first so they anchor the back of the enemy group.
  const bossFirst = [...enemies].sort((a, b) => Number(!!b.isBoss) - Number(!!a.isBoss));

  const targets = formationTargets(grid, formation, party.length, bossFirst.length, rng, partyTogether);

  const lastPartyTarget = targets.party[targets.party.length - 1] ?? { x: 0, y: Math.floor(grid.height / 2) };
  const lastEnemyTarget = targets.enemies[targets.enemies.length - 1] ?? {
    x: grid.width - 1,
    y: Math.floor(grid.height / 2),
  };
  const partyTargets = spreadTargets(
    grid,
    party.map((_, i) => targets.party[i] ?? lastPartyTarget),
    party.map((u) => u.spread ?? 0),
    targets.enemies,
    rng,
  );
  const enemyTargets = spreadTargets(
    grid,
    bossFirst.map((_, i) => targets.enemies[i] ?? lastEnemyTarget),
    bossFirst.map((u) => u.spread ?? 0),
    partyTargets,
    rng,
  );
  party.forEach((u, i) => {
    const tile = claimNear(grid, occupied, partyTargets[i]!, protectedTiles);
    u.x = tile.x;
    u.y = tile.y;
  });

  bossFirst.forEach((u, i) => {
    const tile = claimNear(grid, occupied, enemyTargets[i]!, protectedTiles);
    u.x = tile.x;
    u.y = tile.y;
  });

  return ensureConnectivity(grid, units, protectedTiles);
}
