// Building plans for dungeon sites (owner 2026-11-14, "Dungeon building plans: design"): a site is planned
// once as a whole building, its levels, their zones and their rooms each with a purpose, from what the
// place is, how rich its builder was, the land it stands on and what history did to it. Each level is then
// laid out as its own map from the plan: one footprint shared by every level, its stairs at the same cells
// on every level they join, rooms off a hall, so a mansion has a cellar, a ground floor with its hall and
// kitchen, an upper floor of bedrooms and a guest wing, and an attic. Pure and seeded: the same input
// always gives the same building.

import { marinaraRandom } from "../marinara-classes.js";
import {
  DUNGEON_EXIT_PROP,
  gameDungeonMapFromDungeon,
  type DungeonGround,
  type DungeonMap,
  type DungeonRoom,
  type GameDungeonMap,
} from "./dungeon-map.js";

/** The kinds of place built to a plan. Caves, mines, sewers, ruins and stations keep their carved maps. */
export const SITE_TEMPLATE_IDS = ["manor", "keep", "temple", "crypt"] as const;
export type SiteTemplateId = (typeof SITE_TEMPLATE_IDS)[number];

/** What a room is for, as the spawns read it: the heart (the leader's room), the holders' own rooms,
 *  their posts at the chokepoints, rooms left to squatters, quiet rooms, stores, and open ground. */
export const SITE_ROOM_USES = ["heart", "holders", "post", "squat", "quiet", "store", "open"] as const;
export type SiteRoomUse = (typeof SITE_ROOM_USES)[number];

/** How a site stands on its land (from the world cell it is on). */
export const SITE_TERRAINS = ["hill", "coast", "wet", "city"] as const;
export type SiteTerrain = (typeof SITE_TERRAINS)[number];

/** The fates history can leave on a site (as dungeon spawns read them). */
export type SiteFate = "war" | "sickness" | "famine" | "flood";

/** Ways between levels: the main stair, the servants' stair, a ladder, a hidden stair, a collapsed floor. */
export const SITE_LINK_KINDS = ["stairs", "servants", "ladder", "hidden", "hole"] as const;
export type SiteLinkKind = (typeof SITE_LINK_KINDS)[number];

/** Prop slots every building set shares (dungeon_crypt's own slots agree: 4 a trap, 6 a portcullis). */
export const SITE_LOCK_PROP = 6;
export const SITE_RUBBLE_PROP = 7;

interface RoomSpec {
  name: string;
  use: SiteRoomUse;
  /** 1 small, 2 medium, 3 large: its share of the band it stands in. */
  size: 1 | 2 | 3;
  /** Public rooms stand near the way in, private ones at the far end. */
  zone: "public" | "service" | "private" | "guest" | "deep";
  /** The least wealth (1-3) a builder needs for it. */
  wealth?: 2 | 3;
  /** The odds it is there at all (1 when omitted). */
  chance?: number;
  /** Its door is locked, its key somewhere else on the level. */
  locked?: true;
  /** It is the heart, when the plan puts it here. */
  heart?: true;
  /** Prop slots its furniture is drawn from, against its walls. */
  furniture: readonly number[];
  /** How many of it (1 when omitted): at least, at most. */
  count?: readonly [number, number];
}

interface LevelSpec {
  id: string;
  name: string;
  /** 0 is the level the way in is on; up is positive. */
  depth: number;
  rooms: readonly RoomSpec[];
  wealth?: 2 | 3;
  chance?: number;
  /** Laid out narrower than the footprint (an attic under the roof). */
  inset?: true;
  /** Only when something says so (a crypt under a mansion with undead in it, a hillside's rock cellar). */
  when?: "undead" | "hill";
  /** Never on wet ground. */
  dry?: true;
}

interface TemplateSpec {
  id: SiteTemplateId;
  /** The map look its levels use, by the setting's art family. */
  set: string;
  /** Footprint (width, height) by wealth 1-3; every level shares it. */
  footprint: readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
  levels: readonly LevelSpec[];
}

// Furniture slots, by the building sets' props: 0 table, 1 bed, 2 shelves, 3 hearth, 4 chest or barrel.
// The crypt's: 0 sarcophagus, 1 skeleton, 2 torch stand, 3 chest, 7 pillar.
const T = 0,
  BED = 1,
  SHELF = 2,
  FIRE = 3,
  CHEST = 4;

const TEMPLATES: Record<SiteTemplateId, TemplateSpec> = {
  manor: {
    id: "manor",
    set: "building_manor",
    footprint: [
      [30, 19],
      [38, 23],
      [46, 27],
    ],
    levels: [
      {
        id: "attic",
        name: "Attic",
        depth: 2,
        wealth: 2,
        inset: true,
        rooms: [
          { name: "Attic store", use: "squat", size: 2, zone: "service", furniture: [CHEST], count: [1, 2] },
          { name: "Servants' garret", use: "squat", size: 1, zone: "service", furniture: [BED], count: [1, 2] },
        ],
      },
      {
        id: "upper",
        name: "Upper floor",
        depth: 1,
        rooms: [
          { name: "Gallery", use: "post", size: 2, zone: "public", furniture: [SHELF] },
          {
            name: "Master bedroom",
            use: "holders",
            size: 3,
            zone: "private",
            heart: true,
            furniture: [BED, CHEST, FIRE],
          },
          { name: "Dressing room", use: "store", size: 1, zone: "private", furniture: [CHEST] },
          { name: "Bedroom", use: "holders", size: 2, zone: "private", furniture: [BED, CHEST], count: [1, 2] },
          { name: "Guest bedroom", use: "holders", size: 2, zone: "guest", furniture: [BED], count: [1, 3] },
          { name: "Nursery", use: "squat", size: 1, zone: "private", chance: 0.5, furniture: [BED, CHEST] },
          { name: "Bathroom", use: "squat", size: 1, zone: "guest", wealth: 2, furniture: [CHEST] },
        ],
      },
      {
        id: "ground",
        name: "Ground floor",
        depth: 0,
        rooms: [
          { name: "Entrance hall", use: "post", size: 2, zone: "public", furniture: [T] },
          { name: "Great hall", use: "holders", size: 3, zone: "public", furniture: [T, FIRE] },
          { name: "Dining room", use: "holders", size: 2, zone: "public", furniture: [T, T] },
          { name: "Ballroom", use: "holders", size: 3, zone: "public", wealth: 3, furniture: [] },
          { name: "Kitchen", use: "holders", size: 2, zone: "service", furniture: [FIRE, T, CHEST] },
          { name: "Pantry", use: "store", size: 1, zone: "service", furniture: [CHEST, SHELF] },
          { name: "Servants' hall", use: "holders", size: 2, zone: "service", furniture: [T, BED] },
          { name: "Library", use: "quiet", size: 2, zone: "private", wealth: 2, furniture: [SHELF, SHELF, T] },
          { name: "Study", use: "quiet", size: 1, zone: "private", locked: true, furniture: [T, SHELF] },
          { name: "Chapel", use: "quiet", size: 1, zone: "private", chance: 0.5, furniture: [T] },
        ],
      },
      {
        id: "cellar",
        name: "Cellar",
        depth: -1,
        dry: true,
        rooms: [
          { name: "Wine cellar", use: "squat", size: 3, zone: "service", furniture: [CHEST, CHEST, SHELF] },
          { name: "Store room", use: "squat", size: 2, zone: "service", furniture: [CHEST], count: [1, 2] },
          { name: "Cold room", use: "store", size: 1, zone: "service", furniture: [SHELF] },
          { name: "Vault", use: "store", size: 1, zone: "deep", wealth: 2, locked: true, furniture: [CHEST, CHEST] },
        ],
      },
      {
        id: "rock-cellar",
        name: "Rock cellars",
        depth: -2,
        when: "hill",
        rooms: [
          { name: "Cut cellar", use: "squat", size: 2, zone: "service", furniture: [CHEST], count: [2, 3] },
          { name: "Cistern", use: "squat", size: 2, zone: "deep", furniture: [] },
        ],
      },
      {
        id: "crypt",
        name: "Family crypt",
        depth: -3,
        when: "undead",
        rooms: [
          { name: "Family crypt", use: "holders", size: 3, zone: "deep", heart: true, furniture: [CHEST, FIRE] },
          { name: "Ossuary", use: "squat", size: 2, zone: "deep", furniture: [SHELF] },
          { name: "Tomb", use: "holders", size: 1, zone: "deep", furniture: [CHEST], count: [1, 2] },
        ],
      },
    ],
  },
  keep: {
    id: "keep",
    set: "building_keep",
    footprint: [
      [28, 21],
      [34, 25],
      [40, 29],
    ],
    levels: [
      {
        id: "top",
        name: "Tower top",
        depth: 2,
        inset: true,
        rooms: [
          { name: "Watch room", use: "post", size: 2, zone: "public", furniture: [T, CHEST] },
          { name: "Signal room", use: "squat", size: 1, zone: "private", furniture: [FIRE] },
        ],
      },
      {
        id: "upper",
        name: "Keep upper floor",
        depth: 1,
        rooms: [
          { name: "Guard room", use: "post", size: 2, zone: "public", furniture: [T, SHELF] },
          {
            name: "Lord's chamber",
            use: "holders",
            size: 3,
            zone: "private",
            heart: true,
            furniture: [BED, FIRE, CHEST],
          },
          { name: "Solar", use: "holders", size: 2, zone: "private", furniture: [T, FIRE] },
          { name: "Treasury", use: "store", size: 1, zone: "private", locked: true, furniture: [CHEST, CHEST] },
          { name: "Officers' quarters", use: "holders", size: 2, zone: "guest", furniture: [BED, BED] },
        ],
      },
      {
        id: "ground",
        name: "Keep ground floor",
        depth: 0,
        rooms: [
          { name: "Gatehouse", use: "post", size: 2, zone: "public", furniture: [SHELF] },
          { name: "Great hall", use: "holders", size: 3, zone: "public", furniture: [T, T, FIRE] },
          { name: "Barracks", use: "holders", size: 3, zone: "service", furniture: [BED, BED, CHEST] },
          { name: "Armoury", use: "store", size: 1, zone: "service", locked: true, furniture: [SHELF, SHELF] },
          { name: "Kitchen", use: "holders", size: 2, zone: "service", furniture: [FIRE, T] },
          { name: "Chapel", use: "quiet", size: 1, zone: "private", chance: 0.6, furniture: [T] },
          { name: "Stables", use: "squat", size: 2, zone: "service", chance: 0.6, furniture: [CHEST] },
        ],
      },
      {
        id: "dungeons",
        name: "Dungeons",
        depth: -1,
        dry: true,
        rooms: [
          { name: "Gaoler's room", use: "post", size: 2, zone: "public", furniture: [T, CHEST] },
          { name: "Cell", use: "squat", size: 1, zone: "deep", furniture: [BED], count: [3, 5] },
          { name: "Interrogation room", use: "holders", size: 2, zone: "deep", furniture: [T, FIRE] },
          { name: "Oubliette", use: "squat", size: 1, zone: "deep", locked: true, furniture: [] },
        ],
      },
    ],
  },
  temple: {
    id: "temple",
    set: "building_temple",
    footprint: [
      [28, 19],
      [34, 23],
      [42, 27],
    ],
    levels: [
      {
        id: "bells",
        name: "Bell tower",
        depth: 1,
        inset: true,
        chance: 0.7,
        rooms: [
          { name: "Bell chamber", use: "squat", size: 2, zone: "public", furniture: [] },
          { name: "Ringers' loft", use: "squat", size: 1, zone: "private", furniture: [CHEST] },
        ],
      },
      {
        id: "ground",
        name: "Temple floor",
        depth: 0,
        rooms: [
          { name: "Narthex", use: "post", size: 2, zone: "public", furniture: [T] },
          { name: "Nave", use: "holders", size: 3, zone: "public", furniture: [T, T, T] },
          { name: "Sanctuary", use: "holders", size: 2, zone: "private", heart: true, furniture: [BED, FIRE] },
          { name: "Vestry", use: "store", size: 1, zone: "private", locked: true, furniture: [CHEST, SHELF] },
          { name: "Cloister", use: "open", size: 3, zone: "service", furniture: [] },
          { name: "Refectory", use: "holders", size: 2, zone: "service", furniture: [T, T] },
          { name: "Monks' cells", use: "holders", size: 2, zone: "guest", furniture: [BED], count: [1, 2] },
          { name: "Scriptorium", use: "quiet", size: 2, zone: "private", wealth: 2, furniture: [SHELF, T] },
        ],
      },
      {
        id: "undercroft",
        name: "Undercroft",
        depth: -1,
        dry: true,
        rooms: [
          { name: "Undercroft", use: "squat", size: 3, zone: "public", furniture: [CHEST] },
          { name: "Ossuary", use: "squat", size: 2, zone: "deep", furniture: [SHELF] },
          { name: "Reliquary", use: "store", size: 1, zone: "deep", locked: true, furniture: [CHEST] },
          { name: "Burial vault", use: "holders", size: 2, zone: "deep", furniture: [CHEST], count: [1, 2] },
        ],
      },
    ],
  },
  crypt: {
    id: "crypt",
    set: "dungeon_crypt",
    footprint: [
      [24, 17],
      [30, 19],
      [36, 23],
    ],
    levels: [
      {
        id: "chapel",
        name: "Crypt chapel",
        depth: 0,
        rooms: [
          { name: "Vestibule", use: "post", size: 2, zone: "public", furniture: [2] },
          { name: "Mortuary chapel", use: "quiet", size: 3, zone: "public", furniture: [0, 2, 7] },
          { name: "Embalming room", use: "holders", size: 2, zone: "service", furniture: [0, 3] },
          { name: "Keeper's room", use: "store", size: 1, zone: "private", furniture: [3] },
        ],
      },
      {
        id: "burials",
        name: "Upper burials",
        depth: -1,
        rooms: [
          { name: "Burial hall", use: "holders", size: 3, zone: "public", furniture: [0, 0, 7] },
          { name: "Ossuary", use: "squat", size: 2, zone: "service", furniture: [1, 1] },
          { name: "Family vault", use: "holders", size: 1, zone: "private", furniture: [0, 3], count: [2, 3] },
          { name: "Sealed vault", use: "store", size: 1, zone: "deep", locked: true, furniture: [0, 3] },
        ],
      },
      {
        id: "deep-burials",
        name: "Deep burials",
        depth: -2,
        chance: 0.6,
        rooms: [
          { name: "Catacomb", use: "squat", size: 3, zone: "public", furniture: [1, 7] },
          { name: "Bone pit", use: "squat", size: 2, zone: "service", furniture: [1] },
          { name: "Old vault", use: "holders", size: 1, zone: "private", furniture: [0], count: [2, 3] },
        ],
      },
      {
        id: "founder",
        name: "Founder's tomb",
        depth: -3,
        wealth: 2,
        rooms: [
          { name: "Hall of guardians", use: "post", size: 3, zone: "public", furniture: [7, 7, 2] },
          { name: "Founder's tomb", use: "holders", size: 3, zone: "deep", heart: true, furniture: [0, 2, 3] },
          { name: "Grave goods", use: "store", size: 1, zone: "private", locked: true, furniture: [3, 3] },
        ],
      },
    ],
  },
};

