// ──────────────────────────────────────────────
// The town (worldgen W8b): a settlement laid out as streets, a square and buildings, from the seed. The
// places in it come first (the world's own places inside the settlement and those the story added), then
// its landmark, then the workplaces of the people whose trade fits what the place is known for, then
// homes for everyone. Each person has a home and, by day, a place to be. Lots are claimed nearest the
// crossroads first, as Pixelforge lays its towns out. Pure: the same world gives the same town.
//
// A town can also be laid out by hand (W9h), in the world's hand edits: buildings moved between its lots
// (a lot faces a street, its door on it, so a moved building always does too), and its ground painted.
// The hand layout is applied after the town is laid out, so its people and ids hold.
//
// The places the story adds come last of all, each on the next free lot, so a world's snapshot (W11)
// keeps each town as laid out with its edits and the story's places are added on top of it, the same
// as when the town is laid out whole.
// ──────────────────────────────────────────────
import { z } from "zod";
import { worldStream, type WorldPlace } from "./compile.js";
import { compileGameWorld } from "./game-world.js";
import {
  WORLD_TOWN_WALKABLE,
  worldPersonByHand,
  type WORLD_TOWN_DOOR_SIDES,
  type WORLD_TOWN_PROPS,
  type WorldEdits,
} from "./edits.js";
import type { GameWorld } from "./game-world.js";
import type { WorldPresent } from "./ledger.js";
import { WORLD_PEOPLE_DEFAULTS, worldCast, type WorldPerson } from "./people.js";
import { worldBuildingHasRooms, worldInteriorEditIssues, worldInteriorUse, worldNamedPlaceUse } from "./interior.js";
import type { WorldInteriorUse } from "./furniture.js";
import { worldMapEditIssues, worldSiteEditIssues } from "./place-maps.js";
import { worldBandEditIssues } from "./spawns.js";
import { worldIsSite } from "./sites.js";

export const WORLD_TOWN_KINDS = Object.freeze(["landmark", "place", "work", "home"] as const);
export type WorldTownKind = (typeof WORLD_TOWN_KINDS)[number];

export interface WorldTownBuilding {
  id: string;
  kind: WorldTownKind;
  /** Its lot, in town cells; the roof is the top rows, the front the bottom row. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The street cell before its door. */
  door: { x: number; y: number };
  /** A world place it is (inside the settlement, or added by the story), and its name. */
  placeId?: string;
  name?: string;
  /** Work: the trade (the kit's word for the role) of the people who work here. */
  role?: string;
  /** Who lives here (a home) or works here (anything else). */
  people: string[];
  /** What its rooms are furnished as (worldgen W13), worked out once when the town is laid out (from
   *  its place's tags, its trade and its name); none for a part of town, which has no rooms. A town kept
   *  in a snapshot made before W13 has none, and it is worked out when asked for. */
  use?: WorldInteriorUse;
}

export interface WorldTown {
  settlementId: string;
  width: number;
  height: number;
  /** One character per cell, row by row: "." open ground, "s" street, "q" the square; by hand also o, t, w
   *  and (Phase 2) f, p, ~, b, h (WORLD_TOWN_GROUND). */
  ground: string;
  square: { x: number; y: number; w: number; h: number };
  buildings: WorldTownBuilding[];
  /** Each person's home and, if any, workplace, by building id. */
  homeOf: Record<string, string>;
  workOf: Record<string, string>;
  /** Everyone in town: the settlement's people and those of the places inside it. */
  people: WorldPerson[];
  /** Market stalls in the square, by cell. */
  stalls: Array<{ x: number; y: number }>;
  /** Every lot a building can stand on (worldgen W9h): where a building may be moved by hand. */
  lots: WorldTownLot[];
  /** Decorations laid by hand (map editor Phase 2): a pack's props, drawn only. */
  deco?: Array<{ tile: (typeof WORLD_TOWN_PROPS)[number]; x: number; y: number }>;
}

/** A lot: its cells (the roof the top rows, the front the bottom row) and the street cell before its door. */
export interface WorldTownLot {
  x: number;
  y: number;
  w: number;
  h: number;
  door: { x: number; y: number };
}

/** A town laid out by hand (W9h). */
export type WorldTownEdit = NonNullable<WorldEdits["towns"]>[number];

/** Town cells across and down by size tier (a hamlet .. a city). */
const SIZES: ReadonlyArray<readonly [number, number]> = [
  [22, 16],
  [30, 20],
  [40, 28],
  [52, 36],
];
const SQUARES: ReadonlyArray<readonly [number, number]> = [
  [3, 3],
  [5, 3],
  [7, 5],
  [9, 7],
];
/** A lot: four wide and three deep facing a street that runs across, the other way facing one down. */
const LOT_ACROSS = { w: 4, h: 3 };
const LOT_DOWN = { w: 3, h: 4 };
/** How many people share a home. */
const PER_HOME = 3;
/** The share of the lots still free that the townsfolk the story never names live on, by size tier. */
const FILL = [0.3, 0.45, 0.6, 0.75];
/** A place known for trade (by the words of its tags) has stalls in its square. */
const TRADE = /market|bazaar|trade|souk|fair|merchant/;

