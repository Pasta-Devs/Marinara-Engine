import type { TacticalEnvironment } from "./environments.js";

/**
 * The outline a generated board is cut to (2026-10-24, Alyssa: why are all the maps rectangular?). A
 * box is the whole rectangle, as every board was; the rest leave cells off the map, which nothing
 * moves into, sees through or stands on, as the board's own edge: a round tower or arena, a winding
 * cavern, a valley between its slopes, a ruin with its corners and walls fallen away.
 */
export const TACTICAL_BOARD_OUTLINES = Object.freeze(["box", "round", "cavern", "valley", "broken"] as const);
export type TacticalBoardOutline = (typeof TACTICAL_BOARD_OUTLINES)[number];

/** The outline a place's board takes when nothing names one. */
export function tacticalOutlineFor(environment: TacticalEnvironment | undefined): TacticalBoardOutline {
  switch (environment) {
    case "cave":
      return "cavern";
    case "dungeon":
    case "ruins":
    case "castle":
      return "broken";
    case "mountains":
    case "snow":
      return "valley";
    default:
      return "box";
  }
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Which cells of a `width` by `height` board are on the map for an outline, inside[y][x]: null for a
 * box, which keeps them all. `keep` names the cells that must stay on it (where the sides line up,
 * the middle). What is left is one piece: every cell kept is joined to the rest, and a scrap the
 * outline cut off from it goes off the map as well.
 */
export function tacticalOutlineCells(
  width: number,
  height: number,
  outline: TacticalBoardOutline,
  rng: () => number,
  keep: (x: number, y: number) => boolean,
): boolean[][] | null {
  if (outline === "box") return null;
  const inside: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(true));
  // Where a cell is, from -1 to 1 each way across the board.
  const across = (x: number) => ((x + 0.5) / width) * 2 - 1;
  const down = (y: number) => ((y + 0.5) / height) * 2 - 1;
  if (outline === "round") {
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) inside[y]![x] = across(x) ** 2 + down(y) ** 2 <= 1.02;
  } else if (outline === "cavern") {
    // Rock thickening toward the edges, worn smooth: open more often the nearer the middle.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        inside[y]![x] = 1.05 - 0.85 * (across(x) ** 2 + down(y) ** 2) + (rng() - 0.5) * 0.9 > 0.4;
    for (let pass = 0; pass < 4; pass++) {
      const before = inside.map((row) => [...row]);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          let open = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (before[y + dy]?.[x + dx]) open += 1;
          inside[y]![x] = open >= 5;
        }
    }
  } else if (outline === "valley") {
    // Slopes along the top and bottom, each a walk that never closes the valley to less than half.
    const most = Math.max(1, Math.floor(height * 0.25));
    let top = Math.floor(rng() * (most + 1));
    let bottom = Math.floor(rng() * (most + 1));
    for (let x = 0; x < width; x++) {
      top = Math.max(0, Math.min(most, top + Math.round((rng() - 0.5) * 2.2)));
      bottom = Math.max(0, Math.min(most, bottom + Math.round((rng() - 0.5) * 2.2)));
      for (let y = 0; y < height; y++) inside[y]![x] = y >= top && y < height - bottom;
    }
  } else {
    // broken: bites out of its sides and corners, a fifth to a third of the board each.
    const bites = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < bites; i++) {
      const w = Math.max(1, Math.round(width * (0.15 + rng() * 0.15)));
      const h = Math.max(1, Math.round(height * (0.15 + rng() * 0.2)));
      const side = Math.floor(rng() * 4);
      const along = rng();
      const x0 = side === 1 ? width - w : side === 3 ? 0 : Math.round(along * (width - w));
      const y0 = side === 0 ? 0 : side === 2 ? height - h : Math.round(along * (height - h));
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) inside[y]![x] = false;
    }
  }
  const kept: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (keep(x, y)) {
        inside[y]![x] = true;
        kept.push({ x, y });
      }
  // One piece: each kept cell not yet joined to the first is walked to it, two cells wide.
  const joined = (from: { x: number; y: number }) => {
    const seen = new Set<string>([`${from.x},${from.y}`]);
    const queue = [from];
    while (queue.length) {
      const cell = queue.shift()!;
      for (const [dx, dy] of STEPS) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (!inside[y]?.[x] || seen.has(`${x},${y}`)) continue;
        seen.add(`${x},${y}`);
        queue.push({ x, y });
      }
    }
    return seen;
  };
  const start = kept[0] ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  inside[start.y]![start.x] = true;
  let piece = joined(start);
  for (const cell of kept) {
    if (piece.has(`${cell.x},${cell.y}`)) continue;
    let { x, y } = cell;
    while (!piece.has(`${x},${y}`)) {
      inside[y]![x] = true;
      if (y + 1 < height) inside[y + 1]![x] = true;
      if (x !== start.x) x += x < start.x ? 1 : -1;
      else if (y !== start.y) y += y < start.y ? 1 : -1;
      else break;
    }
    piece = joined(start);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!piece.has(`${x},${y}`)) inside[y]![x] = false;
  return inside;
}

/** Whether a saved board's cells off the map are as a generator leaves them: absent, or one flag a
 *  cell in the board's own shape, each one off the map a wall. */
export function tacticalOutsideValid(grid: { width: number; height: number; tiles: unknown[][]; outside?: unknown }) {
  const outside = grid.outside;
  if (outside === undefined) return true;
  return (
    Array.isArray(outside) &&
    outside.length === grid.height &&
    outside.every(
      (row, y) =>
        Array.isArray(row) &&
        row.length === grid.width &&
        row.every((off, x) => typeof off === "boolean" && (!off || grid.tiles[y]?.[x] === "wall")),
    )
  );
}