/** The map looks building plans add (fantasy and history; a science fiction building is a station). */
export const SITE_TEMPLATE_SETS: Readonly<Record<SiteTemplateId, string>> = Object.freeze(
  Object.fromEntries(SITE_TEMPLATE_IDS.map((id) => [id, TEMPLATES[id].set])) as Record<SiteTemplateId, string>,
);

/** Which template a map look is built to, or null for a carved one (caves, mines, sewers, stations). */
export function siteTemplateForSet(setId: string): SiteTemplateId | null {
  return SITE_TEMPLATE_IDS.find((id) => TEMPLATES[id].set === setId) ?? null;
}

/** What a building's spare rooms (what is left of a band) are called, by its kind. */
const SPARE_ROOM_NAMES: Record<SiteTemplateId, string> = {
  manor: "Box room",
  keep: "Empty cell",
  temple: "Side chamber",
  crypt: "Burial niche",
};

// ── The plan ──

export interface SitePlanInput {
  template: SiteTemplateId;
  seed: number;
  /** 1 a modest house, 2 a rich one, 3 a palace. */
  wealth: 1 | 2 | 3;
  fate?: SiteFate;
  terrain?: SiteTerrain;
  /** Its holders are undead: the plan grows a crypt for them (a vampire's mansion). */
  undead?: boolean;
}

export interface SitePlanRoom {
  name: string;
  use: SiteRoomUse;
  size: 1 | 2 | 3;
  zone: RoomSpec["zone"];
  furniture: readonly number[];
  locked?: true;
  heart?: true;
  /** Burnt or broken by the site's fate: rubble in it, its wall to the hall breached. */
  ruined?: true;
}

export interface SitePlanLevel {
  id: string;
  name: string;
  depth: number;
  rooms: SitePlanRoom[];
  inset?: true;
  /** Water stands in its rooms (a flood, or wet ground under a cellar). */
  flooded?: true;
}

export interface SitePlanLink {
  /** Level indexes, top to bottom order: `upper` is above `lower`. */
  upper: number;
  lower: number;
  kind: SiteLinkKind;
}

export interface SitePlan {
  template: SiteTemplateId;
  set: string;
  seed: number;
  wealth: 1 | 2 | 3;
  /** Top to bottom. */
  levels: SitePlanLevel[];
  /** The level the way in is on. */
  entry: number;
  links: SitePlanLink[];
  /** The footprint every level shares. */
  width: number;
  height: number;
}