/** The size tier of a settlement, 0 (the smallest on the kit's ladder) to 3 (the biggest). */
export function worldTownTier(game: GameWorld, place: WorldPlace): number {
  const top = Math.max(1, game.kit.sizes.length - 1);
  return Math.min(3, Math.floor(((place.rank ?? 0) * 3) / top));
}

/**
 * The town a settlement is, laid out from the seed and then as the world's hand edits lay it out (unless
 * `byHand` is false); null for a place that is not a settlement. A hand layout that no longer fits is
 * applied as far as it does.
 */
export function worldTown(
  game: GameWorld,
  settlementId: string,
  present?: WorldPresent,
  { byHand = true }: { byHand?: boolean } = {},
): WorldTown | null {
  const stored = byHand ? game.frozen?.towns[settlementId] : undefined;
  const town = stored
    ? { ...structuredClone(stored), people: townPeople(game, settlementId) }
    : byHand
      ? worldTownBase(game, settlementId)
      : (layOutTown(game, settlementId, undefined)?.town ?? null);
  if (!town) return null;
  addStoryPlaces(
    town,
    (present?.places ?? []).filter((place) => place.parentId === settlementId),
  );
  return town;
}

/** A settlement's town as the world and its edits lay it out, with none of the story's places: what a
 *  world's snapshot keeps (W11). Null for a place that is not a settlement. */
export function worldTownBase(game: GameWorld, settlementId: string): WorldTown | null {
  const entry = game.edits?.towns?.find((each) => each.settlement === settlementId);
  return layOutTown(game, settlementId, entry)?.town ?? null;
}

/** Everyone in a settlement's town: its people and those of the places inside it, the people added by
 *  hand after everyone drawn, so nobody already in town moves house. */
function townPeople(game: GameWorld, settlementId: string): WorldPerson[] {
  // A site's people (out in a cave or a ruin) are not the town's.
  const within = game.world.places.filter((place) => place.parentId === settlementId && !worldIsSite(game, place.id));
  const cast = [settlementId, ...within.map((place) => place.id)].flatMap((id) => worldCast(game, id));
  return [
    ...cast.filter((person) => !worldPersonByHand(person.id)),
    ...cast.filter((person) => worldPersonByHand(person.id)),
  ];
}

/** The places the story added in a town, each on the next free lot, nearest the crossroads first, or
 *  else in the home furthest out that nobody named lives in. */
function addStoryPlaces(town: WorldTown, places: ReadonlyArray<{ id: string; name: string }>): void {
  const overlaps = (a: WorldTownLot, b: WorldTownLot) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const free = (lot: WorldTownLot) => {
    for (let yy = lot.y; yy < lot.y + lot.h; yy++)
      for (let xx = lot.x; xx < lot.x + lot.w; xx++) if (town.ground[yy * town.width + xx] !== ".") return false;
    // Its door opens on a street or the square, never on ground painted since (a tree, a well).
    if (!/[sq]/.test(town.ground[lot.door.y * town.width + lot.door.x] ?? "")) return false;
    return !town.buildings.some((building) => overlaps(building, lot));
  };
  // A walk from the square must still reach its door, and every door it reached before (a town laid out by
  // hand can wall a lot off with water or hedges, or route a path over a free lot's open ground).
  const doorsReached = (reach: Set<number>) =>
    town.buildings.filter((building) => reach.has(building.door.y * town.width + building.door.x)).length;
  const reachable = (lot: WorldTownLot, before: Set<number>, doorsBefore: number) => {
    if (!before.has(lot.door.y * town.width + lot.door.x)) return false;
    const after = worldTownReach({ ...town, buildings: [...town.buildings, { ...lot } as WorldTownBuilding] });
    return after.has(lot.door.y * town.width + lot.door.x) && doorsReached(after) >= doorsBefore;
  };
  for (const place of places) {
    const before = worldTownReach(town);
    const doorsBefore = doorsReached(before);
    const lot = town.lots.find((each) => free(each) && reachable(each, before, doorsBefore));
    let building: WorldTownBuilding | undefined;
    if (lot) {
      building = {
        id: place.id,
        kind: "place",
        ...lot,
        door: { ...lot.door },
        people: [],
        placeId: place.id,
        name: place.name,
      };
      town.buildings.push(building);
    } else {
      const empty = [...town.buildings].reverse().find((each) => each.kind === "home" && each.people.length === 0);
      if (!empty) break;
      building = Object.assign(empty, { id: place.id, kind: "place" as const, placeId: place.id, name: place.name });
    }
    // A place the story added has only its name to say what it is furnished as.
    const use = worldNamedPlaceUse(place.name);
    if (use) building.use = use;
    else delete building.use;
    for (const person of town.people) if (person.placeId === place.id) building.people.push(person.id);
  }
}

/**
 * Why towns laid out by hand do not fit, or nothing: each against its town as the world with these edits
 * lays it out (the story's places aside); with them, rooms furnished or drawn by hand and maps of places.
 * The edits are a world's whole layer, as a world editor saves it.
 */
