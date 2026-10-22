// Generated dungeon, cave and station maps (Game Mode): a grid of rock, floor, wall and liquid, props
// from the set's eight (slot 5 is the way out: stairs, a ladder or a hatch), named rooms, and where the
// party comes in. Pure and seeded: the same seed and set always lay out the same map.

import type { WorldPlaceMap } from "./place-maps.js";
import { worldMapWordsSchema, type WorldMapWords } from "./edits.js";
import { z } from "zod";

export type DungeonKind = "cave" | "dungeon" | "station";

/** Ground of a cell. Rock is solid and drawn as nothing; a wall is rock that borders an open cell. */
export const DUNGEON_GROUND = ["rock", "floor", "wall", "liquid"] as const;
export type DungeonGround = (typeof DUNGEON_GROUND)[number];

/** The prop slot that is always the way out (stairs down, a ladder, a hatch) in every set. */
export const DUNGEON_EXIT_PROP = 5;

export interface DungeonSet {
  id: string;
  kind: DungeonKind;
  label: string;
  /** Words for the Game Master: the floor, the walls, the liquid, and each prop slot 0..7. */
  floor: string;
  wall: string;
  liquid: string;
  props: readonly [string, string, string, string, string, string, string, string];
}

export const DUNGEON_SETS: readonly DungeonSet[] = Object.freeze([
  {
    id: "cave_rock",
    kind: "cave",
    label: "Rock cave",
    floor: "rough rock",
    wall: "rugged rock walls",
    liquid: "dark water",
    props: [
      "a stalagmite",
      "small stalagmites",
      "a boulder",
      "rubble",
      "glowing mushrooms",
      "a ladder down",
      "a rope and bucket",
      "bones",
    ],
  },
  {
    id: "cave_ice",
    kind: "cave",
    label: "Ice cave",
    floor: "frozen ice",
    wall: "walls of glacial ice",
    liquid: "freezing water",
    props: [
      "an ice spire",
      "icicles",
      "a frozen boulder",
      "a snow drift",
      "a frozen chest",
      "stairs down",
      "an ice crystal",
      "a frozen skeleton",
    ],
  },
  {
    id: "cave_crystal",
    kind: "cave",
    label: "Crystal cave",
    floor: "glinting stone",
    wall: "crystal-studded walls",
    liquid: "a glowing pool",
    props: [
      "violet crystals",
      "teal crystals",
      "crystal shards",
      "a geode",
      "a mossy boulder",
      "stairs down",
      "a miner's lantern",
      "a mining cart",
    ],
  },
  {
    id: "cave_lava",
    kind: "cave",
    label: "Lava cave",
    floor: "black basalt",
    wall: "volcanic rock",
    liquid: "molten lava",
    props: [
      "a basalt column",
      "a smoking vent",
      "obsidian shards",
      "a charred boulder",
      "a scorched chest",
      "stairs down",
      "a brazier",
      "a dragon skull",
    ],
  },
  {
    id: "dungeon_crypt",
    kind: "dungeon",
    label: "Crypt",
    floor: "worn flagstones",
    wall: "stone brick walls",
    liquid: "a murky channel",
    props: [
      "a sarcophagus",
      "a skeleton",
      "a torch stand",
      "a chest",
      "a spike trap",
      "stairs down",
      "a portcullis",
      "a pillar",
    ],
  },
  {
    id: "dungeon_sewer",
    kind: "dungeon",
    label: "Sewer",
    floor: "slimy walkways",
    wall: "mossy brick walls",
    liquid: "sewer water",
    props: ["a grate", "a pipe outlet", "junk", "a rat nest", "a crate", "a ladder up", "a valve wheel", "a barrel"],
  },
  {
    id: "dungeon_temple",
    kind: "dungeon",
    label: "Sunken temple",
    floor: "cracked sandstone",
    wall: "carved temple walls",
    liquid: "a still pool",
    props: [
      "a broken statue",
      "an altar",
      "a fallen column",
      "an urn",
      "a golden idol",
      "stairs down",
      "a carved door",
      "a brazier",
    ],
  },
  {
    id: "station_corridor",
    kind: "station",
    label: "Station corridor",
    floor: "deck plates",
    wall: "bulkheads",
    liquid: "spilled coolant",
    props: [
      "a supply crate",
      "a terminal",
      "an airlock door",
      "a maintenance robot",
      "a coolant tank",
      "a ladder hatch",
      "a vent",
      "cargo containers",
    ],
  },
  {
    id: "station_lab",
    kind: "station",
    label: "Research lab",
    floor: "white lab tiles",
    wall: "lab walls",
    liquid: "a chemical spill",
    props: [
      "a specimen tube",
      "a lab bench",
      "a holo display",
      "a medical bed",
      "a sample freezer",
      "a ladder hatch",
      "a server rack",
      "a broken robot",
    ],
  },
  {
    id: "station_engine",
    kind: "station",
    label: "Engine room",
    floor: "grated decking",
    wall: "pipe-lined walls",
    liquid: "plasma coolant",
    props: [
      "a reactor core",
      "a generator",
      "a pipe junction",
      "a control console",
      "fuel canisters",
      "a ladder hatch",
      "a sparking cable box",
      "a tool cart",
    ],
  },
  {
    id: "station_hydro",
    kind: "station",
    label: "Hydroponics bay",
    floor: "drained decking",
    wall: "glass panels and plant racks",
    liquid: "a nutrient basin",
    props: [
      "a planter",
      "a fruit tree pod",
      "a water tank",
      "a grow-light rack",
      "seed storage",
      "a ladder hatch",
      "a gardening robot",
      "a compost bin",
    ],
  },
]);