/** The plan of a site: the same input always gives the same building. */
export function sitePlan(input: SitePlanInput): SitePlan {
  const spec = TEMPLATES[input.template];
  const random = marinaraRandom(`site:${input.template}:${input.seed}:${input.wealth}`);
  // The footprint, a little wider or narrower and deeper or shallower than the template's, by its own
  // rolls so the rooms rolled after stay put.
  const shape = marinaraRandom(`site-shape:${input.template}:${input.seed}:${input.wealth}`);
  const [baseW, baseH] = spec.footprint[input.wealth - 1]!;
  const width = baseW + Math.round((shape() - 0.5) * 8);
  const height = baseH + Math.round((shape() - 0.5) * 4);
  const levels: SitePlanLevel[] = [];
  for (const level of spec.levels) {
    if (level.wealth && input.wealth < level.wealth) continue;
    if (level.when === "undead" && !input.undead) continue;
    if (level.when === "hill" && input.terrain !== "hill") continue;
    if (level.dry && input.terrain === "wet") continue;
    // The chance is rolled even for a level that is always there, so the rolls after stay put.
    const roll = random();
    if (level.chance !== undefined && level.depth !== 0 && roll >= level.chance) continue;
    const rooms: SitePlanRoom[] = [];
    for (const room of level.rooms) {
      const roll = random();
      if (room.wealth && input.wealth < room.wealth) continue;
      if (room.chance !== undefined && roll >= room.chance) continue;
      const [least, most] = room.count ?? [1, 1];
      const count = least + Math.floor(random() * (most - least + 1)) + (input.wealth === 3 && most > 1 ? 1 : 0);
      for (let n = 0; n < Math.min(count, most + 1); n++)
        rooms.push({
          name: count > 1 ? `${room.name} ${n + 1}` : room.name,
          use: room.use,
          size: room.size,
          zone: room.zone,
          furniture: room.furniture,
          ...(room.locked ? { locked: true as const } : {}),
          ...(room.heart ? { heart: true as const } : {}),
        });
    }
    levels.push({
      id: level.id,
      name: level.name,
      depth: level.depth,
      rooms,
      ...(level.inset ? { inset: true as const } : {}),
    });
  }
  levels.sort((a, b) => b.depth - a.depth);
  // One heart: the deepest-planned one wins (a vampire's crypt over its bedroom); the others are the
  // holders' rooms.
  const hearts = levels.flatMap((level) => level.rooms.filter((room) => room.heart));
  const heart = input.undead ? hearts.at(-1) : hearts[0];
  for (const room of hearts) if (room !== heart) delete room.heart;
  // A plan whose heart room was not built (a poor crypt has no founder's tomb) still gets one: the
  // biggest holders' room of the deepest level that has one, else the biggest room on the way in's level.
  if (!heart) {
    const pick = (rooms: SitePlanRoom[]) =>
      rooms.reduce<SitePlanRoom | undefined>((best, room) => (!best || room.size > best.size ? room : best), undefined);
    const holders = [...levels]
      .reverse()
      .map((level) => pick(level.rooms.filter((room) => room.use === "holders" && !room.locked)));
    const chosen = holders.find(Boolean) ?? pick(levels.find((level) => level.depth === 0)?.rooms ?? levels[0]!.rooms);
    if (chosen) chosen.heart = true;
  }
  // Coast: a sea cave under the lowest level.
  if (input.terrain === "coast") {
    const lowest = levels.at(-1)!;
    if (lowest.depth < 0) lowest.rooms.push({ name: "Sea cave", use: "squat", size: 2, zone: "deep", furniture: [] });
  }
  // The fate pass: what history did to the building.
  if (input.fate === "war") {
    // A breached wing: the far rooms of the way in's level burnt and broken.
    const ground = levels.find((level) => level.depth === 0)!;
    for (const room of ground.rooms.filter((each) => each.zone === "private" || each.zone === "guest"))
      if (!room.heart && !room.locked) room.ruined = true;
  }
  if (input.fate === "flood" || input.terrain === "wet") {
    const lowest = levels.at(-1)!;
    if (lowest.depth < 0 || input.fate === "flood") lowest.flooded = true;
  }
  if (input.fate === "sickness")
    for (const level of levels)
      for (const room of level.rooms) if (room.use === "quiet" && !room.locked) room.locked = true;
  if (input.fate === "famine")
    for (const level of levels)
      for (const room of level.rooms) if (room.use === "store") room.furniture = room.furniture.slice(0, 1);
  const entry = levels.findIndex((level) => level.depth === 0);
  // The ways between levels: the main stair between neighbours; a servants' stair besides in a big house;
  // a ladder to an attic or a tower top; a hidden stair to a crypt; a collapsed floor after a war.
  const links: SitePlanLink[] = [];
  for (let i = 0; i + 1 < levels.length; i++) {
    const [upper, lower] = [levels[i]!, levels[i + 1]!];
    const kind: SiteLinkKind = upper.inset ? "ladder" : lower.id === "crypt" ? "hidden" : "stairs";
    links.push({ upper: i, lower: i + 1, kind });
    if (input.wealth >= 2 && !upper.inset && kind === "stairs" && random() < 0.6)
      links.push({ upper: i, lower: i + 1, kind: "servants" });
    if (input.fate === "war" && upper.depth === 1 && lower.depth === 0)
      links.push({ upper: i, lower: i + 1, kind: "hole" });
  }
  return {
    template: input.template,
    set: spec.set,
    seed: input.seed,
    wealth: input.wealth,
    levels,
    entry,
    links,
    width,
    height,
  };
}

// ── A level laid out ──

export interface SiteLevelLink {
  x: number;
  y: number;
  /** The level it leads to. */
  level: number;
  kind: SiteLinkKind;
}

export interface SiteLevelLock {
  x: number;
  y: number;
  /** The locked room (an index into the map's rooms) and the room its key is found in. */
  room: number;
  key: number;
}

export interface SiteLevelTrap {
  x: number;
  y: number;
  /** How hard it is to find and to disarm, on the ruleset's own scale (a d20 DC). */
  dc: number;
}

export interface SiteLevelMap {
  map: DungeonMap;
  /** Each room's name and use, as the map's rooms are ordered. */
  rooms: Array<{ name: string; use: SiteRoomUse; heart?: true }>;
  links: SiteLevelLink[];
  locks: SiteLevelLock[];
  traps: SiteLevelTrap[];
}

/** The rooms that are a level's great room: the biggest space on it. */
const SITE_HALL_ROOMS = new Set(["Great hall", "Nave", "Undercroft", "Burial hall"]);
/** The rooms the way in opens into. */
/** Rooms where many sleep, so their beds go in rows. */
const SITE_DORMS = new Set(["Barracks", "Servants' garret", "Servants' hall", "Monks' cells", "Officers' quarters"]);

/** Where a piece of furniture stands in its room, by its prop slot. */
function siteFurnitureRole(
  template: SiteTemplateId,
  slot: number,
): "center" | "wall" | "back" | "corner" | "scatter" | "pillar" {
  if (template === "crypt")
    return slot === 0 ? "center" : slot === 1 ? "scatter" : slot === 2 ? "wall" : slot === 7 ? "pillar" : "corner";
  return slot === 0 ? "center" : slot === 3 ? "back" : slot === 4 ? "corner" : "wall";
}

/** Rooms that belong beside one another, by name (numbered copies count as the same room). */
const SITE_NEXT_TO: Record<string, readonly string[]> = {
  Kitchen: ["Dining room", "Pantry", "Servants' hall", "Great hall"],
  "Dressing room": ["Master bedroom"],
  Bathroom: ["Master bedroom", "Bedroom", "Guest bedroom"],
  Study: ["Library"],
  Nursery: ["Bedroom", "Master bedroom"],
  Vault: ["Wine cellar"],
  "Cold room": ["Store room", "Wine cellar"],
  Solar: ["Lord's chamber"],
  Treasury: ["Lord's chamber", "Solar"],
  Armoury: ["Barracks", "Gatehouse"],
  Barracks: ["Gatehouse"],
  "Interrogation room": ["Gaoler's room"],
  Cell: ["Gaoler's room", "Cell"],
  Vestry: ["Sanctuary"],
  Sanctuary: ["Nave"],
  Refectory: ["Kitchen", "Cloister"],
  Scriptorium: ["Library"],
  "Embalming room": ["Mortuary chapel"],
  "Keeper's room": ["Vestibule"],
  "Grave goods": ["Founder's tomb"],
  Ossuary: ["Burial hall"],
  "Ringers' loft": ["Bell chamber"],
  "Signal room": ["Watch room"],
  "Monks' cells": ["Monks' cells", "Refectory"],
};
const siteBaseName = (name: string) => name.replace(/ \d+$/u, "");

const SITE_ENTRY_ROOMS = new Set(["Entrance hall", "Gatehouse", "Narthex", "Vestibule"]);
/** The open court of a building that has one, when its plan names no open room for it. */
const SITE_COURT_NAMES: Record<SiteTemplateId, string> = {
  manor: "Courtyard",
  keep: "Inner ward",
  temple: "Cloister garth",
  crypt: "Open court",
};
/** How each kind of building is cut up: how often a cut leaves a passage and how often one two wide, how
 *  many rooms beyond the plan's, how often its ground floor keeps an open court, and how often a floor
 *  loses a corner (an L or a U, not a box). */
const SITE_STYLES: Record<
  SiteTemplateId,
  { passage: number; wide: number; extra: readonly [number, number]; court: number; corner: number }
> = {
  manor: { passage: 0.5, wide: 0.5, extra: [1, 3], court: 0.25, corner: 0.5 },
  keep: { passage: 0.4, wide: 0.3, extra: [1, 3], court: 0.45, corner: 0.35 },
  temple: { passage: 0.35, wide: 0.3, extra: [0, 2], court: 0.4, corner: 0.4 },
  crypt: { passage: 0.7, wide: 0.1, extra: [2, 5], court: 0, corner: 0.5 },
};

type SiteSide = "N" | "S" | "E" | "W";
interface SiteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SiteEdge = { a: number; b: number; cells: Array<{ x: number; y: number }> };
/** Spaces that are neighbours across one wall, and the wall cells between them. */
function siteEdges(nodes: readonly SiteRect[]): SiteEdge[] {
  const edges: SiteEdge[] = [];
  for (let a = 0; a < nodes.length; a++)
    for (let b = 0; b < nodes.length; b++) {
      const [one, two] = [nodes[a]!, nodes[b]!];
      const cells: Array<{ x: number; y: number }> = [];
      if (one.x + one.w + 1 === two.x)
        for (let y = Math.max(one.y, two.y); y < Math.min(one.y + one.h, two.y + two.h); y++)
          cells.push({ x: one.x + one.w, y });
      else if (one.y + one.h + 1 === two.y)
        for (let x = Math.max(one.x, two.x); x < Math.min(one.x + one.w, two.x + two.w); x++)
          cells.push({ x, y: one.y + one.h });
      if (cells.length) edges.push({ a, b, cells });
    }
  return edges;
}

/** Cuts spaces at random until there are `target` of them: big and long thin ones first, toward the
 *  middle more often than the edges, a cut now and then leaving a passage; never a wall where `clear`
 *  says no. */