export function worldTownEditIssues(game: GameWorld, edits: WorldEdits): string[] {
  // The world these edits make, from its recipe: never a snapshot's people or towns (W11), which are
  // the edits before these.
  const { frozen: _frozen, compiled: _compiled, ...recipe } = game;
  const next: GameWorld = { ...recipe, edits, world: compileGameWorld({ ...recipe, edits }) };
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const entry of edits.towns ?? []) {
    const settlement = next.world.places.find((place) => place.id === entry.settlement);
    if (seen.has(entry.settlement)) issues.push(`The town of "${entry.settlement}" is laid out twice.`);
    seen.add(entry.settlement);
    const laidOut = settlement?.rank === undefined ? null : layOutTown(next, entry.settlement, entry);
    if (!laidOut) {
      issues.push(`No settlement "${entry.settlement}" to lay out.`);
      continue;
    }
    for (const issue of laidOut.issues) issues.push(`${settlement!.name}: ${issue}`);
  }
  // Buildings furnished by hand (W13b), against their rooms in the towns these edits lay out (each town
  // laid out once).
  if (edits.interiors?.length) {
    const towns = new Map<string, WorldTown | null>();
    const townOf = (settlementId: string) => {
      if (!towns.has(settlementId)) towns.set(settlementId, worldTownBase(next, settlementId));
      return towns.get(settlementId)!;
    };
    issues.push(...worldInteriorEditIssues(next, edits, townOf));
  }
  // Maps made by hand for places (map editor Phase 3).
  if (edits.maps?.length) issues.push(...worldMapEditIssues(next, edits));
  // Sites locked or opened by hand.
  if (edits.sites?.length) issues.push(...worldSiteEditIssues(next, edits));
  // Level bands set by hand for settlements' land (region spawns).
  if (edits.bands?.length) issues.push(...worldBandEditIssues(next, edits));
  return [...new Set(issues)].slice(0, 20);
}

