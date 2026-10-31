import type { CombatRole } from "../combat-minds.js";
import { isImpassable } from "../tactical-combat/math.js";
import type { TacticalGrid } from "../tactical-combat/types.js";

/**
 * Where the Game Master starts somebody (2026-10-24, Alyssa): every opponent, and a party member only
 * where the story put them (the wizard who walked into the cavern first stands at the front when the
 * goblins spring). Said from the combatant's own side:
 *
 *   - `front`: the front of its side, nearest the other; `rear`: the back of it.
 *   - `ahead`: out ahead of its side, alone.
 *   - `flank`: off to one side of the other side; `behind`: past the other side, at its back.
 *   - `among`: in the middle of the other side.
 *   - `hidden`: in cover near its side.
 */
export const COMBAT_START_PLACES = Object.freeze([
  "front",
  "rear",
  "ahead",
  "flank",
  "behind",
  "among",
  "hidden",
] as const);
export type CombatStartPlace = (typeof COMBAT_START_PLACES)[number];

type Cell = { x: number; y: number };
/** `group`: what kind it is (a pack of zombies), so those started on a flank take the same one. */
type Stand = { id: string; side: "party" | "enemy"; group?: string };

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const key = (cell: Cell) => `${cell.x},${cell.y}`;

/** Every open cell any of these reaches, walking round what nobody walks through. */
function reachableFrom(grid: TacticalGrid, from: readonly Cell[]): Set<string> {
  const seen = new Set<string>();
  const queue: Cell[] = [];
  for (const cell of from)
    if (!seen.has(key(cell))) {
      seen.add(key(cell));
      queue.push(cell);
    }
  while (queue.length) {
    const cell = queue.shift()!;
    for (const [dx, dy] of STEPS) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= grid.width || next.y >= grid.height) continue;
      if (seen.has(key(next)) || isImpassable(grid, next.x, next.y)) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen;
}

const centre = (cells: readonly Cell[]): Cell =>
  cells.length === 0
    ? { x: 0, y: 0 }
    : {
        x: cells.reduce((sum, one) => sum + one.x, 0) / cells.length,
        y: cells.reduce((sum, one) => sum + one.y, 0) / cells.length,
      };

/** The nearest open cell to `target` that the fight reaches and nobody holds. */
function nearestOpen(target: Cell, open: Set<string>, held: Set<string>): Cell | null {
  let best: Cell | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const cellKey of open) {
    if (held.has(cellKey)) continue;
    const [x, y] = cellKey.split(",").map(Number) as [number, number];
    const gap = (x - target.x) ** 2 + (y - target.y) ** 2;
    if (gap < bestGap) {
      best = { x, y };
      bestGap = gap;
    }
  }
  return best;
}

/**
 * The placements with each opponent at home in water begun in it (laptop 2026-10-30: four reef sharks
 * "in the deep water" stood on the plains and bit from there): one that swims at least as fast as it
 * walks and does not fly starts in the free water cell nearest where it was put, when the board has
 * one. The party, and everybody else, stays where they are.
 */
export function rulesetWaterStarts(
  grid: TacticalGrid,
  placements: Record<string, Cell>,
  swimmers: readonly { id: string; side: string; walk: number; swim?: number; fly?: number; span?: number }[],
): Record<string, Cell> {
  const wet = (x: number, y: number) => grid.tiles[y]?.[x] === "water" && !grid.outside?.[y]?.[x];
  if (!grid.tiles.some((row, y) => row.some((_, x) => wet(x, y)))) return placements;
  const next = { ...placements };
  const spanOf = (id: string) => Math.max(1, Math.min(6, swimmers.find((one) => one.id === id)?.span ?? 1));
  // Every cell somebody stands on, a large one's whole square (laptop 2026-10-30: Large crocodiles
  // were left on the shore).
  const footprint = (at: Cell, span: number) =>
    Array.from({ length: span * span }, (_, i) => ({ x: at.x + (i % span), y: at.y + Math.floor(i / span) }));
  const key = (cell: Cell) => `${cell.x},${cell.y}`;
  const taken = new Set(Object.entries(next).flatMap(([id, at]) => footprint(at, spanOf(id)).map(key)));
  for (const one of swimmers) {
    if (one.side === "party" || !one.swim || one.fly || one.walk > one.swim) continue;
    const at = next[one.id];
    const span = spanOf(one.id);
    if (!at || footprint(at, span).every((cell) => wet(cell.x, cell.y))) continue;
    const own = new Set(footprint(at, span).map(key));
    let best: Cell | undefined;
    let bestFar = Infinity;
    for (let y = 0; y + span <= grid.height; y++)
      for (let x = 0; x + span <= grid.width; x++) {
        const cells = footprint({ x, y }, span);
        if (!cells.every((cell) => wet(cell.x, cell.y) && (!taken.has(key(cell)) || own.has(key(cell))))) continue;
        const far = (x - at.x) ** 2 + (y - at.y) ** 2;
        if (far < bestFar) [best, bestFar] = [{ x, y }, far];
      }
    if (!best) continue;
    for (const cell of own) taken.delete(cell);
    for (const cell of footprint(best, span)) taken.add(key(cell));
    next[one.id] = best;
  }
  return next;
}