function siteCut(
  random: () => number,
  leaves: SiteRect[],
  passages: SiteRect[],
  target: number,
  style: { passage: number; wide: number },
  clear: (vertical: boolean, at: number, r: SiteRect) => boolean,
) {
  const MIN = 3;
  for (let tries = 0; leaves.length < target && tries < 400; tries++) {
    const weights = leaves.map((r) =>
      r.w >= 2 * MIN + 1 || r.h >= 2 * MIN + 1
        ? Math.pow(r.w * r.h, 1.3) * (Math.max(r.w / r.h, r.h / r.w) > 2.2 ? 6 : 1)
        : 0,
    );
    const total = weights.reduce((sum, each) => sum + each, 0);
    if (!total) break;
    let roll = random() * total;
    let pick = 0;
    while (pick < weights.length - 1 && (roll -= weights[pick]!) >= 0) pick++;
    const r = leaves[pick]!;
    const canV = r.w >= 2 * MIN + 1;
    const canH = r.h >= 2 * MIN + 1;
    const ratio = r.w / r.h;
    const vertical =
      canV && (!canH || ratio > 2 || (ratio >= 0.5 && random() < (ratio > 1.25 ? 0.85 : ratio < 0.8 ? 0.15 : 0.5)));
    const len = vertical ? r.w : r.h;
    const line = vertical ? r.h : r.w;
    const passage =
      line >= 8 && len >= 2 * MIN + 3 && random() < Math.min(0.95, style.passage * Math.min(1, (r.w * r.h) / 110));
    const pw = passage ? (len >= 2 * MIN + 5 && random() < style.wide ? 2 : 1) : 0;
    const hi = len - MIN - (pw ? pw + 2 : 1);
    if (hi < MIN) continue;
    const start = vertical ? r.x : r.y;
    let a = -1;
    for (let k = 0; k < 8 && a < 0; k++) {
      const at = MIN + Math.floor(((random() + random()) / 2) * (hi - MIN + 1));
      const walls = pw ? [start + at, start + at + pw + 1] : [start + at];
      if (walls.every((wall) => clear(vertical, wall, r))) a = at;
    }
    if (a < 0) continue;
    const gap = pw ? pw + 2 : 1;
    const [first, second] = vertical
      ? [
          { x: r.x, y: r.y, w: a, h: r.h },
          { x: r.x + a + gap, y: r.y, w: r.w - a - gap, h: r.h },
        ]
      : [
          { x: r.x, y: r.y, w: r.w, h: a },
          { x: r.x, y: r.y + a + gap, w: r.w, h: r.h - a - gap },
        ];
    leaves.splice(pick, 1, first, second);
    if (pw)
      passages.push(vertical ? { x: r.x + a + 1, y: r.y, w: pw, h: r.h } : { x: r.x, y: r.y + a + 1, w: r.w, h: pw });
  }
}

/** What every full level of a building shares, from the plan alone: its outline (a corner or two left off,
 *  an L or a U), its main walls and passages (the first cuts, standing one on another floor to floor), and
 *  where each link stands (in a passage where there is one, so the stairs rise in a stairwell). */