function layOutTown(
  game: GameWorld,
  settlementId: string,
  entry: WorldTownEdit | undefined,
): { town: WorldTown; issues: string[] } | null {
  const { world } = game;
  const settlement = world.places.find((place) => place.id === settlementId);
  if (!settlement || settlement.rank === undefined) return null;
  const tier = worldTownTier(game, settlement);
  const [width, height] = SIZES[tier]!;
  const random = worldStream(game.seed, "town", settlementId);
  const cells = Array.from({ length: width * height }, () => ".");
  const at = (x: number, y: number) => cells[y * width + x];
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = c;
  };

  // ── Streets and the square ──
  const cx = Math.floor(width / 2) + Math.floor(random() * 3) - 1;
  const cy = Math.floor(height / 2) + Math.floor(random() * 3) - 1;
  const across = [cy, ...(tier >= 2 ? [cy - 9, cy + 9] : [])].filter((y) => y > 2 && y < height - 3);
  const down = [cx, ...(tier >= 2 ? [cx - 12, cx + 12] : [])].filter((x) => x > 2 && x < width - 3);
  for (const y of across) for (let x = 0; x < width; x++) set(x, y, "s");
  for (const x of down) for (let y = 0; y < height; y++) set(x, y, "s");
  const [sw, sh] = SQUARES[tier]!;
  const square = { x: cx - Math.floor(sw / 2), y: cy - Math.floor(sh / 2), w: sw, h: sh };
  for (let y = square.y; y < square.y + sh; y++) for (let x = square.x; x < square.x + sw; x++) set(x, y, "q");

  // ── Lots facing the streets, nearest the crossroads first ──
  const taken = new Set<number>();
  const free = (x: number, y: number, w: number, h: number) => {
    if (x < 1 || y < 1 || x + w > width - 1 || y + h > height - 1) return false;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) if (at(xx, yy) !== "." || taken.has(yy * width + xx)) return false;
    return true;
  };
  type Lot = { x: number; y: number; w: number; h: number; door: { x: number; y: number } };
  const lots: Lot[] = [];
  for (const y of across) {
    for (let x = 1; x < width - LOT_ACROSS.w; x += LOT_ACROSS.w + 1) {
      // North of the street (door below it) and south of it (door above it).
      lots.push({ x, y: y - LOT_ACROSS.h, ...LOT_ACROSS, door: { x: x + 1, y } });
      lots.push({ x, y: y + 1, ...LOT_ACROSS, door: { x: x + 1, y } });
    }
  }
  for (const x of down) {
    for (let y = 1; y < height - LOT_DOWN.h; y += LOT_DOWN.h + 1) {
      lots.push({ x: x - LOT_DOWN.w, y, ...LOT_DOWN, door: { x, y: y + 2 } });
      lots.push({ x: x + 1, y, ...LOT_DOWN, door: { x, y: y + 2 } });
    }
  }
  const distance = (lot: Lot) => Math.abs(lot.door.x - cx) + Math.abs(lot.door.y - cy) + random() * 0.5;
  const ordered = lots.map((lot) => ({ lot, d: distance(lot) })).sort((a, b) => a.d - b.d);
  const claim = (): Lot | undefined => {
    for (const { lot } of ordered) {
      if (!free(lot.x, lot.y, lot.w, lot.h)) continue;
      for (let yy = lot.y; yy < lot.y + lot.h; yy++)
        for (let xx = lot.x; xx < lot.x + lot.w; xx++) taken.add(yy * width + xx);
      return lot;
    }
    return undefined;
  };

  // ── Who is in town ──
  // A site a few steps out of town (a cave, a ruin) is out on the overworld, never a building here.
  const within = world.places.filter((place) => place.parentId === settlementId && !worldIsSite(game, place.id));
  const inside = within.filter((place) => !place.byHand);
  // Places added by hand (W9c) go last, so the town never moves; the story's go after them, on top.
  const added = within.filter((place) => place.byHand);
  const people = townPeople(game, settlementId);
  const buildings: WorldTownBuilding[] = [];
  const homeOf: Record<string, string> = {};
  const workOf: Record<string, string> = {};
  // Ids say what a building is, so they hold as the story goes on: a place's own id, the hall, the n-th
  // workplace, the n-th home.
  const counts = { work: 0, home: 0 };
  const build = (kind: WorldTownKind, extra: Partial<WorldTownBuilding>): WorldTownBuilding | undefined => {
    const lot = claim();
    if (!lot) return undefined;
    const id =
      extra.placeId ?? (kind === "landmark" ? "hall" : kind === "work" ? `w${counts.work++}` : `h${counts.home++}`);
    const building: WorldTownBuilding = { id, kind, ...lot, people: [], ...extra };
    buildings.push(building);
    return building;
  };

  // The places in town first: the world's own (the story's and those added by hand come last, below).
  // Their people work there.
  for (const place of inside) {
    const building = build("place", { placeId: place.id, name: place.name });
    if (!building) break;
    for (const person of people) {
      if (person.placeId !== place.id) continue;
      building.people.push(person.id);
      workOf[person.id] = building.id;
    }
  }
  // The people of a place added by hand work there; its building comes last, below.
  for (const person of people) {
    if (within.some((place) => place.byHand && place.id === person.placeId)) workOf[person.id] = person.placeId;
  }
  // The landmark of a bigger place: where its keepers sit. Members of a group seated here work there.
  if (tier >= 2) {
    const landmark = build("landmark", {});
    if (landmark) {
      for (const person of people) {
        if (!person.group || workOf[person.id]) continue;
        landmark.people.push(person.id);
        workOf[person.id] = landmark.id;
      }
    }
  }
  // Workplaces for the trades the place is known for.
  const roles = game.kit.people?.roles ?? WORLD_PEOPLE_DEFAULTS.roles;
  const wanted = new Set(settlement.tags);
  for (const role of roles) {
    if (!role.tags?.some((tag) => wanted.has(tag))) continue;
    const workers = people.filter((person) => person.role === role.label && !workOf[person.id]);
    if (workers.length === 0) continue;
    const work = build("work", { role: role.label });
    if (!work) break;
    for (const person of workers) {
      work.people.push(person.id);
      workOf[person.id] = work.id;
    }
  }
  // Homes, a few to each, until the lots run out; then the rest share the homes there are.
  const homes: WorldTownBuilding[] = [];
  for (let start = 0; start < people.length; start += PER_HOME) {
    const home = build("home", {});
    if (!home) break;
    homes.push(home);
  }
  people.forEach((person, index) => {
    const home = homes[homes.length ? Math.floor(index / PER_HOME) % homes.length : 0];
    if (!home) return;
    home.people.push(person.id);
    homeOf[person.id] = home.id;
  });
  // The townsfolk the story never names: more of the free lots, the bigger the place.
  const open = ordered.filter(({ lot }) => free(lot.x, lot.y, lot.w, lot.h)).length;
  for (let left = Math.round(open * FILL[tier]!); left > 0; left--) if (!build("home", {})) break;
  // The places the story added, last, so the town as the world laid it out never moves: each takes the
  // next free lot, or else the home furthest out that nobody named lives in. That home keeps its id, so a
  // party saved standing there is still somewhere in town.
  for (const place of added) {
    let building = build("place", { placeId: place.id, name: place.name });
    if (!building) {
      const empty = [...buildings].reverse().find((each) => each.kind === "home" && each.people.length === 0);
      if (!empty) break;
      building = Object.assign(empty, { kind: "place" as const, placeId: place.id, name: place.name });
    }
    // Its people work in it, by the building's own id (an empty home it took keeps that home's).
    for (const person of people) {
      if (person.placeId !== place.id) continue;
      building.people.push(person.id);
      workOf[person.id] = building.id;
    }
  }
  // What each building is furnished as, once (W13): the schedule and the rooms both read it.
  for (const building of buildings) {
    const place = building.placeId ? world.places.find((each) => each.id === building.placeId) : undefined;
    if (worldBuildingHasRooms(game, building)) building.use = worldInteriorUse(building, place?.tags);
  }
  // Someone whose workplace found no lot is in the square by day.
  for (const [personId, at] of Object.entries(workOf)) {
    if (!buildings.some((building) => building.id === at)) delete workOf[personId];
  }
  // Stalls along the square's edges, for a place known for trade.
  const stalls: WorldTown["stalls"] = [];
  if (settlement.tags.some((tag) => TRADE.test(tag))) {
    for (let x = square.x; x < square.x + square.w; x += 2) {
      stalls.push({ x, y: square.y });
      if (square.h > 2) stalls.push({ x, y: square.y + square.h - 1 });
    }
  }

  // Every lot a building could stand on: in the town and clear of its streets and square.
  const standable = ordered
    .map(({ lot }) => lot)
    .filter((lot) => {
      if (lot.x < 1 || lot.y < 1 || lot.x + lot.w > width - 1 || lot.y + lot.h > height - 1) return false;
      for (let yy = lot.y; yy < lot.y + lot.h; yy++)
        for (let xx = lot.x; xx < lot.x + lot.w; xx++) if (at(xx, yy) !== ".") return false;
      return true;
    });
  const deco: NonNullable<WorldTown["deco"]> = [];
  const issues = entry ? layOutByHand(entry, buildings, standable, cells, width, [square, ...stalls], deco) : [];

  return {
    town: {
      settlementId,
      width,
      height,
      ground: cells.join(""),
      square,
      buildings,
      homeOf,
      workOf,
      people,
      stalls,
      lots: standable.map(({ x, y, w, h, door }) => ({ x, y, w, h, door: { ...door } })),
      ...(deco.length ? { deco } : {}),
    },
    issues,
  };
}