export interface DungeonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DungeonMap {
  set: string;
  seed: number;
  width: number;
  height: number;
  /** Row-major, `width * height`. */
  ground: DungeonGround[];
  /** Row-major prop slot per cell, or -1. */
  props: number[];
  rooms: DungeonRoom[];
  /** Where the party comes in, on the way-out prop. */
  entrance: { x: number; y: number };
  /** A map made by hand (map editor Phase 3): its props are drawn only and never block a walk. */
  drawnProps?: true;
  /** A map made by hand's own words for the Game Master (1.357). */
  words?: WorldMapWords;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (map: { width: number }, x: number, y: number) => y * map.width + x;

/** Whether the party can stand on a cell: floor, or the way out. Liquid, walls, rock and props block. */
export function dungeonWalkable(map: DungeonMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = at(map, x, y);
  if (map.drawnProps) return map.ground[i] === "floor";
  return map.ground[i] === "floor" && (map.props[i] === -1 || map.props[i] === DUNGEON_EXIT_PROP);
}

/** The shortest walk between two cells, four ways, as the cells after the start; null when none. */
export function dungeonPath(
  map: DungeonMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  if (!dungeonWalkable(map, to.x, to.y)) return null;
  const prev = new Int32Array(map.width * map.height).fill(-2);
  const start = at(map, from.x, from.y);
  prev[start] = -1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const x = cell % map.width;
    const y = (cell - x) / map.width;
    if (x === to.x && y === to.y) {
      const path: { x: number; y: number }[] = [];
      for (let c = cell; c !== start; c = prev[c]!) path.unshift({ x: c % map.width, y: Math.floor(c / map.width) });
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!dungeonWalkable(map, nx, ny)) continue;
      const next = at(map, nx, ny);
      if (prev[next] !== -2) continue;
      prev[next] = cell;
      queue.push(next);
    }
  }
  return null;
}

function carveRoom(ground: DungeonGround[], width: number, room: DungeonRoom) {
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) ground[y * width + x] = "floor";
}

function carveCorridor(
  ground: DungeonGround[],
  width: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  wide: boolean,
  random: () => number,
) {
  const horizontalFirst = random() < 0.5;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    for (let x = x0, y = y0; ; x += dx, y += dy) {
      ground[y * width + x] = "floor";
      if (wide) ground[(y + (dx ? 1 : 0)) * width + x + (dy ? 1 : 0)] = "floor";
      if (x === x1 && y === y1) break;
    }
  };
  if (horizontalFirst) {
    line(a.x, a.y, b.x, a.y);
    line(b.x, a.y, b.x, b.y);
  } else {
    line(a.x, a.y, a.x, b.y);
    line(a.x, b.y, b.x, b.y);
  }
}

const centre = (room: DungeonRoom) => ({ x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) });

/** Rooms that do not touch, a margin of rock between them and from the edge. */
function placeRooms(
  width: number,
  height: number,
  count: number,
  min: number,
  max: number,
  random: () => number,
): DungeonRoom[] {
  const rooms: DungeonRoom[] = [];
  for (let tries = 0; tries < count * 30 && rooms.length < count; tries++) {
    const w = min + Math.floor(random() * (max - min + 1));
    const h = min + Math.floor(random() * (max - min + 1));
    const x = 2 + Math.floor(random() * (width - w - 4));
    const y = 2 + Math.floor(random() * (height - h - 4));
    const room = { x, y, w, h };
    if (rooms.some((r) => x < r.x + r.w + 2 && r.x < x + w + 2 && y < r.y + r.h + 2 && r.y < y + h + 2)) continue;
    rooms.push(room);
  }
  // In reading order of their centres, so the way in is always the first.
  return rooms;
}