function siteFrame(plan: SitePlan) {
  const random = marinaraRandom(`site-frame:${plan.template}:${plan.seed}:${plan.wealth}`);
  const style = SITE_STYLES[plan.template];
  // Stone buildings stand on walls two thick; a keep's corner towers and a temple's apse stand out
  // past them, so the map leaves room round the building for them.
  const wall = plan.template === "keep" || plan.template === "temple" ? 2 : 1;
  const fx = plan.template === "keep" ? 6 : 2;
  const fy = plan.template === "keep" ? 6 : plan.template === "temple" ? 5 : 2;
  const [left, right, top, bottom] = [fx, fx + plan.width - 1, fy, fy + plan.height - 1];
  const cx = fx + Math.floor(plan.width / 2);
  const cy = fy + Math.floor(plan.height / 2);
  const leaves: SiteRect[] = [
    { x: left + wall, y: top + wall, w: right - left - 2 * wall + 1, h: bottom - top - 2 * wall + 1 },
  ];
  const passages: SiteRect[] = [];
  siteCut(
    random,
    leaves,
    passages,
    3 + plan.wealth + Math.floor(random() * 2),
    { ...style, passage: style.passage * 2 },
    () => true,
  );
  // The outline: a corner left off now and then, never cutting the rest apart. A passage that ran along
  // a corner left off is cut back to where it still has rooms beside it, so no corridor juts out alone.
  const removed = new Set<number>();
  const kept = () => {
    const keptLeaves = leaves.filter((_, n) => !removed.has(n));
    const inAny = (x: number, y: number, self: SiteRect) =>
      [...keptLeaves, ...passages].some((r) => r !== self && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const keptPassages: SiteRect[] = [];
    for (const r of passages) {
      const across = r.w >= r.h;
      const backed = (k: number) =>
        across
          ? inAny(r.x + k, r.y - 2, r) || inAny(r.x + k, r.y + r.h + 1, r)
          : inAny(r.x - 2, r.y + k, r) || inAny(r.x + r.w + 1, r.y + k, r);
      const len = across ? r.w : r.h;
      let lo = 0;
      let hi = len - 1;
      while (lo <= hi && !backed(lo)) lo++;
      while (hi >= lo && !backed(hi)) hi--;
      if (hi - lo + 1 < 2) continue;
      keptPassages.push(across ? { ...r, x: r.x + lo, w: hi - lo + 1 } : { ...r, y: r.y + lo, h: hi - lo + 1 });
    }
    return { keptLeaves, keptPassages };
  };
  const connected = () => {
    const { keptLeaves, keptPassages } = kept();
    const nodes = [...keptPassages, ...keptLeaves];
    const edges = siteEdges(nodes);
    const seen = new Set([0]);
    const queue = [0];
    for (let head = 0; head < queue.length; head++)
      for (const edge of edges) {
        const other = edge.a === queue[head] ? edge.b : edge.b === queue[head] ? edge.a : -1;
        if (other >= 0 && !seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    return seen.size === nodes.length;
  };
  const total = plan.width * plan.height;
  for (let k = 0; k < 2 && random() < style.corner; k++) {
    const corners = leaves
      .map((r, n) => ({ r, n }))
      .filter(({ r, n }) => {
        if (removed.has(n) || r.w * r.h > total * 0.3) return false;
        return (
          (r.x === left + wall || r.x + r.w === right - wall + 1) &&
          (r.y === top + wall || r.y + r.h === bottom - wall + 1)
        );
      });
    const corner = corners[Math.floor(random() * corners.length)];
    if (!corner) break;
    removed.add(corner.n);
    if (!connected()) removed.delete(corner.n);
  }
  const { keptLeaves, keptPassages } = kept();
  // Links: stairwells in the passages, spread apart; ladders to an inset level near the middle.
  const spots: Array<{ x: number; y: number; passage: boolean }> = [];
  for (const [list, passage] of [
    [keptPassages, true],
    [keptLeaves, false],
  ] as const)
    for (const r of list)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          // In a room, a stair stands against its wall, not in the middle of the floor.
          if (passage || x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1)
            spots.push({ x, y, passage });
  const taken: Array<{ x: number; y: number }> = [];
  const far = (spot: { x: number; y: number }, gap: number) =>
    taken.every((each) => Math.abs(each.x - spot.x) + Math.abs(each.y - spot.y) >= gap);
  const linkAt = plan.links.map((link) => {
    const ladder = plan.levels[link.upper]!.inset || plan.levels[link.lower]!.inset;
    let pick: { x: number; y: number } | undefined;
    if (ladder) {
      pick = spots
        .filter((spot) => far(spot, 2))
        .sort(
          (a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || Math.abs(a.y - cy) - Math.abs(b.y - cy) || a.x - b.x,
        )[0];
    } else {
      for (const want of [true, false])
        for (const gap of [6, 4, 2]) {
          if (pick) break;
          const choices = spots.filter((spot) => spot.passage === want && Math.abs(spot.x - cx) >= 2 && far(spot, gap));
          pick = choices[Math.floor(random() * choices.length)];
        }
    }
    pick ??= spots.find((spot) => far(spot, 1)) ?? { x: cx, y: cy };
    taken.push(pick);
    return { x: pick.x, y: pick.y };
  });
  return {
    fx,
    fy,
    left,
    right,
    top,
    bottom,
    cx,
    leaves: keptLeaves,
    passages: keptPassages,
    linkAt,
    wall,
    mapW: plan.width + 2 * fx,
    mapH: plan.height + 2 * fy,
  };
}

/**
 * A level of a site as a map, made anew from its seed: the footprint cut again and again at random into
 * rooms, a cut now and then leaving a passage; a corner left off now and then; the spaces joined as a
 * tree from the way in (rooms hang off passages first), with a few more doors for loops; the plan's rooms
 * placed by how far they are from the way in (public near, private far, the heart deep, locked rooms at
 * dead ends, the great room the biggest space, an open court inside the ground floor); then links, locks,
 * furniture, and traps only when the game's rules can find them.
 */
export function siteLevelMap(plan: SitePlan, index: number, options: { traps?: boolean } = {}): SiteLevelMap {
  const level = plan.levels[index]!;
  const random = marinaraRandom(`site-level:${plan.template}:${plan.seed}:${level.id}`);
  const frame = siteFrame(plan);
  const { fx, mapW, mapH } = frame;
  const style = SITE_STYLES[plan.template];
  // An inset level (an attic, a tower top) is a narrower box round the middle.
  const inset = level.inset ? Math.max(4, Math.floor(plan.width * 0.22)) : 0;
  const left = fx + inset;
  const right = fx + plan.width - 1 - inset;
  const { top, bottom } = frame;
  const entry = index === plan.entry;
  const ground: DungeonGround[] = Array.from({ length: mapW * mapH }, () => "rock" as DungeonGround);
  const props: number[] = ground.map(() => -1);
  const cell = (x: number, y: number) => y * mapW + x;
  const inside = (r: SiteRect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) ground[cell(x, y)] = "wall";
  const carve = (r: SiteRect, to: DungeonGround = "floor") => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) ground[cell(x, y)] = to;
  };
  // Links first: no cut runs through them.
  const links: SiteLevelLink[] = [];
  for (const link of plan.links) {
    if (link.upper !== index && link.lower !== index) continue;
    const at = frame.linkAt[plan.links.indexOf(link)]!;
    links.push({
      x: Math.min(right - 1, Math.max(left + 1, at.x)),
      y: at.y,
      level: link.upper === index ? link.lower : link.upper,
      kind: link.kind,
    });
  }

  // ── Cutting: on from the building's main walls and passages (an inset level is its own box) ──
  let planned = [...level.rooms];
  const leaves: SiteRect[] = level.inset
    ? [{ x: left + 1, y: top + 1, w: right - left - 1, h: bottom - top - 1 }]
    : frame.leaves.map((r) => ({ ...r }));
  const passages: SiteRect[] = level.inset ? [] : frame.passages.map((r) => ({ ...r }));
  /** Which of the building's main spaces (its wings) each space of this level lies in. */
  const wingOf = (r: SiteRect) =>
    level.inset
      ? 0
      : frame.leaves.findIndex((wing) => inside(wing, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)));
  const [least, most] = style.extra;
  const target = planned.length + least + Math.floor(random() * (most - least + 1)) + (level.inset ? 0 : 1);
  siteCut(
    random,
    leaves,
    passages,
    target,
    style,
    (vertical, at, r) =>
      !links.some((link) =>
        vertical
          ? link.x === at && link.y >= r.y && link.y < r.y + r.h
          : link.y === at && link.x >= r.x && link.x < r.x + r.w,
      ),
  );
  for (const r of [...leaves, ...passages]) carve(r);
  const thick = level.inset ? 1 : frame.wall;

  // ── What stands out past the walls: a keep's corner towers, a temple's apse ──
  const extras: Array<{ r: SiteRect; room: SitePlanRoom; shape?: (x: number, y: number) => boolean }> = [];
  const meets = (r: SiteRect) => siteEdges([r, ...passages, ...leaves]).some((edge) => edge.a === 0 || edge.b === 0);
  const raise = (r: SiteRect, shape?: (x: number, y: number) => boolean) => {
    for (let y = r.y - thick; y < r.y + r.h + thick; y++)
      for (let x = r.x - thick; x < r.x + r.w + thick; x++)
        if (x >= 0 && y >= 0 && x < mapW && y < mapH && ground[cell(x, y)] === "rock") ground[cell(x, y)] = "wall";
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) ground[cell(x, y)] = !shape || shape(x, y) ? "floor" : "wall";
  };
  if (!level.inset && level.depth >= 0 && plan.template === "keep") {
    const s = plan.wealth === 3 ? 4 : 3;
    // Each tower stands out past a corner, flush with the first rooms inside it.
    const towers: SiteRect[] = [
      { x: left - s + 1, y: top + thick, w: s, h: s },
      { x: right, y: top + thick, w: s, h: s },
      { x: left - s + 1, y: bottom - thick - s + 1, w: s, h: s },
      { x: right, y: bottom - thick - s + 1, w: s, h: s },
    ];
    for (const r of towers)
      if (meets(r) && !links.some((link) => inside(r, link.x, link.y))) {
        raise(r);
        extras.push({
          r,
          room: { name: "Corner tower", use: "post", size: 1, zone: "public", furniture: [SHELF, CHEST] },
        });
      }
  }
  if (!level.inset && level.depth === 0 && plan.template === "temple") {
    // The apse: a rounded end past the far wall, behind the altar; in the middle, or off the middle of
    // whichever room meets the far wall nearest it when the middle is a corner left off.
    const along = [
      frame.cx,
      ...leaves.filter((r) => r.y === top + thick && r.w >= 7).map((r) => r.x + Math.floor(r.w / 2)),
    ].sort((p, q) => Math.abs(p - frame.cx) - Math.abs(q - frame.cx));
    for (const cx of along) {
      const r: SiteRect = { x: cx - 2, y: top - 2, w: 5, h: 3 };
      const shape = (x: number, y: number) => y > r.y || Math.abs(x - cx) <= 1;
      if (!meets(r)) continue;
      raise(r, shape);
      extras.push({ r, room: { name: "Apse", use: "quiet", size: 1, zone: "private", furniture: [T] }, shape });
      break;
    }
  }

  // ── The spaces as a graph: two are neighbours across one wall ──
  const nodes: SiteRect[] = [...passages, ...leaves, ...extras.map((each) => each.r)];
  const isPassage = (n: number) => n < passages.length;
  type Edge = SiteEdge;
  const edges = siteEdges(nodes);
  const touches = (r: SiteRect) => ({
    w: r.x === left + thick,
    e: r.x + r.w === right - thick + 1,
    n: r.y === top + thick,
    s: r.y + r.h === bottom - thick + 1,
  });
  const live = (_n: number) => true;

  // ── The way in, and the tree of doors from it ──
  let entrance = { x: -1, y: -1 };
  let start = -1;
  const hallWanted = entry && planned.some((room) => SITE_ENTRY_ROOMS.has(room.name));
  if (entry) {
    const sides: Array<{ n: number; x: number; y: number; weight: number }> = [];
    for (const [n, r] of nodes.entries()) {
      if (!live(n)) continue;
      const t = touches(r);
      // In by a passage, or straight into the entrance hall where the level has one.
      const bonus = isPassage(n) === !hallWanted ? 3 : 1;
      const pickAlong = (from: number, to: number) => from + Math.floor(random() * (to - from));
      if (t.s) sides.push({ n, x: pickAlong(r.x, r.x + r.w), y: bottom, weight: 3 * bonus });
      if (t.w) sides.push({ n, x: left, y: pickAlong(r.y, r.y + r.h), weight: bonus });
      if (t.e) sides.push({ n, x: right, y: pickAlong(r.y, r.y + r.h), weight: bonus });
      if (t.n) sides.push({ n, x: pickAlong(r.x, r.x + r.w), y: top, weight: 0.5 * bonus });
    }
    let roll = random() * sides.reduce((sum, side) => sum + side.weight, 0);
    const side = sides.find((each) => (roll -= each.weight) < 0) ?? sides[0]!;
    entrance = { x: side.x, y: side.y };
    start = side.n;
  } else {
    const first = links[0];
    start = first ? nodes.findIndex((r, n) => live(n) && inside(r, first.x, first.y)) : -1;
    if (start < 0) start = nodes.findIndex((_, n) => live(n));
    entrance = first ? { x: first.x, y: first.y } : { x: nodes[start]!.x, y: nodes[start]!.y };
  }
  const inTree = new Set([start]);
  const tree: Edge[] = [];
  const parent = new Map<number, Edge>();
  while (true) {
    const frontier = edges.filter((edge) => live(edge.a) && live(edge.b) && inTree.has(edge.a) !== inTree.has(edge.b));
    if (!frontier.length) break;
    const weight = (edge: Edge) => (isPassage(edge.a) || isPassage(edge.b) ? 4 : 1);
    let roll = random() * frontier.reduce((sum, edge) => sum + weight(edge), 0);
    const edge = frontier.find((each) => (roll -= weight(each)) < 0) ?? frontier[0]!;
    const child = inTree.has(edge.a) ? edge.b : edge.a;
    inTree.add(child);
    tree.push(edge);
    parent.set(child, edge);
  }
  const degree = nodes.map((_, n) => tree.filter((edge) => edge.a === n || edge.b === n).length);
  const depth = nodes.map(() => -1);
  depth[start] = 0;
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of tree) {
      if (depth[edge.a]! >= 0 && depth[edge.b]! < 0) [depth[edge.b], changed] = [depth[edge.a]! + 1, true];
      else if (depth[edge.b]! >= 0 && depth[edge.a]! < 0) [depth[edge.a], changed] = [depth[edge.b]! + 1, true];
    }
  }

  // ── The plan's rooms on the spaces ──
  const owner = new Map<number, SitePlanRoom>();
  for (const [k, each] of extras.entries()) owner.set(passages.length + leaves.length + k, each.room);
  const free = () =>
    nodes
      .map((r, n) => ({ r, n }))
      .filter(({ n }) => live(n) && !isPassage(n) && !owner.has(n))
      .sort((p, q) => depth[p.n]! - depth[q.n]! || q.r.w * q.r.h - p.r.w * p.r.h);
  const claim = (pick: (room: SitePlanRoom) => boolean) => {
    const room = planned.find(pick);
    if (room) planned = planned.filter((each) => each !== room);
    return room;
  };
  const area = (n: number) => nodes[n]!.w * nodes[n]!.h;
  const hasLink = (n: number) => links.some((link) => inside(nodes[n]!, link.x, link.y));
  // The great room: the biggest space.
  const great = claim((room) => SITE_HALL_ROOMS.has(room.name));
  if (great) {
    const best = free().reduce<{ r: SiteRect; n: number } | undefined>(
      (most, each) => (!most || area(each.n) > area(most.n) ? each : most),
      undefined,
    );
    if (best) owner.set(best.n, great);
  }
  // An open court: a space inside the ground floor, walled on every side.
  let court = -1;
  if (level.depth === 0 && !level.inset && random() < style.court) {
    const open = free().filter(({ r, n }) => {
      const t = touches(r);
      return !t.n && !t.s && !t.e && !t.w && r.w >= 5 && r.h >= 5 && n !== start && !hasLink(n);
    });
    const chosen = open[Math.floor(random() * open.length)];
    if (chosen) {
      court = chosen.n;
      owner.set(
        court,
        claim((room) => room.use === "open") ?? {
          name: SITE_COURT_NAMES[plan.template],
          use: "open",
          size: 3,
          zone: "public",
          furniture: [],
        },
      );
    }
  }
  // The way in opens into the entrance hall.
  const hallIn = entry ? claim((room) => SITE_ENTRY_ROOMS.has(room.name)) : undefined;
  if (hallIn) {
    const first = !isPassage(start) && !owner.has(start) ? { n: start } : free()[0];
    if (first) owner.set(first.n, hallIn);
  }
  // The heart deep in, in a big space.
  const heart = claim((room) => !!room.heart);
  if (heart) {
    const best = free().reduce<{ r: SiteRect; n: number } | undefined>(
      (most, each) =>
        !most || depth[each.n]! * 6 + area(each.n) / 4 > depth[most.n]! * 6 + area(most.n) / 4 ? each : most,
      undefined,
    );
    if (best) owner.set(best.n, heart);
  }
  // The rest by zone: public rooms near the way in, private and deep ones far from it, each in a space
  // of about its size, kept to one wing per zone where it can be, and beside what it belongs with (the
  // kitchen by the dining room, a dressing room off the bedroom). A locked room only at a dead end.
  const zoneAt = { public: 0.15, service: 0.45, guest: 0.55, private: 0.8, deep: 0.95 } as const;
  const want = { 1: 12, 2: 28, 3: 55 } as const;
  const deepest = Math.max(1, ...depth);
  const neighbours = (p: number, q: number) =>
    edges.some((edge) => (edge.a === p && edge.b === q) || (edge.a === q && edge.b === p));
  const nodeOf = (room: SitePlanRoom) => [...owner.entries()].find(([, each]) => each === room)?.[0];
  const placedNamed = (name: string) =>
    [...owner.entries()].filter(([, each]) => siteBaseName(each.name) === name).map(([n]) => n);
  const partners = (room: SitePlanRoom) => {
    const base = siteBaseName(room.name);
    const out = new Set(SITE_NEXT_TO[base] ?? []);
    for (const [other, list] of Object.entries(SITE_NEXT_TO)) if (list.includes(base)) out.add(other);
    return [...out];
  };
  const firstWing = new Map<string, number>();
  for (const room of owner.values()) {
    const n = nodeOf(room)!;
    if (!firstWing.has(room.zone)) firstWing.set(room.zone, wingOf(nodes[n]!));
  }
  const queue = [...planned].sort(
    (p, q) => Number(partners(p).length > 0) - Number(partners(q).length > 0) || zoneAt[p.zone] - zoneAt[q.zone],
  );
  for (const room of queue) {
    let spaces = free();
    if (room.locked) {
      const ends = spaces.filter(({ n }) => degree[n] === 1 && !hasLink(n) && n !== start);
      if (ends.length) spaces = ends;
    }
    const mates = partners(room);
    const score = (n: number) => {
      let s =
        1.5 * Math.abs(Math.log(area(n) / want[room.size])) + 2.5 * Math.abs(depth[n]! / deepest - zoneAt[room.zone]);
      for (const mate of mates)
        for (const at of placedNamed(mate)) s += neighbours(n, at) ? -2.5 : 0.5 / Math.max(1, placedNamed(mate).length);
      const wing = firstWing.get(room.zone);
      if (wing !== undefined && wing !== wingOf(nodes[n]!)) s += 1;
      return s;
    };
    const best = spaces.reduce<{ r: SiteRect; n: number } | undefined>(
      (most, each) => (!most || score(each.n) < score(most.n) ? each : most),
      undefined,
    );
    if (!best) break;
    planned = planned.filter((each) => each !== room);
    const fits = !room.locked || (degree[best.n] === 1 && !hasLink(best.n) && best.n !== start);
    owner.set(best.n, fits ? room : { ...room, locked: undefined });
    if (!firstWing.has(room.zone)) firstWing.set(room.zone, wingOf(best.r));
  }
  let spares = 0;
  for (const { n } of free())
    owner.set(n, {
      name: `${SPARE_ROOM_NAMES[plan.template]}${spares++ ? ` ${spares}` : ""}`,
      use: "squat",
      size: 1,
      zone: "service",
      furniture: plan.template === "crypt" ? [1, 3] : plan.template === "keep" ? [BED, CHEST] : [CHEST, SHELF],
    });

  // ── Doors ──
  const doorOf = new Map<number, { x: number; y: number }>();
  const lockedNode = (n: number) => !!owner.get(n)?.locked;
  const openEdge = (edge: Edge, main: boolean) => {
    const both = isPassage(edge.a) && isPassage(edge.b);
    if (both) {
      for (const each of edge.cells) ground[cell(each.x, each.y)] = "floor";
      return edge.cells[0]!;
    }
    const at = edge.cells[Math.floor(random() * edge.cells.length)]!;
    ground[cell(at.x, at.y)] = "floor";
    // A doorway with an open court is three wide where it can be.
    if (edge.a === court || edge.b === court)
      for (const each of edge.cells)
        if (Math.abs(each.x - at.x) + Math.abs(each.y - at.y) <= 1) ground[cell(each.x, each.y)] = "floor";
    if (main) {
      const child = depth[edge.a]! > depth[edge.b]! ? edge.a : edge.b;
      doorOf.set(child, at);
    }
    return at;
  };
  for (const edge of tree) openEdge(edge, true);
  // Rooms that belong together open into each other (never into a locked room).
  const together = (p: number, q: number) => {
    const [a, b] = [owner.get(p), owner.get(q)];
    if (!a || !b || a.locked || b.locked) return false;
    return (
      (SITE_NEXT_TO[siteBaseName(a.name)] ?? []).includes(siteBaseName(b.name)) ||
      (SITE_NEXT_TO[siteBaseName(b.name)] ?? []).includes(siteBaseName(a.name))
    );
  };
  const forced = new Set<Edge>();
  for (const edge of edges)
    if (
      !tree.includes(edge) &&
      together(edge.a, edge.b) &&
      !tree.some((each) => (each.a === edge.a && each.b === edge.b) || (each.a === edge.b && each.b === edge.a))
    ) {
      openEdge(edge, false);
      forced.add(edge);
    }
  for (const edge of edges) {
    if (tree.includes(edge) || forced.has(edge) || !live(edge.a) || !live(edge.b) || edge.a > edge.b) continue;
    if (lockedNode(edge.a) || lockedNode(edge.b)) continue;
    const passages2 = Number(isPassage(edge.a)) + Number(isPassage(edge.b));
    const chance = edge.a === court || edge.b === court ? 0.7 : passages2 === 2 ? 0.6 : passages2 === 1 ? 0.2 : 0.25;
    if (random() < chance) openEdge(edge, false);
  }
  if (entry) {
    // Through the whole thickness of the outer wall.
    const [dx, dy] =
      entrance.y === bottom ? [0, -1] : entrance.y === top ? [0, 1] : entrance.x === left ? [1, 0] : [-1, 0];
    for (let t = 0; t < thick; t++) ground[cell(entrance.x + dx * t, entrance.y + dy * t)] = "floor";
  }

  const rooms: DungeonRoom[] = [];
  const info: SiteLevelMap["rooms"] = [];
  const doors: Array<{ x: number; y: number; room: number; locked: boolean } | null> = [];
  const opens: Array<SiteSide | null> = [];
  const roomOf = new Map<SitePlanRoom, number>();
  const ways: SiteRect[] = passages.filter((_, n) => live(n));
  for (const [n, room] of [...owner.entries()].sort((p, q) => depth[p[0]]! - depth[q[0]]! || p[0] - q[0])) {
    const r = nodes[n]!;
    const door = n === start && entry ? entrance : (doorOf.get(n) ?? null);
    const side: SiteSide | null = !door
      ? null
      : door.y < r.y
        ? "N"
        : door.y >= r.y + r.h
          ? "S"
          : door.x < r.x
            ? "W"
            : "E";
    const k = rooms.length;
    roomOf.set(room, k);
    rooms.push({ ...r });
    info.push({ name: room.name, use: room.use, ...(room.heart ? { heart: true as const } : {}) });
    doors.push(door && n !== court ? { ...door, room: k, locked: !!room.locked && n !== start } : null);
    opens.push(side);
    // A great room's pillars: two rows of them down a big one, clear of its doors and links.
    if (SITE_HALL_ROOMS.has(room.name) && r.w >= 7 && r.h >= 7) {
      const doorway = (x: number, y: number) =>
        [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([dx, dy]) => ground[cell(dx!, dy!)] === "floor" && !inside(r, dx!, dy!));
      const vertical = r.h > r.w;
      for (const off of [2, (vertical ? r.w : r.h) - 3])
        for (let along = 2; along < (vertical ? r.h : r.w) - 2; along += 3) {
          const [x, y] = vertical ? [r.x + off, r.y + along] : [r.x + along, r.y + off];
          if (links.some((link) => link.x === x && link.y === y) || doorway(x, y)) continue;
          ground[cell(x, y)] = "wall";
        }
    }
  }
  if (entry) props[cell(entrance.x, entrance.y)] = DUNGEON_EXIT_PROP;
  // Solid with nothing open beside it is not wall but the land round the building.
  const solid = ground.map((g, i) => {
    if (g !== "wall") return false;
    const [x, y] = [i % mapW, Math.floor(i / mapW)];
    // A stone building's outer wall is two thick.
    for (let dy = -thick; dy <= thick; dy++)
      for (let dx = -thick; dx <= thick; dx++) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
        if (ground[cell(nx, ny)] !== "wall" && ground[cell(nx, ny)] !== "rock") return false;
      }
    return true;
  });
  for (const [i, inside2] of solid.entries()) if (inside2) ground[i] = "rock";
  // Flooded: water across the rooms' middles, never cutting a room off from its door.
  if (level.flooded)
    for (const area of rooms) {
      if (area.w < 3 || area.h < 3) continue;
      for (let y = area.y + 1; y < area.y + area.h - 1; y++)
        for (let x = area.x + 1; x < area.x + area.w - 1; x++)
          if (ground[cell(x, y)] === "floor" && !links.some((link) => link.x === x && link.y === y) && random() < 0.7)
            ground[cell(x, y)] = "liquid";
    }
  const map: DungeonMap = {
    set: plan.set,
    seed: plan.seed,
    width: mapW,
    height: mapH,
    ground,
    props,
    rooms,
    entrance,
    roomNames: info.map((each) => each.name),
  };
  const linked = new Set(links.map((link) => cell(link.x, link.y)));
  // Every open cell reachable from the way in (or the first link), so water and furniture never cut
  // a room off.
  const reachable = () => {
    const begin = cell(entrance.x, entrance.y);
    const seen = new Uint8Array(ground.length);
    const queue = [begin];
    seen[begin] = 1;
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      const x = c % mapW;
      for (const n of [c - 1, c + 1, c - mapW, c + mapW]) {
        if (n < 0 || n >= ground.length || seen[n] || (n === c - 1 && x === 0) || (n === c + 1 && x === mapW - 1))
          continue;
        if (ground[n] !== "floor" || (props[n] !== -1 && props[n] !== DUNGEON_EXIT_PROP && props[n] !== SITE_LOCK_PROP))
          continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return ground.every((g, i) => g !== "floor" || seen[i] || (props[i] !== -1 && props[i] !== DUNGEON_EXIT_PROP));
  };
  // Water that cuts a room off is drained.
  if (level.flooded && !reachable())
    for (let i = 0; i < ground.length; i++) if (ground[i] === "liquid") ground[i] = "floor";
  // Locks: a locked room's door; its key in another room of the level that is open.
  const locks: SiteLevelLock[] = [];
  const open = rooms.map((_, n) => n).filter((n) => !doors[n]?.locked);
  for (const door of doors) {
    if (!door?.locked || !open.length) continue;
    props[cell(door.x, door.y)] = SITE_LOCK_PROP;
    locks.push({ x: door.x, y: door.y, room: door.room, key: open[Math.floor(random() * open.length)]! });
  }
  // Furniture against each room's back wall (the one facing its door), then rubble in ruined rooms;
  // never closing a way.
  const doorCells = new Set(doors.flatMap((door) => (door ? [cell(door.x, door.y)] : [])));
  for (const [room, n] of roomOf) {
    const area = rooms[n]!;
    const side = opens[n];
    const put = (slot: number, x: number, y: number) => {
      const i = cell(x, y);
      if (ground[i] !== "floor" || props[i] !== -1 || linked.has(i) || doorCells.has(i)) return false;
      props[i] = slot;
      if (reachable()) return true;
      props[i] = -1;
      return false;
    };
    // Where each piece goes, by what it is: tables down the middle, beds and shelves against the walls
    // (the back wall first), the hearth in the middle of the back wall, chests in the corners; in a crypt
    // sarcophagi down the middle, bones about the floor, torches on the walls, pillars in rows. A big room
    // gets more of what it is furnished with, never so much that it is cluttered or a way is closed.
    const near = (x: number, y: number) =>
      [...doorCells, ...linked, cell(entrance.x, entrance.y)].some((c) => {
        const [cx2, cy2] = [c % mapW, Math.floor(c / mapW)];
        return Math.abs(cx2 - x) + Math.abs(cy2 - y) <= 1;
      });
    const [x0, y0, x1, y1] = [area.x, area.y, area.x + area.w - 1, area.y + area.h - 1];
    const backRow: Array<[number, number]> = [];
    const sideRows: Array<Array<[number, number]>> = [];
    const frontRow: Array<[number, number]> = [];
    // Each wall a run of its own, so "every other cell" holds along it.
    const run = (from: [number, number], step: [number, number], n: number) =>
      Array.from({ length: Math.max(0, n) }, (_, k): [number, number] => [
        from[0] + step[0] * k,
        from[1] + step[1] * k,
      ]);
    const walls = {
      N: run([x0 + 1, y0], [1, 0], area.w - 2),
      S: run([x0 + 1, y1], [1, 0], area.w - 2),
      W: run([x0, y0 + 1], [0, 1], area.h - 2),
      E: run([x1, y0 + 1], [0, 1], area.h - 2),
    };
    const facing = { N: "S", S: "N", W: "E", E: "W" } as const;
    const back = side ? facing[side] : "N";
    const front = side ?? "S";
    backRow.push(...walls[back]);
    frontRow.push(...walls[front]);
    for (const key of ["N", "S", "W", "E"] as const) if (key !== back && key !== front) sideRows.push(walls[key]);
    const corners: Array<[number, number]> = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ];
    const along = area.w >= area.h;
    const short = along ? area.h : area.w;
    const long = along ? area.w : area.h;
    const lines =
      short >= 7 ? [Math.floor(short / 3), short - 1 - Math.floor(short / 3)] : [Math.floor((short - 1) / 2)];
    const middle: Array<[number, number]> = [];
    for (const line of lines)
      for (let k = short >= 3 ? 1 : 0; k < (short >= 3 ? long - 1 : long); k += long >= 5 ? 2 : 1)
        middle.push(along ? [x0 + k, y0 + line] : [x0 + line, y0 + k]);
    const pillars: Array<[number, number]> = [];
    if (short >= 5) for (let y = y0 + 1; y < y1; y += 3) for (let x = x0 + 1; x < x1; x += 3) pillars.push([x, y]);
    const shuffle = <T>(list: T[]) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
      return list;
    };
    const everywhere = () => {
      const out: Array<[number, number]> = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
      return shuffle(out);
    };
    // Every other cell along each wall in turn (starting at random), and only then the cells between.
    const spread = (...lists: Array<Array<[number, number]>>) => {
      const skips = lists.map(() => Math.floor(random() * 2));
      return [0, 1].flatMap((odd) => lists.flatMap((list, n) => list.filter((_, k) => (k + skips[n]!) % 2 === odd)));
    };
    const backMiddle = [...backRow].sort((p, q) => {
      const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
      return Math.abs(p[0] - mx) + Math.abs(p[1] - my) - (Math.abs(q[0] - mx) + Math.abs(q[1] - my));
    });
    const reps = Math.max(1, Math.min(5, Math.round((area.w * area.h) / 14)));
    let budget = Math.max(1, Math.floor((area.w * area.h) / 4));
    const tiny = Math.min(area.w, area.h) < 3;
    for (const slot of room.furniture) {
      const kind = siteFurnitureRole(plan.template, slot);
      // A bed is one to a room but in a dormitory; everything else set out along a wall or down the middle
      // repeats with the room's size.
      const one = plan.template !== "crypt" && slot === BED && !SITE_DORMS.has(siteBaseName(room.name));
      const count =
        !one && (kind === "center" || kind === "wall" || kind === "scatter" || kind === "pillar") ? reps : 1;
      const spots = tiny
        ? everywhere()
        : kind === "back"
          ? [...backMiddle, ...spread(...sideRows)]
          : kind === "corner"
            ? [...shuffle(corners), ...spread(backRow)]
            : kind === "wall"
              ? spread(backRow, ...sideRows, frontRow)
              : kind === "center"
                ? middle
                : kind === "pillar"
                  ? pillars
                  : everywhere();
      let placed = 0;
      for (const [x, y] of spots) {
        if (placed >= count || budget <= 0) break;
        if (near(x, y)) continue;
        if (put(slot, x, y)) {
          placed++;
          budget--;
        }
      }
    }
    if (room.ruined)
      for (let k = 0; k < Math.ceil((area.w * area.h) / 6); k++)
        put(SITE_RUBBLE_PROP, area.x + Math.floor(random() * area.w), area.y + Math.floor(random() * area.h));
  }
  // Traps, only where the rules can find them: in the ways and in the holders' rooms and stores, never on
  // a link, a door or the way in.
  const traps: SiteLevelTrap[] = [];
  if (options.traps) {
    const want = 1 + Math.floor(random() * (2 + plan.wealth));
    for (let tries = 0; tries < 60 && traps.length < want; tries++) {
      const target = random() < 0.4 ? -1 : Math.floor(random() * rooms.length);
      const area = target < 0 && ways.length ? ways[Math.floor(random() * ways.length)]! : rooms[Math.max(0, target)]!;
      if (target >= 0 && (info[target]!.use === "quiet" || info[target]!.use === "open")) continue;
      const x = area.x + Math.floor(random() * area.w);
      const y = area.y + Math.floor(random() * area.h);
      const i = cell(x, y);
      if (ground[i] !== "floor" || props[i] !== -1 || linked.has(i) || doorCells.has(i)) continue;
      if (Math.abs(x - entrance.x) + Math.abs(y - entrance.y) < 3) continue;
      if (traps.some((trap) => trap.x === x && trap.y === y)) continue;
      traps.push({ x, y, dc: 10 + plan.wealth * 2 + Math.floor(random() * 4) - level.depth });
    }
  }
  map.entrance = entrance;
  return { map, rooms: info, links, locks, traps };
}