/**
 * A town's hand layout applied to it as laid out: each move in turn (a building to a free lot, or the
 * two swapped when another stands on it; a building may move again later), then the buildings placed
 * anywhere free (map editor Phase 2; a placed building's move is dropped), then the painted ground, sparing
 * every building and the cell before its door (which may be paved: street, square or path), the middle of
 * the square (its well, where walks to it end) and the market's stalls, then the decorations. What does not
 * fit is skipped, and said. A layout using Phase 2's placements, ground kinds or decorations must also leave
 * every door reachable from the square. Places count from 1.
 */
function layOutByHand(
  entry: WorldTownEdit,
  buildings: WorldTownBuilding[],
  lots: WorldTownLot[],
  cells: string[],
  width: number,
  [square, ...stalls]: [WorldTown["square"], ...WorldTown["stalls"]],
  deco: NonNullable<WorldTown["deco"]>,
): string[] {
  const issues: string[] = [];
  const height = cells.length / width;
  const overlaps = (a: WorldTownLot, b: WorldTownLot) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const where = (x: number, y: number) => `column ${x + 1}, row ${y + 1}`;
  const nameOf = (building: WorldTownBuilding) => building.name ?? building.id;
  const placed = new Set((entry.place ?? []).map((each) => each.building));
  for (const move of entry.moves ?? []) {
    if (placed.has(move.building)) continue;
    const building = buildings.find((each) => each.id === move.building);
    if (!building) {
      issues.push(`no building "${move.building}" in town.`);
      continue;
    }
    const lot = lots.find((each) => each.x === move.x && each.y === move.y && each.w === move.w);
    if (!lot) {
      issues.push(`no lot ${move.w} wide at ${where(move.x, move.y)}.`);
      continue;
    }
    const there = buildings.find((each) => each !== building && overlaps(each, lot));
    if (there && !(there.x === lot.x && there.y === lot.y && there.w === lot.w && there.h === lot.h)) {
      issues.push(`the lot at ${where(lot.x, lot.y)} is partly under "${nameOf(there)}".`);
      continue;
    }
    const from = { x: building.x, y: building.y, w: building.w, h: building.h, door: { ...building.door } };
    Object.assign(building, { x: lot.x, y: lot.y, w: lot.w, h: lot.h, door: { ...lot.door } });
    if (there) Object.assign(there, from);
  }
  // ── Buildings placed anywhere free (Phase 2) ──
  const middle = { x: square.x + Math.floor(square.w / 2), y: square.y + Math.floor(square.h / 2) };
  const isStall = (x: number, y: number) => stalls.some((stall) => stall.x === x && stall.y === y);
  const seenPlace = new Set<string>();
  for (const spot of entry.place ?? []) {
    const building = buildings.find((each) => each.id === spot.building);
    if (!building) {
      issues.push(`no building "${spot.building}" in town (the town has changed since it was placed).`);
      continue;
    }
    if (seenPlace.has(building.id)) {
      issues.push(`"${nameOf(building)}" is placed twice.`);
      continue;
    }
    seenPlace.add(building.id);
    const [w, h] = [building.w, building.h];
    const at = { x: spot.x, y: spot.y, w, h, door: worldTownDoorCell(spot.x, spot.y, w, h, spot.door ?? "s") };
    // A building stands a cell in from the town's edge, on open ground, clear of the square's middle, the
    // stalls, other buildings and every door; its own door opens inside the town, under no building.
    let problem = "";
    if (at.x < 1 || at.y < 1 || at.x + w > width - 1 || at.y + h > height - 1) problem = "it reaches the town's edge";
    for (let yy = at.y; !problem && yy < at.y + h; yy++)
      for (let xx = at.x; !problem && xx < at.x + w; xx++) {
        if (cells[yy * width + xx] !== ".") problem = `it stands on the street or square at ${where(xx, yy)}`;
        else if ((xx === middle.x && yy === middle.y) || isStall(xx, yy))
          problem = `it stands on the square at ${where(xx, yy)}`;
      }
    const others = buildings.filter((each) => each !== building);
    const under = !problem && others.find((each) => overlaps(each, at));
    if (under) problem = `it overlaps "${nameOf(under)}"`;
    const blocking =
      !problem &&
      others.find(
        (each) => each.door.x >= at.x && each.door.x < at.x + w && each.door.y >= at.y && each.door.y < at.y + h,
      );
    if (blocking) problem = `it stands before the door of "${nameOf(blocking)}"`;
    const doorUnder = !problem && others.find((each) => overlaps(each, { ...at.door, w: 1, h: 1, door: at.door }));
    if (doorUnder) problem = `its door opens into "${nameOf(doorUnder)}"`;
    if (problem) {
      issues.push(`"${nameOf(building)}" can't stand at ${where(spot.x, spot.y)}: ${problem}.`);
      continue;
    }
    Object.assign(building, at);
  }
  // ── The painted ground ──
  const ground = entry.ground;
  if (ground) {
    if (ground.length !== cells.length) {
      issues.push(
        `the painted ground has ${ground.length} cell${ground.length === 1 ? "" : "s"}; the town has ${cells.length}.`,
      );
      return issues;
    }
    const kept = new Set<number>();
    const doors = new Set<number>();
    for (const building of buildings) {
      for (let yy = building.y; yy < building.y + building.h; yy++)
        for (let xx = building.x; xx < building.x + building.w; xx++) kept.add(yy * width + xx);
      doors.add(building.door.y * width + building.door.x);
    }
    kept.add(middle.y * width + middle.x);
    for (const stall of stalls) kept.add(stall.y * width + stall.x);
    for (let cell = 0; cell < cells.length; cell++) {
      const painted = ground[cell]!;
      if (painted === ".") continue;
      // A door's cell may be paved (street, square or path), and nothing else.
      if (kept.has(cell) || (doors.has(cell) && !"sqp".includes(painted))) {
        if (!issues.some((issue) => issue.startsWith("a building, the street before a door")))
          issues.push(
            `a building, the street before a door, the middle of the square or a stall is painted over at ${where(cell % width, Math.floor(cell / width))}.`,
          );
        continue;
      }
      cells[cell] = painted;
    }
    // A bridge crosses water: water on both sides of it, left and right or above and below.
    const water = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x] === "~";
    for (let cell = 0; cell < cells.length; cell++) {
      if (cells[cell] !== "b") continue;
      const [x, y] = [cell % width, Math.floor(cell / width)];
      if (!((water(x - 1, y) && water(x + 1, y)) || (water(x, y - 1) && water(x, y + 1))))
        issues.push(`the bridge at ${where(x, y)} crosses no water.`);
    }
  }
  // ── Decorations, drawn only ──
  const decoCells = new Set<number>();
  for (const each of entry.deco ?? []) {
    const cell = each.y * width + each.x;
    const onBuilding = buildings.some(
      (building) =>
        (each.x >= building.x &&
          each.x < building.x + building.w &&
          each.y >= building.y &&
          each.y < building.y + building.h) ||
        (building.door.x === each.x && building.door.y === each.y),
    );
    if (each.x >= width || each.y >= height)
      issues.push(`a decoration at ${where(each.x, each.y)} is outside the town.`);
    else if (onBuilding) issues.push(`a decoration at ${where(each.x, each.y)} is on a building or before its door.`);
    else if (each.x === middle.x && each.y === middle.y) issues.push(`a decoration is on the middle of the square.`);
    else if (isStall(each.x, each.y)) issues.push(`a decoration at ${where(each.x, each.y)} is on a market stall.`);
    else if (decoCells.has(cell)) issues.push(`two decorations share ${where(each.x, each.y)}.`);
    else {
      decoCells.add(cell);
      deco.push({ tile: each.tile, x: each.x, y: each.y });
    }
  }
  // ── Every door reachable from the square (Phase 2 layouts) ──
  const free = entry.place?.length || entry.deco?.length || /[fp~bh]/.test(entry.ground ?? "");
  if (free) {
    const reached = worldTownReach({ width, height, ground: cells.join(""), buildings, stalls, square });
    for (const building of buildings)
      if (!reached.has(building.door.y * width + building.door.x))
        issues.push(`the door of "${nameOf(building)}" can't be reached from the square.`);
  }
  return issues;
}