function caveGround(width: number, height: number, random: () => number): DungeonGround[] {
  let open = Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return false;
    return random() < 0.55;
  });
  for (let step = 0; step < 5; step++) {
    open = open.map((_, i) => {
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return false;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open[(y + dy) * width + x + dx]) n++;
      return n >= 5 || (open[i] === true && n >= 4);
    });
  }
  return open.map((cell) => (cell ? "floor" : "rock"));
}

/** Keeps only the largest connected open area, so every floor cell can be walked to. */
function keepLargest(ground: DungeonGround[], width: number, height: number) {
  const seen = new Int32Array(width * height).fill(-1);
  let best = -1;
  let bestSize = 0;
  let label = 0;
  for (let i = 0; i < ground.length; i++) {
    if (ground[i] !== "floor" || seen[i] !== -1) continue;
    const queue = [i];
    seen[i] = label;
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      const x = c % width;
      for (const n of [c - 1, c + 1, c - width, c + width]) {
        if (n < 0 || n >= ground.length || (n === c - 1 && x === 0) || (n === c + 1 && x === width - 1)) continue;
        if (ground[n] === "floor" && seen[n] === -1) {
          seen[n] = label;
          queue.push(n);
        }
      }
    }
    if (queue.length > bestSize) {
      bestSize = queue.length;
      best = label;
    }
    label++;
  }
  for (let i = 0; i < ground.length; i++) if (ground[i] === "floor" && seen[i] !== best) ground[i] = "rock";
}