// ── As the game keeps it ──

/** What the party has done in a planned building, kept across its levels. */
export interface SitePlanState {
  seen?: Record<string, number[]>;
  unlocked?: string[];
  trapsFound?: string[];
  trapsGone?: string[];
}

const WEALTH_WORDS: ReadonlyArray<[RegExp, 1 | 2 | 3]> = [
  [/\b(palace|castle|citadel|cathedral|chateau)\b/u, 3],
  [/\b(estate|manor|mansion|abbey|fortress|monastery|stronghold)\b/u, 2],
  [/\b(house|lodge|cottage|chapel|shrine|fort|tower)\b/u, 1],
];
const UNDEAD_WORDS =
  /\b(vampires?|counts?|countess|haunted|cursed|accursed|dread|blood|necro\w*|lich|graves?|bones?|blighted|dead)\b/u;

/** The plan input of a building from its name and the game's seed for it, with what the world says
 *  (its fate, its land) on top. */
export function sitePlanInputFor(input: {
  template: SiteTemplateId;
  name: string;
  seed: number;
  fate?: SiteFate;
  terrain?: SiteTerrain;
  wealth?: 1 | 2 | 3;
  undead?: boolean;
}): SitePlanInput {
  const words = input.name.toLowerCase();
  const random = marinaraRandom(`site-input:${input.seed}:${words}`);
  const roll = random();
  const wealth = input.wealth ?? WEALTH_WORDS.find(([pattern]) => pattern.test(words))?.[1] ?? (roll < 0.5 ? 1 : 2);
  const undead =
    input.undead ??
    (UNDEAD_WORDS.test(words) ||
      input.fate === "sickness" ||
      ((input.template === "manor" || input.template === "keep") && random() < 0.25));
  return {
    template: input.template,
    seed: input.seed,
    wealth,
    ...(input.fate ? { fate: input.fate } : {}),
    ...(input.terrain ? { terrain: input.terrain } : {}),
    ...(undead ? { undead: true } : {}),
  };
}