/** The cell before a building's door, for a door on its south side (under its second column, as on the
 *  laid-out lots) or on its west or east side (beside its second row from the bottom). */
export function worldTownDoorCell(
  x: number,
  y: number,
  w: number,
  h: number,
  side: (typeof WORLD_TOWN_DOOR_SIDES)[number],
): { x: number; y: number } {
  if (side === "w") return { x: x - 1, y: y + h - 2 };
  if (side === "e") return { x: x + w, y: y + h - 2 };
  return { x: x + Math.min(1, w - 1), y: y + h };
}

/** The cells a walk reaches from the middle of the square, four ways, over walkable ground (WORLD_TOWN_WALKABLE:
 *  open ground, street, square, kept clear, field, path, bridge), never through a building or a stall; each
 *  door's cell counts as reached when a walk gets to it. */
export function worldTownReach(
  town: Pick<WorldTown, "width" | "height" | "ground" | "buildings" | "stalls" | "square">,
): Set<number> {
  const { width, height } = town;
  const blocked = new Set<number>();
  for (const building of town.buildings)
    for (let y = building.y; y < building.y + building.h; y++)
      for (let x = building.x; x < building.x + building.w; x++) blocked.add(y * width + x);
  for (const stall of town.stalls) blocked.add(stall.y * width + stall.x);
  const start = (town.square.y + Math.floor(town.square.h / 2)) * width + town.square.x + Math.floor(town.square.w / 2);
  const reached = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift()!;
    const [x, y] = [cell % width, Math.floor(cell / width)];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (reached.has(next) || blocked.has(next) || !WORLD_TOWN_WALKABLE.includes(town.ground[next]!)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

/** A town's taverns, worked out once a town (the schedule asks for every person, every hour). */
const usesOfTown = new WeakMap<WorldTown, { taverns: Set<string>; firstTavern: string | null }>();
function townUses(town: WorldTown) {
  let found = usesOfTown.get(town);
  if (!found) {
    // A building's own use. A town from a snapshot made before W13 has none at all, so its trades and
    // names say; in a W13 town a building with none is a part of town, never a tavern.
    const legacy = !town.buildings.some((building) => building.use !== undefined);
    const taverns = town.buildings
      .filter(
        (building) => building.kind !== "home" && (legacy ? worldInteriorUse(building) : building.use) === "tavern",
      )
      .map((building) => building.id);
    found = { taverns: new Set(taverns), firstTavern: taverns[0] ?? null };
    usesOfTown.set(town, found);
  }
  return found;
}

/** Where a person is at an hour: at work by day (07-18); at dusk (18-21) in the square, at a tavern or
 *  home, a third of the town each (by who they are, so the same person each evening); home at night.
 *  Someone with no workplace spends the day in the square. A tavern's people keep it from 11 until
 *  midnight. A building id, or "square". (W13: before, everyone was in the square at dusk.) */
export function worldTownWhere(town: WorldTown, personId: string, hour: number): string {
  const { taverns, firstTavern } = townUses(town);
  const workId = town.workOf[personId];
  if (workId && taverns.has(workId)) return hour >= 11 ? workId : (town.homeOf[personId] ?? "square");
  if (hour >= 7 && hour < 18) return workId ?? "square";
  if (hour >= 18 && hour < 21) {
    const third = [...personId].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 3;
    if (third === 1 && firstTavern) return firstTavern;
    if (third === 2 && town.homeOf[personId]) return town.homeOf[personId]!;
    return "square";
  }
  return town.homeOf[personId] ?? "square";
}

// ── A visit in town, told on the next turn ──

/** Town cells walked in a game minute. */
export const WORLD_TOWN_CELLS_PER_MINUTE = 4;

/** The most walked cells a walk keeps for the story's step events: the latest, when a turn walks more. */
export const WORLD_WALK_STEPS_MAX = 2000;

export const worldTownVisitSchema = z
  .object({
    id: z.string().min(1).max(64),
    settlementId: z.string().min(1).max(16),
    /** A building's id, or "square". */
    to: z.string().min(1).max(16),
    minutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60),
    /** Every cell the walks walked, the last included, for the story's step events (map events). */
    steps: z
      .array(z.object({ x: z.number().int().min(0).max(255), y: z.number().int().min(0).max(255) }).strict())
      .max(WORLD_WALK_STEPS_MAX)
      .optional(),
  })
  .strict();
export type WorldTownVisit = z.infer<typeof worldTownVisitSchema>;

/** Where in town the party stands: a building's id or "square", in one settlement. */
export const worldTownSpotSchema = z
  .object({ settlementId: z.string().min(1).max(16), at: z.string().min(1).max(16) })
  .strict();
export type WorldTownSpot = z.infer<typeof worldTownSpotSchema>;

export function worldTownVisitFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): WorldTownVisit | null {
  const parsed = worldTownVisitSchema.safeParse(metadata?.gameTownVisit);
  return parsed.success ? parsed.data : null;
}
export function worldTownSpotFromMetadata(metadata: Record<string, unknown> | null | undefined): WorldTownSpot | null {
  const parsed = worldTownSpotSchema.safeParse(metadata?.gameTownSpot);
  return parsed.success ? parsed.data : null;
}

