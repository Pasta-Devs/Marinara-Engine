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

import { clamp, isImpassable, manhattan } from "./math.js";
import type {
  TacticalCoord,
  TacticalEnvironment,
  TacticalFormation,
  TacticalGrid,
  TacticalTerrain,
  TacticalUnit,
} from "./types.js";

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

/** Grid dimensions scale with the number of combatants. Default 12x8, cap 14x10. */
export function gridDimensions(unitCount: number): { width: number; height: number } {
  if (unitCount > 8) return { width: 14, height: 10 };
  if (unitCount > 5) return { width: 13, height: 9 };
  return { width: 12, height: 8 };
}

const SPAWN_COLS = 2;

function set(grid: TacticalGrid, x: number, y: number, terrain: TacticalTerrain): void {
  if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) grid.tiles[y]![x] = terrain;
}

function inBounds(grid: TacticalGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

function inSpawnZone(grid: TacticalGrid, x: number): boolean {
  return x < SPAWN_COLS || x >= grid.width - SPAWN_COLS;
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
    if (!inSpawnZone(grid, x)) set(grid, x, y, terrain);
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
export function generateGrid(unitCount: number, rng: () => number, environment?: TacticalEnvironment): TacticalGrid {
  const { width, height } = gridDimensions(unitCount);
  const tiles: TacticalTerrain[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "plains" as TacticalTerrain),
  );
  const grid: TacticalGrid = { width, height, tiles };
  const profile = envProfile(environment);

  // Terrain clusters over the contested middle band, themed + densitied by environment.
  const blobCount = Math.round((profile.density * (width * height)) / 14) + Math.floor(rng() * 3);
  for (let i = 0; i < blobCount; i++) {
    const cx = SPAWN_COLS + Math.floor(rng() * Math.max(1, width - SPAWN_COLS * 2));
    const cy = Math.floor(rng() * height);
    const size = 3 + Math.floor(rng() * 5);
    growBlob(grid, cx, cy, size, pickTerrain(profile.weights, rng), rng);
  }

  // Spawn strips stay plains so units always have clean footing.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inSpawnZone(grid, x)) set(grid, x, y, "plains");
    }
  }

  // Guarantee a passable route between the spawn strips.
  const midY = Math.floor(height / 2);
  const partyAnchor = { x: SPAWN_COLS - 1, y: midY };
  const enemyAnchor = { x: width - SPAWN_COLS, y: midY };
  if (!reachable(grid, partyAnchor, enemyAnchor)) {
    carveCorridor(grid, partyAnchor, enemyAnchor);
  }

  return grid;
}

// ── Spawn placement (formation-aware) ──

/**
 * Claim the free tile nearest `target` (BFS outward, fixed neighbor order so it's
 * deterministic). Impassable tiles are cleared to plains when claimed, so every
 * placed unit is guaranteed to stand on passable footing. Records the tile in
 * `occupied` so no two units ever share it.
 */
function claimNear(grid: TacticalGrid, occupied: Set<string>, target: TacticalCoord): TacticalCoord {
  const sx = clamp(Math.round(target.x), 0, grid.width - 1);
  const sy = clamp(Math.round(target.y), 0, grid.height - 1);
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: TacticalCoord[] = [{ x: sx, y: sy }];
  while (queue.length) {
    const cur = queue.shift()!;
    const key = `${cur.x},${cur.y}`;
    if (!occupied.has(key)) {
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
): FormationTargets {
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
      // Enemies fan out along the two edges meeting at the opposite corner.
      const enemies: TacticalCoord[] = [];
      for (let i = 0; i < enemyCount; i++) {
        const t = enemyCount <= 1 ? 0.5 : i / (enemyCount - 1);
        if (i % 2 === 0) {
          enemies.push({ x: opposite.x, y: Math.round(t * (H - 1)) });
        } else {
          enemies.push({ x: Math.round((opposite.x === 0 ? t : 1 - t) * (W - 1)), y: opposite.y });
        }
      }
      return { party, enemies };
    }

    case "line":
    default: {
      // Legacy: party on the left strip, enemies on the right strip.
      const party = columnTargets(grid, [0, 1].slice(0, SPAWN_COLS), partyCount);
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
function ensureConnectivity(grid: TacticalGrid, units: TacticalUnit[]): void {
  if (!units.length) return;
  const hub = { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  set(grid, hub.x, hub.y, "plains");
  for (const u of units) {
    const from = { x: u.x, y: u.y };
    if (!reachable(grid, from, hub)) carveCorridor(grid, from, hub);
  }
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
  units: TacticalUnit[],
  formation: TacticalFormation = "line",
  rng: () => number = () => 0,
): void {
  const occupied = new Set<string>();
  const party = units.filter((u) => u.side === "party");
  const enemies = units.filter((u) => u.side === "enemy");
  // Bosses claim their spot first so they anchor the back of the enemy group.
  const bossFirst = [...enemies].sort((a, b) => Number(!!b.isBoss) - Number(!!a.isBoss));

  const targets = formationTargets(grid, formation, party.length, bossFirst.length, rng);

  const lastPartyTarget = targets.party[targets.party.length - 1] ?? { x: 0, y: Math.floor(grid.height / 2) };
  party.forEach((u, i) => {
    const tile = claimNear(grid, occupied, targets.party[i] ?? lastPartyTarget);
    u.x = tile.x;
    u.y = tile.y;
  });

  const lastEnemyTarget = targets.enemies[targets.enemies.length - 1] ?? {
    x: grid.width - 1,
    y: Math.floor(grid.height / 2),
  };
  bossFirst.forEach((u, i) => {
    const tile = claimNear(grid, occupied, targets.enemies[i] ?? lastEnemyTarget);
    u.x = tile.x;
    u.y = tile.y;
  });

  ensureConnectivity(grid, units);
}