/**
 * A level of a planned building as the game keeps it: its rooms by name and use, its links, locks and
 * traps, with what the party has done there (locks opened, traps found and gone) laid back on, and the
 * party at the way in or, coming from another level, at the link it came by.
 */
export function gameDungeonPlannedMap(input: {
  plan: SitePlanInput;
  name: string;
  id: string;
  level?: number;
  /** The level the party comes from, to stand at the link from it. */
  from?: number;
  traps?: boolean;
  state?: SitePlanState;
}): GameDungeonMap {
  const plan = sitePlan(input.plan);
  const level = Math.max(0, Math.min(plan.levels.length - 1, input.level ?? plan.entry));
  const laid = siteLevelMap(plan, level, { traps: input.traps });
  const state = input.state ?? {};
  const unlocked = new Set(state.unlocked ?? []);
  const gone = new Set(state.trapsGone ?? []);
  const found = new Set(state.trapsFound ?? []);
  const kept = gameDungeonMapFromDungeon(laid.map, input.name, input.id);
  const props = [...kept.props];
  const locks = laid.locks.filter((lock) => {
    if (!unlocked.has(`${level}:${lock.room}`)) return true;
    props[lock.y * laid.map.width + lock.x] = "-";
    return false;
  });
  const traps = laid.traps
    .filter((trap) => !gone.has(`${level}:${trap.x}:${trap.y}`))
    .map((trap) => ({ ...trap, ...(found.has(`${level}:${trap.x}:${trap.y}`) ? { found: true as const } : {}) }));
  const arrive = input.from !== undefined ? laid.links.find((link) => link.level === input.from) : undefined;
  const at = arrive ? { x: arrive.x, y: arrive.y } : laid.map.entrance;
  return {
    ...kept,
    props: props.join(""),
    entrance: laid.map.entrance,
    at,
    roomInfo: laid.rooms.map((room) => ({
      name: room.name,
      use: room.use,
      ...(room.heart ? { heart: true as const } : {}),
    })),
    site: {
      template: plan.template,
      wealth: plan.wealth,
      ...(input.plan.fate ? { fate: input.plan.fate } : {}),
      ...(input.plan.terrain ? { terrain: input.plan.terrain } : {}),
      ...(input.plan.undead ? { undead: true as const } : {}),
      ...(input.traps ? { traps: true as const } : {}),
      level,
      levels: plan.levels.map((each) => ({ name: each.name, depth: each.depth })),
      seen: state.seen ?? {},
      unlocked: [...unlocked],
      trapsFound: [...found],
      trapsGone: [...gone],
    },
    links: laid.links,
    ...(locks.length ? { locks } : {}),
    ...(traps.length ? { traps } : {}),
  };
}