/** The street cell a spot is entered from: a building's door, or the middle of the square. */
export function worldTownDoor(town: WorldTown, at: string): { x: number; y: number } | null {
  if (at === "square") {
    return { x: town.square.x + Math.floor(town.square.w / 2), y: town.square.y + Math.floor(town.square.h / 2) };
  }
  return town.buildings.find((building) => building.id === at)?.door ?? null;
}

/** Ground a walk across town takes first: streets, the square, ground kept clear, and (map editor
 *  Phase 2) paths and bridges. */
const TOWN_WALK_FIRST = new Set(["s", "q", "o", "p", "b"]);
/** Ground walked only when there is no way on the first: the rest of what the hand layout's checks call
 *  walkable (`WORLD_TOWN_WALKABLE`: open ground and fields too). Trees, wells, water, hedges and anything
 *  unknown block. */
const TOWN_WALK_ANY = new Set(WORLD_TOWN_WALKABLE);

/** The cells a building stands on, which no walk crosses. (A stall is walked past: one can stand on
 *  the mouth of a street leaving the square.) */
const standingOfTown = new WeakMap<WorldTown, Set<number>>();
function townStanding(town: WorldTown): Set<number> {
  let found = standingOfTown.get(town);
  if (!found) {
    found = new Set<number>();
    for (const building of town.buildings)
      for (let y = building.y; y < building.y + building.h; y++)
        for (let x = building.x; x < building.x + building.w; x++) found.add(y * town.width + x);
    standingOfTown.set(town, found);
  }
  return found;
}