/** Areas of a cave as rooms: the open cells of each quarter-sized block, boxed. */
function caveRooms(ground: DungeonGround[], width: number, height: number): DungeonRoom[] {
  const rooms: DungeonRoom[] = [];
  const bw = Math.ceil(width / 3);
  const bh = Math.ceil(height / 3);
  for (let by = 0; by < 3; by++)
    for (let bx = 0; bx < 3; bx++) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -1,
        maxY = -1,
        n = 0;
      for (let y = by * bh; y < Math.min(height, (by + 1) * bh); y++)
        for (let x = bx * bw; x < Math.min(width, (bx + 1) * bw); x++)
          if (ground[y * width + x] === "floor") {
            n++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
      if (n >= 12) rooms.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
  return rooms;
}

/** Whether every floor cell is one area, four ways. */
function floorConnected(ground: DungeonGround[], width: number): boolean {
  const first = ground.indexOf("floor");
  if (first < 0) return true;
  const seen = new Uint8Array(ground.length);
  const queue = [first];
  seen[first] = 1;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const x = c % width;
    for (const n of [x > 0 ? c - 1 : -1, x < width - 1 ? c + 1 : -1, c - width, c + width]) {
      if (n < 0 || n >= ground.length || seen[n] || ground[n] !== "floor") continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return queue.length === ground.filter((cell) => cell === "floor").length;
}

export const DUNGEON_MAP_SIZES = { small: [28, 20], medium: [40, 28], large: [56, 36] } as const;
export type DungeonMapSize = keyof typeof DUNGEON_MAP_SIZES;

export function generateDungeonMap(setId: string, seed: number, size: DungeonMapSize = "medium"): DungeonMap {
  const set = DUNGEON_SETS.find((each) => each.id === setId) ?? DUNGEON_SETS[0]!;
  const [width, height] = DUNGEON_MAP_SIZES[size];
  const random = mulberry32(seed ^ 0x9e3779b9);
  let ground: DungeonGround[];
  let rooms: DungeonRoom[];
  if (set.kind === "cave") {
    ground = caveGround(width, height, random);
    keepLargest(ground, width, height);
    rooms = caveRooms(ground, width, height);
  } else {
    ground = Array.from({ length: width * height }, () => "rock" as DungeonGround);
    const count = Math.round((width * height) / (set.kind === "station" ? 110 : 90));
    rooms =
      set.kind === "station"
        ? placeRooms(width, height, count, 4, 8, random)
        : placeRooms(width, height, count, 3, 7, random);
    rooms.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const room of rooms) carveRoom(ground, width, room);
    // Each room joined to the nearest already joined, so all are reachable.
    for (let i = 1; i < rooms.length; i++) {
      const here = centre(rooms[i]!);
      let nearest = rooms[0]!;
      for (const other of rooms.slice(0, i)) {
        const c = centre(other);
        const n = centre(nearest);
        if (Math.abs(c.x - here.x) + Math.abs(c.y - here.y) < Math.abs(n.x - here.x) + Math.abs(n.y - here.y))
          nearest = other;
      }
      carveCorridor(ground, width, here, centre(nearest), set.kind === "station", random);
    }
  }
  // Liquid: a pool inside some rooms, never on their edge, so a room stays walkable round it.
  for (const room of rooms) {
    if (room.w < 5 || room.h < 5 || random() > 0.35) continue;
    const pw = 1 + Math.floor(random() * (room.w - 4));
    const ph = 1 + Math.floor(random() * (room.h - 4));
    const px = room.x + 2 + Math.floor(random() * (room.w - pw - 3));
    const py = room.y + 2 + Math.floor(random() * (room.h - ph - 3));
    const poured: number[] = [];
    for (let y = py; y < py + ph; y++)
      for (let x = px; x < px + pw; x++)
        if (ground[y * width + x] === "floor") {
          ground[y * width + x] = "liquid";
          poured.push(y * width + x);
        }
    // A pool that would cut the floor in two is not poured.
    if (!floorConnected(ground, width)) for (const i of poured) ground[i] = "floor";
  }
  // Walls: rock that borders an open cell (eight ways).
  const isOpen = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && ground[y * width + x] !== "rock" && ground[y * width + x] !== "wall";
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (ground[y * width + x] !== "rock") continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isOpen(x + dx, y + dy)) near = true;
      if (near) ground[y * width + x] = "wall";
    }
  const map: DungeonMap = {
    set: set.id,
    seed,
    width,
    height,
    ground,
    props: ground.map(() => -1),
    rooms,
    entrance: { x: 0, y: 0 },
  };
  // The way in: the way-out prop in the first room, on a floor cell.
  const firstFloor = (room: DungeonRoom) => {
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) if (ground[y * width + x] === "floor") return { x, y };
    return null;
  };
  const way = (rooms[0] && firstFloor(rooms[0])) ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  map.entrance = way;
  map.props[at(map, way.x, way.y)] = DUNGEON_EXIT_PROP;
  // Props: a few per room against its walls, never closing a way through (checked by walking).
  const reachable = () => {
    let n = 0;
    let open = 0;
    const seen = new Uint8Array(width * height);
    const queue = [at(map, way.x, way.y)];
    seen[queue[0]!] = 1;
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      const x = c % width;
      const y = Math.floor(c / width);
      n++;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        if (dungeonWalkable(map, x + dx, y + dy) && !seen[at(map, x + dx, y + dy)]) {
          seen[at(map, x + dx, y + dy)] = 1;
          queue.push(at(map, x + dx, y + dy));
        }
    }
    for (let i = 0; i < ground.length; i++)
      if (ground[i] === "floor" && (map.props[i] === -1 || map.props[i] === DUNGEON_EXIT_PROP)) open++;
    return n === open;
  };
  for (const room of rooms) {
    const want = 1 + Math.floor(random() * Math.max(1, Math.floor((room.w * room.h) / 12)));
    for (let k = 0, tries = 0; k < want && tries < 20; tries++) {
      const x = room.x + Math.floor(random() * room.w);
      const y = room.y + Math.floor(random() * room.h);
      const i = at(map, x, y);
      if (ground[i] !== "floor" || map.props[i] !== -1) continue;
      const slots = [0, 1, 2, 3, 4, 6, 7];
      map.props[i] = slots[Math.floor(random() * slots.length)]!;
      if (!reachable()) {
        map.props[i] = -1;
        continue;
      }
      k++;
    }
  }
  return map;
}

/** The map in words for the Game Master: each room's props, and where the way out is. */
export function dungeonMapWords(map: DungeonMap): string {
  const set = DUNGEON_SETS.find((each) => each.id === map.set) ?? DUNGEON_SETS[0]!;
  if (!map.rooms.length) {
    // A map made by hand has no areas, and its pack's props are its own: what it is, not what stands
    // there by the set's names (the place's name and the story say that), unless it says so itself (1.357).
    const words = map.words;
    const hasLiquid = map.ground.includes("liquid");
    if (!words) {
      const liquid = hasLiquid ? ", with liquid in it" : "";
      return `A place made by hand${liquid}. The way out is where the party came in.`;
    }
    const counts = new Map<number, number>();
    for (const prop of map.props) if (prop >= 0 && words.props?.[prop]) counts.set(prop, (counts.get(prop) ?? 0) + 1);
    const ground = [words.floor, words.wall].filter(Boolean).join(", ");
    const things = [...counts]
      .sort(([a], [b]) => a - b)
      .map(([prop, n]) => (n > 1 ? `${words.props![prop]} (${n})` : words.props![prop]!));
    const liquid = hasLiquid ? (words.liquid ?? "liquid") : null;
    return `A place made by hand${ground ? ` (${ground})` : ""}${liquid ? `, with ${liquid} in it` : ""}${things.length ? `; in it: ${things.join(", ")}` : ""}. The way out is where the party came in.`;
  }
  const rooms = map.rooms.map((room, index) => {
    const counts = new Map<number, number>();
    let liquid = false;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        const i = at(map, x, y);
        if (map.ground[i] === "liquid") liquid = true;
        const prop = map.props[i]!;
        if (prop >= 0) counts.set(prop, (counts.get(prop) ?? 0) + 1);
      }
    const things = [...counts].map(([prop, n]) => (n > 1 ? `${set.props[prop]} (${n})` : set.props[prop]!));
    if (liquid) things.push(set.liquid);
    return `area ${index + 1}${things.length ? `: ${things.join(", ")}` : ""}`;
  });
  return `${set.label} (${set.floor}, ${set.wall}); ${rooms.join("; ")}. The way out is ${set.props[DUNGEON_EXIT_PROP]} in area 1.`;
}