/** A planned building's plan input back from a level the game keeps. */
export function sitePlanInputOf(map: GameDungeonMap): SitePlanInput | null {
  const site = map.site;
  const template = SITE_TEMPLATE_IDS.find((id) => id === site?.template);
  if (!site || !template) return null;
  return {
    template,
    seed: map.siteSeed ?? map.seed,
    wealth: site.wealth,
    ...(site.fate ? { fate: site.fate as SiteFate } : {}),
    ...(site.terrain ? { terrain: site.terrain as SiteTerrain } : {}),
    ...(site.undead ? { undead: true } : {}),
  };
}

/** What a walk on a planned building's level did: where it really ended (a hidden trap stops it), the
 *  rooms it went through, the locks it opened and the trap it set off. */
export interface SiteWalkResult {
  map: GameDungeonMap;
  /** The cells walked, cut at a trap set off. */
  path: Array<{ x: number; y: number }>;
  /** Names of the rooms whose locks opened: their keys were in a room walked into. */
  unlocked: string[];
  /** A hidden trap set off on the way: its area (0 the hall) and how hard. */
  trap?: { area: number; dc: number };
}

/** A walk on a level: rooms walked into are seen, their keys open their locks, and a hidden trap on the
 *  way stops the party on it, set off and spent. Maps that are not planned pass through untouched. */
export function siteWalk(map: GameDungeonMap, path: Array<{ x: number; y: number }>): SiteWalkResult {
  if (!map.site || !map.roomInfo) return { map: { ...map, at: path.at(-1) ?? map.at }, path, unlocked: [] };
  const site = { ...map.site };
  const areaAt = (x: number, y: number) =>
    map.rooms.findIndex((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h);
  // A hidden trap on the way: the walk ends on it.
  let walked = path;
  let trap: SiteWalkResult["trap"];
  const traps = [...(map.traps ?? [])];
  const hit = walked.findIndex((step) => traps.some((each) => !each.found && each.x === step.x && each.y === step.y));
  if (hit >= 0) {
    walked = walked.slice(0, hit + 1);
    const step = walked[hit]!;
    const sprung = traps.find((each) => each.x === step.x && each.y === step.y)!;
    trap = { area: areaAt(step.x, step.y) + 1, dc: sprung.dc };
    traps.splice(traps.indexOf(sprung), 1);
  }
  const rooms = new Set<number>();
  for (const step of walked) {
    const area = areaAt(step.x, step.y);
    if (area >= 0) rooms.add(area);
  }
  const key = String(site.level);
  const seen = [...new Set([...(site.seen[key] ?? []), ...rooms])].sort((a, b) => a - b);
  const props = [...map.props];
  const unlocked: string[] = [];
  const locks = (map.locks ?? []).filter((lock) => {
    if (!rooms.has(lock.key)) return true;
    props[lock.y * map.width + lock.x] = "-";
    unlocked.push(map.roomInfo![lock.room]?.name ?? `area ${lock.room + 1}`);
    site.unlocked = [...site.unlocked, `${site.level}:${lock.room}`];
    return false;
  });
  const end = walked.at(-1) ?? map.at;
  return {
    map: {
      ...map,
      at: end,
      props: props.join(""),
      site: {
        ...site,
        seen: { ...site.seen, [key]: seen },
        unlocked: [...new Set(site.unlocked)],
        trapsGone: trap ? [...site.trapsGone, `${site.level}:${end.x}:${end.y}`] : site.trapsGone,
      },
      ...(locks.length ? { locks } : { locks: undefined }),
      ...(traps.length ? { traps } : { traps: undefined }),
    },
    path: walked,
    unlocked,
    ...(trap ? { trap } : {}),
  };
}

/** What a reply's planned-building tags ask: `[map: unlock area=N]` opens a lock the story opened;
 *  `[trap: found area=N]` marks the traps in an area found (0 the hall), `[trap: disarmed area=N]` gone. */
export function readGameDungeonPlanTags(text: string): { unlock: number[]; found: number[]; disarmed: number[] } {
  const out = { unlock: [] as number[], found: [] as number[], disarmed: [] as number[] };
  for (const match of text.matchAll(/\[map:\s*unlock\s+area\s*=\s*"?(\d{1,2})"?\s*\]/giu))
    out.unlock.push(Number(match[1]));
  for (const match of text.matchAll(/\[trap:\s*(found|disarmed)\s+area\s*=\s*"?(\d{1,2})"?\s*\]/giu))
    (match[1]!.toLowerCase() === "found" ? out.found : out.disarmed).push(Number(match[2]));
  return out;
}

/** A planned level with a reply's tags laid on: locks opened, traps found or disarmed. */
export function siteApplyTags(map: GameDungeonMap, tags: ReturnType<typeof readGameDungeonPlanTags>): GameDungeonMap {
  if (!map.site || (!tags.unlock.length && !tags.found.length && !tags.disarmed.length)) return map;
  const site = { ...map.site };
  const areaOf = (x: number, y: number) =>
    map.rooms.findIndex((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) + 1;
  const props = [...map.props];
  const locks = (map.locks ?? []).filter((lock) => {
    if (!tags.unlock.includes(lock.room + 1)) return true;
    props[lock.y * map.width + lock.x] = "-";
    site.unlocked = [...new Set([...site.unlocked, `${site.level}:${lock.room}`])];
    return false;
  });
  const traps = (map.traps ?? []).flatMap((trap) => {
    const area = areaOf(trap.x, trap.y);
    const id = `${site.level}:${trap.x}:${trap.y}`;
    if (tags.disarmed.includes(area)) {
      site.trapsGone = [...new Set([...site.trapsGone, id])];
      return [];
    }
    if (tags.found.includes(area)) {
      site.trapsFound = [...new Set([...site.trapsFound, id])];
      return [{ ...trap, found: true as const }];
    }
    return [trap];
  });
  return {
    ...map,
    props: props.join(""),
    site,
    ...(locks.length ? { locks } : { locks: undefined }),
    ...(traps.length ? { traps } : { traps: undefined }),
  };
}

/** The hidden traps of a level, for the Game Master only (the party sees none until found), with the
 *  checks the game's rules find them by. */
export function siteTrapPromptText(map: GameDungeonMap, skills: readonly string[]): string {
  const hidden = (map.traps ?? []).filter((trap) => !trap.found);
  if (!map.site?.traps) return "";
  const areaOf = (x: number, y: number) =>
    map.rooms.findIndex((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) + 1;
  const where = hidden.map((trap) => {
    const area = areaOf(trap.x, trap.y);
    return `${area ? `area ${area}${map.roomInfo?.[area - 1] ? ` (${map.roomInfo[area - 1]!.name})` : ""}` : "the hall"}, DC ${trap.dc}`;
  });
  const by = skills.length ? skills.join(" or ") : "a search";
  return `TRAPS ON THIS LEVEL (secret: never name one the party has not found): ${where.length ? where.join("; ") : "none left"}. When the party searches an area, or walks in with its guard up, call for a ${by} check against the trap's DC; found, write [trap: found area=N] and the map shows it; disarmed, write [trap: disarmed area=N] (a trap set off is spent and gone). A party that walks onto a hidden trap sets it off: the Engine stops their walk there and tells you; resolve it by the rules.`;
}