function townPathOn(
  town: WorldTown,
  start: { x: number; y: number },
  goal: { x: number; y: number },
  walkable: (ground: string) => boolean,
): Array<{ x: number; y: number }> | null {
  const { width, height } = town;
  const standing = townStanding(town);
  const [from, to] = [start.y * width + start.x, goal.y * width + goal.x];
  // The two ends are walked whatever is painted there: a door, the square's middle.
  const open = (cell: number) => cell === to || (!standing.has(cell) && walkable(town.ground[cell] ?? ""));
  const prev = new Map<number, number>([[from, from]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    if (cell === to) break;
    const [x, y] = [cell % width, Math.floor(cell / width)];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (prev.has(next) || !open(next)) continue;
      prev.set(next, cell);
      queue.push(next);
    }
  }
  if (!prev.has(to)) return null;
  const path: Array<{ x: number; y: number }> = [];
  for (let cell = to; cell !== from; cell = prev.get(cell)!)
    path.unshift({ x: cell % width, y: Math.floor(cell / width) });
  return path;
}

/** The way a walk across town takes, from one spot's door to another's, as the cells after the start
 *  (map editor Phase 2): the shortest four-way way on streets, the square and paths, else across open
 *  ground too, never through a building, a tree, a well, water or a hedge. With no way at all (a
 *  hand layout boxed a door in) the old way: along the street the party is on, then the one it turns
 *  into. Null for a spot not in the town; empty when the two are the same. */
export function worldTownPath(town: WorldTown, from: string, to: string): Array<{ x: number; y: number }> | null {
  const [a, b] = [worldTownDoor(town, from), worldTownDoor(town, to)];
  if (!a || !b) return null;
  if (a.x === b.x && a.y === b.y) return [];
  const found =
    townPathOn(town, a, b, (ground) => TOWN_WALK_FIRST.has(ground)) ??
    townPathOn(town, a, b, (ground) => TOWN_WALK_ANY.has(ground));
  if (found) return found;
  const path: Array<{ x: number; y: number }> = [];
  for (let x = a.x; x !== b.x;) path.push({ x: (x += Math.sign(b.x - a.x)), y: a.y });
  for (let y = a.y; y !== b.y;) path.push({ x: b.x, y: (y += Math.sign(b.y - a.y)) });
  return path;
}

/** The minutes a walk across town takes, from one spot to another (at least one): its way's cells. */
export function worldTownMinutes(town: WorldTown, from: string, to: string): number {
  const path = worldTownPath(town, from, to);
  if (!path) return 1;
  return Math.max(1, Math.round(path.length / WORLD_TOWN_CELLS_PER_MINUTE));
}

/** The people at a spot at an hour. */
export function worldTownPeopleAt(town: WorldTown, at: string, hour: number): WorldPerson[] {
  return town.people.filter((person) => worldTownWhere(town, person.id, hour) === at);
}

/** What the Game Master is told of a spot in words: a named place, a trade's workplace, the seat of
 *  the place's keepers, a home (and whose), or the square. */
function spotWords(town: WorldTown, at: string): string {
  if (at === "square") return "the square";
  const building = town.buildings.find((each) => each.id === at);
  if (!building) return "the square";
  if (building.name) return building.name;
  if (building.kind === "landmark") return "the hall where the place's keepers sit";
  if (building.kind === "work") return `the ${building.role ?? "workshop"}'s workplace`;
  const residents = building.people
    .map((id) => town.people.find((person) => person.id === id))
    .filter((person): person is WorldPerson => Boolean(person?.named));
  return residents.length ? `the home of ${residents.map((person) => person.name).join(" and ")}` : "a home";
}

/** What the Game Master is told of the visit its turn tells, with what is inside (W13, in words, from
 *  `worldInteriorWords`) and who is there at the hour. */
export function worldTownVisitText(
  game: GameWorld,
  town: WorldTown,
  visit: WorldTownVisit,
  hour: number,
  inside?: string,
): string {
  const settlement = game.world.places.find((place) => place.id === town.settlementId);
  const there = worldTownPeopleAt(town, visit.to, hour)
    .filter((person) => person.named)
    .slice(0, 6)
    .map((person) => `${person.name} (${person.role})`);
  return `In ${settlement?.name ?? "town"}, the party has walked to ${spotWords(town, visit.to)}.${
    inside ? ` ${inside}` : ""
  }${there.length ? ` There now: ${there.join(", ")}.` : ""} That time is counted already: tell what the party finds there.`;
}

/** The place tag a visit to a named place carries, so the place in force is that place. */
export function worldTownVisitTags(town: WorldTown, visit: WorldTownVisit): string {
  const building = town.buildings.find((each) => each.id === visit.to);
  return building?.placeId && building.name ? `[place: name="${building.name}"]` : "";
}