// ── Stored on the chat ──

/** One character per cell: rock, floor, wall, liquid. */
const GROUND_CHARS: Record<DungeonGround, string> = { rock: "r", floor: ".", wall: "#", liquid: "~" };
const GROUND_OF: Record<string, DungeonGround> = { r: "rock", ".": "floor", "#": "wall", "~": "liquid" };
const MAP_MAX_CELLS = 64 * 48;

/** The map a game keeps, as it was made: an update to the generator never changes one in play. */
export const gameDungeonMapSchema = z
  .object({
    /** Changes when the party enters another map, so a walk on the old one is never applied to it. */
    id: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    /** The world place it is a map of, when it was entered from one (a building in town). */
    place: z.string().min(1).max(160).optional(),
    set: z.string().max(40),
    /** A hand-made map's own image pack, by its id (else the set's). */
    pack: z.string().max(120).optional(),
    /** Made by hand (map editor Phase 3): props drawn only, and the way out is where the party came in. */
    hand: z.literal(true).optional(),
    /** A map made by hand's own words for the Game Master (1.357). */
    words: worldMapWordsSchema.optional(),
    /** Where people stand on a map made by hand, by the hour (map editor Phase 3, B3), with their names as
     *  they were when the party went in. */
    spots: z
      .array(
        z
          .object({
            x: z.number().int().min(0).max(63),
            y: z.number().int().min(0).max(47),
            name: z.string().trim().min(1).max(80),
            people: z
              .array(z.object({ id: z.string().min(1).max(32), name: z.string().trim().min(1).max(120) }).strict())
              .max(8),
            from: z.number().int().min(0).max(23).optional(),
            to: z.number().int().min(1).max(24).optional(),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    seed: z.number().int(),
    // As small as a map made by hand may be (WORLD_MAP_MAX's floor, map editor Phase 3).
    width: z.number().int().min(4).max(64),
    height: z.number().int().min(4).max(48),
    ground: z
      .string()
      .regex(/^[r.#~]+$/u)
      .max(MAP_MAX_CELLS),
    props: z
      .string()
      .regex(/^[-0-7]+$/u)
      .max(MAP_MAX_CELLS),
    rooms: z
      .array(z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() }).strict())
      .max(40),
    entrance: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
    /** Where the party stands. */
    at: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
  })
  .strict()
  .refine((map) => map.ground.length === map.width * map.height && map.props.length === map.width * map.height, {
    message: "A map's cells fill its width and height",
  })
  .refine(
    (map) =>
      [map.at, map.entrance].every((p) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height) &&
      !/[\p{Cc}]/u.test(map.name),
    { message: "A map's party and way in stand on it, and its name is one line" },
  );
export type GameDungeonMap = z.infer<typeof gameDungeonMapSchema>;

/** A walk on the map not yet told to the Game Master: from where to where, and how long it took. */
export const gameDungeonWalkSchema = z
  .object({
    /** Changes with every walk, so a turn clears only the walk it told. */
    id: z.string().min(1).max(80),
    map: z.string().max(80),
    from: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
    to: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
    minutes: z.number().int().min(0).max(600),
    /** On a map made by hand: the place it is the map of, and every cell walked, the last included, for
     *  the story's step events (map events). A generated map's cells are never a story's. */
    place: z.string().min(1).max(160).optional(),
    steps: z
      .array(z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(47) }).strict())
      .max(2000)
      .optional(),
  })
  .strict();
export type GameDungeonWalk = z.infer<typeof gameDungeonWalkSchema>;

/** The game's map from chat metadata, or null for none (every game before maps, and one that left). */
export function gameDungeonMapFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GameDungeonMap | null {
  const parsed = gameDungeonMapSchema.safeParse(metadata?.gameDungeonMap);
  return parsed.success ? parsed.data : null;
}

export function gameDungeonWalkFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GameDungeonWalk | null {
  const parsed = gameDungeonWalkSchema.safeParse(metadata?.gameDungeonWalk);
  return parsed.success ? parsed.data : null;
}

/** A generated map as the game keeps it, the party at its entrance. */
export function gameDungeonMapFromDungeon(map: DungeonMap, name: string, id: string): GameDungeonMap {
  return {
    id,
    name: name.trim().slice(0, 80) || (DUNGEON_SETS.find((set) => set.id === map.set)?.label ?? "Map"),
    set: map.set,
    seed: map.seed,
    width: map.width,
    height: map.height,
    ground: map.ground.map((cell) => GROUND_CHARS[cell]).join(""),
    props: map.props.map((prop) => (prop < 0 ? "-" : String(prop))).join(""),
    rooms: map.rooms.slice(0, 40),
    entrance: map.entrance,
    at: map.entrance,
  };
}

/** A kept map back as cells, for walking and drawing. */
export function dungeonFromGameDungeonMap(map: GameDungeonMap): DungeonMap {
  return {
    set: map.set,
    seed: map.seed,
    width: map.width,
    height: map.height,
    ground: [...map.ground].map((char) => GROUND_OF[char] ?? "rock"),
    props: [...map.props].map((char) => (char === "-" ? -1 : Number(char))),
    rooms: map.rooms,
    entrance: map.entrance,
    ...(map.hand ? { drawnProps: true as const } : {}),
    ...(map.words ? { words: map.words } : {}),
  };
}

/** Whether the party stands on the way out: the way-out prop, or (a map made by hand has none) where it
 *  came in. */
export function gameDungeonOnWayOut(map: GameDungeonMap): boolean {
  if (map.at.x === map.entrance.x && map.at.y === map.entrance.y) return true;
  // A map made by hand: its props are drawn only, a way-out prop among them too.
  if (map.hand) return false;
  return map.props[map.at.y * map.width + map.at.x] === String(DUNGEON_EXIT_PROP);
}

/** A place's hand-made map (map editor Phase 3) as the map a game keeps: its cells, its props by slot
 *  (drawn only), in at its entry. */
export function gameDungeonMapFromPlaceMap(
  map: WorldPlaceMap,
  name: string,
  set: DungeonSet,
  id: string,
  place: string,
  /** A person's name by their id, for the people on the map's spots (one with none is left off). */
  personName: (id: string) => string | undefined = () => undefined,
): GameDungeonMap {
  const spots = (map.spots ?? []).map((spot) => ({
    x: spot.x,
    y: spot.y,
    name: spot.name,
    people: (spot.people ?? []).flatMap((person) => {
      const named = personName(person);
      return named ? [{ id: person, name: named }] : [];
    }),
    ...(spot.from !== undefined ? { from: spot.from } : {}),
    ...(spot.to !== undefined ? { to: spot.to } : {}),
  }));
  const props = Array.from({ length: map.width * map.height }, () => "-");
  for (const prop of map.props ?? []) props[prop.y * map.width + prop.x] = prop.tile.replace(/^dn_prop/u, "");
  return {
    id,
    name: name.trim().slice(0, 80) || set.label,
    place,
    set: set.id,
    ...(map.pack ? { pack: map.pack } : {}),
    hand: true,
    ...(map.words ? { words: structuredClone(map.words) } : {}),
    seed: 0,
    width: map.width,
    height: map.height,
    ground: map.ground,
    props: props.join(""),
    rooms: [],
    entrance: map.entry,
    at: map.entry,
    ...(spots.length ? { spots } : {}),
  };
}

/** The spots of a kept map whose people stand there at an hour (all day when a spot names no hours;
 *  hours wrap past midnight), as `worldPlaceMapSpotsAt` reads a map made by hand. */
export function gameDungeonSpotsAt(map: GameDungeonMap, hour: number): NonNullable<GameDungeonMap["spots"]> {
  return (map.spots ?? []).filter((spot) => {
    const [from, to] = [spot.from ?? 0, spot.to ?? 24];
    return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
  });
}

/** The way out in words for leaving by it: "the stairs", "the ladder", "the ladder hatch" (the set's
 *  word for the tile says which way it goes, which leaving does not). */
export function dungeonWayOutWords(set: DungeonSet): string {
  // A trailing " down"/" up" goes without a /\s+(down|up)$/ regex, which stalls on long runs of spaces.
  const exit = set.props[DUNGEON_EXIT_PROP] ?? "way out";
  const way = ["down", "up"].find((word) => exit.endsWith(word));
  const head = way ? exit.slice(0, -way.length) : "";
  const tile = head.trimEnd() !== head ? head.trimEnd() : exit;
  return /^(an?|the) /u.test(tile) ? tile.replace(/^an? /u, "the ") : `the ${tile}`;
}

/** The ways out a set can have, for the label the client shows in the reader's language. */
export const DUNGEON_WAY_OUT_IDS = ["stairs", "ladder", "ladder_hatch", "way_out"] as const;
export type DungeonWayOutId = (typeof DUNGEON_WAY_OUT_IDS)[number];

/** The way out of a set as an id (`dungeonWayOutWords` without its words): "stairs", "ladder",
 *  "ladder_hatch", else "way_out". */
export function dungeonWayOutId(set: DungeonSet | undefined): DungeonWayOutId {
  if (!set) return "way_out";
  const id = dungeonWayOutWords(set).replace(/^the /u, "").replace(/\s+/gu, "_");
  return (DUNGEON_WAY_OUT_IDS as readonly string[]).includes(id) ? (id as DungeonWayOutId) : "way_out";
}

/** Words in a place's name that make it one to go down into (map editor Phase 3, generated maps for
 *  places), and the look each gives. Only these: a "Frozen Flagon" or a "Gem Merchant" stays an inn and
 *  a shop. Station words only in a science fiction setting, and only for a station that is a ruin or a
 *  shelter: a research station or a maglev station in town is a building like any other. */
const PLACE_CORE =
  /\b(caves?|caverns?|grotto|grottoes|mines?|mineshaft|crypts?|tombs?|catacombs?|barrows?|ossuary|mausoleum|sewers?|cisterns?|tunnels?|undercroft|ruins?|ruined|dungeons?|labyrinth|oubliette|warrens?|lairs?|delve)\b/u;
const SHELTER_CORE = /\b(derelict|bunkers?|hangars?|orbital|space station)\b/u;
/** Of a place to go down into, the look its words give, in the order they are read; else by its kind. */
const PLACE_LOOKS: ReadonlyArray<[RegExp, string]> = [
  [/\b(lava|magma|volcanic|volcano|molten)\b/u, "cave_lava"],
  [/\b(ice|icy|frozen|glacier)\b/u, "cave_ice"],
  [/\b(crystal|crystals|crystalline|geode)\b/u, "cave_crystal"],
  [/\b(crypts?|tombs?|catacombs?|barrows?|ossuary|mausoleum)\b/u, "dungeon_crypt"],
  [/\b(sewers?|cisterns?|tunnels?|undercroft)\b/u, "dungeon_sewer"],
  [/\b(ruins?|ruined)\b/u, "dungeon_temple"],
  [/\b(dungeons?|labyrinth|oubliette)\b/u, "dungeon_crypt"],
];
const STATION_LOOKS: ReadonlyArray<[RegExp, string]> = [
  [/\b(labs?|laborator\w*)\b/u, "station_lab"],
  [/\b(reactors?|engines?|engineering)\b/u, "station_engine"],
  [/\b(hydroponics?|greenhouse)\b/u, "station_hydro"],
];

/** The look of a map for a place, by its name (and the tags "mine" and "ruin"), or null for a place
 *  that is not one to go down into (a house, an inn, a market). */
export function dungeonSetForPlace(
  place: { name?: string; tags?: readonly string[] },
  family: string | undefined,
): DungeonSet | null {
  const name = (place.name ?? "").toLowerCase();
  const tags = (place.tags ?? []).map((tag) => tag.toLowerCase());
  const byId = (id: string) => DUNGEON_SETS.find((set) => set.id === id)!;
  // A bunker or a derelict is a station's corridors in any setting; a station only in science fiction.
  if (SHELTER_CORE.test(name) && (family === "scifi" || /\b(derelict|bunkers?)\b/u.test(name)))
    return byId(STATION_LOOKS.find(([pattern]) => pattern.test(name))?.[1] ?? "station_corridor");
  if (PLACE_CORE.test(name)) return byId(PLACE_LOOKS.find(([pattern]) => pattern.test(name))?.[1] ?? "cave_rock");
  if (tags.includes("ruin")) return byId("dungeon_temple");
  if (tags.includes("mine")) return byId("cave_rock");
  return null;
}

/** The set a map of this kind uses in a setting of this art family: a station for a science fiction
 *  setting, else the kind's first set; a named set wins when it is one. */
export function dungeonSetFor(kind: string | undefined, family: string | undefined, named?: string): DungeonSet {
  const byId = named
    ? DUNGEON_SETS.find((set) => set.id === named || set.label.toLowerCase() === named.toLowerCase())
    : undefined;
  if (byId) return byId;
  const wanted: DungeonKind =
    kind === "cave" || kind === "dungeon" || kind === "station" ? kind : family === "scifi" ? "station" : "dungeon";
  return DUNGEON_SETS.find((set) => set.kind === wanted)!;
}

/** Which of the map's areas a cell is in (1-based), or 0 for a passage between them. */
export function dungeonAreaAt(map: { rooms: readonly DungeonRoom[] }, x: number, y: number): number {
  const index = map.rooms.findIndex((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h);
  return index + 1;
}

/** How long a walk of `steps` cells takes: a cell is about two metres, a minute some thirty of them. */
export function dungeonWalkMinutes(steps: number): number {
  return Math.max(1, Math.round(steps / 30));
}

/** The map and where the party stands, for the Game Master. */
export function gameDungeonMapPromptText(map: GameDungeonMap, hour?: number): string {
  const cells = dungeonFromGameDungeonMap(map);
  const area = dungeonAreaAt(map, map.at.x, map.at.y);
  const where = !map.rooms.length
    ? gameDungeonOnWayOut(map)
      ? "by the way out"
      : "inside"
    : area
      ? `in area ${area}`
      : "in a passage between areas";
  // Who stands where now, on a map made by hand with spots.
  const here =
    hour === undefined
      ? []
      : gameDungeonSpotsAt(map, hour).flatMap((spot) =>
          spot.people.length ? [`${spot.name}: ${spot.people.map((person) => person.name).join(", ")}`] : [],
        );
  return `MAP: ${map.name}. ${dungeonMapWords(cells)} The party is ${where}.${here.length ? ` Here now: ${here.join("; ")}.` : ""}`;
}

/** A walk on the map, told to the Game Master on the next turn. */
export function gameDungeonWalkText(map: GameDungeonMap, walk: GameDungeonWalk): string {
  const from = dungeonAreaAt(map, walk.from.x, walk.from.y);
  const to = dungeonAreaAt(map, walk.to.x, walk.to.y);
  const minutes = `${walk.minutes} minute${walk.minutes === 1 ? "" : "s"}`;
  if (!map.rooms.length) return `The party walked across ${map.name} (${minutes}).`;
  const where = (area: number) => (area ? `area ${area}` : "a passage");
  return `The party walked from ${where(from)} to ${where(to)} of ${map.name} (${walk.minutes} minute${walk.minutes === 1 ? "" : "s"}).`;
}

/** What a reply's `[map: ...]` tags ask for, in order: a map to go into, or leaving the one the party
 *  is on. `[map_update: ...]` is the node map's own tag and never one of these. */
export type GameDungeonTag =
  | { leave: true }
  | { leave?: false; reveal?: false; kind?: string; name: string; set?: string }
  /** `[map: reveal name="..."]`: a site the story keeps closed is opened to the party (no map is opened). */
  | { leave?: false; reveal: true; name: string };

export function readGameDungeonTags(text: string): GameDungeonTag[] {
  const tags: GameDungeonTag[] = [];
  // Each `[map:` runs to the first "]" after it, found by indexOf: a /\[map:\s*([^\]]*)\]/ regex stalls
  // on a long tag left open (many spaces, or many `[map:`, with no "]" after them).
  const opener = /\[map:/giu;
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const close = text.indexOf("]", opener.lastIndex);
    if (close < 0) break;
    const body = text.slice(opener.lastIndex, close).trimStart();
    opener.lastIndex = close + 1;
    if (/^\s*leave\b/iu.test(body) || /\baction\s*=\s*"leave"/iu.test(body)) {
      tags.push({ leave: true });
      continue;
    }
    // One line of plain text: a name goes into the Game Master's prompt.
    const value = (key: string) =>
      body
        .match(new RegExp(`\\b${key}\\s*=\\s*"([^"]{0,80})"`, "iu"))?.[1]
        ?.replace(/[\p{Cc}\s]+/gu, " ")
        .trim();
    const name = value("name");
    if (!name) continue;
    if (/^\s*reveal\b/iu.test(body) || /\baction\s*=\s*"reveal"/iu.test(body)) {
      tags.push({ reveal: true, name });
      continue;
    }
    tags.push({ name, kind: value("kind")?.toLowerCase(), set: value("set") });
  }
  return tags;
}

/** A seed from a game and a name, so the same place makes the same map when it is gone into again. */
export function gameDungeonSeed(chatId: string, name: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${chatId}|${name.toLowerCase()}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

/** A walk or a leaving not yet told, for the next turn. */
export function gameDungeonToldText(
  map: GameDungeonMap | null,
  walk: GameDungeonWalk | null,
  left: string | null,
): string {
  const lines: string[] = [];
  if (left) lines.push(`The party has left ${left} by its way out.`);
  if (map && walk && walk.map === map.id) lines.push(gameDungeonWalkText(map, walk));
  return lines.join(" ");
}