/**
 * The placements with each one the Game Master started somewhere moved there, and each companion
 * the AI plays set by its role (a marksman or a caster a little back from the front, one who fights
 * hand to hand a little forward of it). Nobody is moved where the fight does not reach, and nobody
 * onto anybody else.
 */
export function rulesetStartPlacements(
  grid: TacticalGrid,
  placements: Record<string, Cell>,
  stands: readonly Stand[],
  places: Readonly<Record<string, CombatStartPlace>>,
  roles: Readonly<Record<string, CombatRole>> = {},
): Record<string, Cell> {
  const out: Record<string, Cell> = { ...placements };
  const at = (side: "party" | "enemy") =>
    stands.filter((one) => one.side === side && out[one.id]).map((one) => out[one.id]!);
  const open = reachableFrom(grid, Object.values(placements));
  const sides = { party: centre(at("party")), enemy: centre(at("enemy")) };
  const toward = (from: Cell, to: Cell) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return { x: dx / length, y: dy / length };
  };
  // How far its rear or a flank is, by the board (laptop party A: archers and a wight started
  // "rear" 3 cells from the party on a 40-wide board): 3 and 4 on a small one, more on a big one.
  const span = Math.max(grid.width, grid.height);
  const back = Math.max(3, Math.round(span * 0.15));
  const wide = Math.max(4, Math.round(span * 0.1));
  // A flank each kind keeps: the second kind takes the other one, the third the first again. The only
  // kind sent to the flanks, more than one of it, is split between both (laptop pass 8 2026-10-26: four
  // zombies sent to the flanks bunched on one side), the first half on its own flank and the rest on the
  // other.
  const flanks = new Map<string, number>();
  const flankers = new Map<string, string[]>();
  for (const one of stands)
    if (places[one.id] === "flank") {
      const group = one.group ?? one.id;
      flankers.set(group, [...(flankers.get(group) ?? []), one.id]);
    }
  const flankOf = (one: Stand) => {
    const group = one.group ?? one.id;
    if (!flanks.has(group)) flanks.set(group, flanks.size % 2 === 0 ? 1 : -1);
    const kind = flankers.get(group) ?? [one.id];
    const half = kind.indexOf(one.id) < Math.ceil(kind.length / 2);
    return flankers.size === 1 && kind.length > 1 && !half ? -flanks.get(group)! : flanks.get(group)!;
  };
  const move = (one: Stand, target: Cell, clear = 0) => {
    const held = new Set(
      stands.filter((other) => other.id !== one.id && out[other.id]).map((other) => key(out[other.id]!)),
    );
    // Kept `clear` cells from every one of the other side where the board leaves room for it.
    const foes = stands.filter((other) => other.side !== one.side && out[other.id]).map((other) => out[other.id]!);
    const far = clear
      ? new Set(
          [...open].filter((cellKey) => {
            const [x, y] = cellKey.split(",").map(Number) as [number, number];
            return foes.every((foe) => Math.max(Math.abs(foe.x - x), Math.abs(foe.y - y)) > clear);
          }),
        )
      : open;
    const cell = nearestOpen(target, far, held) ?? (clear ? nearestOpen(target, open, held) : null);
    if (cell) out[one.id] = cell;
  };
  for (const one of stands) {
    const place = places[one.id];
    const own = sides[one.side];
    const other = sides[one.side === "party" ? "enemy" : "party"];
    const d = toward(own, other);
    const side = { x: -d.y, y: d.x };
    const apart = Math.hypot(own.x - other.x, own.y - other.y) >= 2;
    if (place) {
      // Its rear is away from the other side through where it stands: behind its own line, or the
      // outside of a ring it is part of (an ambush, whose centre is the party's).
      const from = out[one.id];
      const outward = from && Math.hypot(from.x - other.x, from.y - other.y) >= 1 ? toward(other, from) : null;
      const reach = from ? Math.hypot(from.x - other.x, from.y - other.y) : 0;
      const sign = place === "flank" ? flankOf(one) : 1;
      const target =
        place === "front"
          ? { x: own.x + d.x * 2, y: own.y + d.y * 2 }
          : place === "rear"
            ? outward && Math.hypot(own.x - other.x, own.y - other.y) < reach
              ? { x: other.x + outward.x * (reach + back), y: other.y + outward.y * (reach + back) }
              : { x: own.x - d.x * back, y: own.y - d.y * back }
            : place === "ahead"
              ? { x: own.x + d.x * 5, y: own.y + d.y * 5 }
              : place === "flank"
                ? // Off to its side, and held back as far toward its own side where the
                  // sides stand apart (laptop interim 2026-10-26: on a defense board, flanking skeletons
                  // began two cells from a hero); in an ambush's ring, straight out to the side.
                  {
                    x: other.x + side.x * wide * sign - (apart ? d.x * Math.max(back, wide) : 0),
                    y: other.y + side.y * wide * sign - (apart ? d.y * Math.max(back, wide) : 0),
                  }
                : place === "behind"
                  ? { x: other.x + d.x * 3, y: other.y + d.y * 3 }
                  : place === "among"
                    ? other
                    : null;
      // One on a flank starts out of the other side's reach (laptop pass 8 2026-10-26: a zombie began
      // beside a hero), well back where the sides stand apart and a step clear of it in a ring (laptop
      // 0706 Party B: bandits sent round both flanks began beside the party's line).
      // So does one sent behind the other side, a step clear of its back (laptop e8bd 2026-10-26: a wolf
      // sent "behind" a party standing in defense began beside two heroes, with no ambush in the scene), and
      // one at its rear; one at its front is out of the other side's reach (laptop v3b 2026-10-26: a
      // hero started "rear" in a skirmish began beside three husks, two of them started "front").
      if (target)
        move(
          one,
          target,
          place === "flank"
            ? apart
              ? Math.min(back, wide)
              : 2
            : place === "behind" || place === "rear"
              ? 2
              : place === "front"
                ? 1
                : 0,
        );
      else {
        // In cover: the nearest wood or ruin within six cells of its side, else where it stands.
        const cover = [...open].flatMap((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number) as [number, number];
          const terrain = grid.tiles[y]?.[x];
          return (terrain === "forest" || terrain === "ruin") && Math.hypot(x - own.x, y - own.y) <= 6
            ? [{ x, y }]
            : [];
        });
        if (cover.length)
          move(
            one,
            cover.sort((a, b) => Math.hypot(a.x - own.x, a.y - own.y) - Math.hypot(b.x - own.x, b.y - own.y))[0]!,
          );
      }
      continue;
    }
    const role = roles[one.id];
    const from = out[one.id];
    if (!role || !from) continue;
    const ranged = role === "marksman" || role === "spellcaster" || role === "supporter" || role === "controller";
    const by = ranged ? -2 : role === "bruiser" || role === "bulwark" ? 1 : 0;
    // One that fights from afar begins out of the other side's reach where the board leaves room (laptop
    // level-4 pass 2026-10-26: two goblin archers began beside the wizard).
    if (by !== 0) move(one, { x: from.x + d.x * by, y: from.y + d.y * by }, ranged ? 1 : 0);
  }
  return out;
}

/**
 * Where the player may set their own down before the fight begins (2026-10-24): an open cell the
 * fight reaches within two of where their side lines up, and not within two of an opponent.
 */
export function rulesetDeployCells(
  grid: TacticalGrid,
  placements: Record<string, Cell>,
  stands: readonly Stand[],
  deployers: readonly string[],
): Cell[] {
  const open = reachableFrom(grid, Object.values(placements));
  const home = deployers.flatMap((id) => (placements[id] ? [placements[id]!] : []));
  const foes = stands.filter((one) => one.side === "enemy" && placements[one.id]).map((one) => placements[one.id]!);
  const apart = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const cells: Cell[] = [];
  for (const cellKey of open) {
    const [x, y] = cellKey.split(",").map(Number) as [number, number];
    const cell = { x, y };
    if (home.some((one) => apart(one, cell) <= 2) && foes.every((one) => apart(one, cell) > 2)) cells.push(cell);
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}
