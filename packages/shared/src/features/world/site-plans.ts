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

/** How a building's floors are laid out round their ways through: a hall down the middle (spine), a hall
 *  with an arm to a front door (tee), a crossing of two halls (cross), a ring of passages round a court
 *  (court), or one great room the others open from (hall: a great hall, a nave, an undercroft). Chosen
 *  once per building, so every level shares its ways and its stairs line up. */
type SiteScheme = "spine" | "tee" | "cross" | "court" | "hall";
const SITE_SCHEMES: Record<SiteTemplateId, ReadonlyArray<readonly [SiteScheme, number]>> = {
  manor: [
    ["spine", 3],
    ["tee", 3],
    ["hall", 2],
    ["court", 2],
  ],
  keep: [
    ["court", 4],
    ["cross", 3],
    ["hall", 3],
  ],
  temple: [
    ["hall", 6],
    ["court", 3],
    ["tee", 1],
  ],
  crypt: [
    ["cross", 4],
    ["hall", 4],
    ["spine", 2],
  ],
};
/** The rooms that are the great room of a level laid out round one. */
const SITE_HALL_ROOMS = new Set(["Great hall", "Nave", "Undercroft", "Burial hall"]);
/** The rooms the way in opens into: on a level whose way in is an arm off the main way, the arm is this
 *  room. */
const SITE_ENTRY_ROOMS = new Set(["Entrance hall", "Gatehouse", "Narthex", "Vestibule"]);
/** The open court of a building laid out round one, when its plan names no open room for it. */
const SITE_COURT_NAMES: Record<SiteTemplateId, string> = {
  manor: "Courtyard",
  keep: "Inner ward",
  temple: "Cloister garth",
  crypt: "Open court",
};

type SiteSide = "N" | "S" | "E" | "W";
interface SiteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Room space beside a way: its rooms open onto the way on `door`'s side. */
interface SiteRegion extends SiteRect {
  door: SiteSide;
}

/** Where the ways run and each link stands: the same on every level, from the plan alone, so stairs line
 *  up. Links stand on `linkRow`, the first row of the main hall (or of the court's near passage). */
function siteFrame(plan: SitePlan) {
  const random = marinaraRandom(`site-scheme:${plan.template}:${plan.seed}:${plan.wealth}`);
  const choices = SITE_SCHEMES[plan.template];
  let roll = random() * choices.reduce((sum, [, weight]) => sum + weight, 0);
  let scheme: SiteScheme = choices[0]![0];
  for (const [each, weight] of choices) {
    if ((roll -= weight) < 0) {
      scheme = each;
      break;
    }
  }
  if (scheme === "court" && (plan.height < 21 || plan.width < 30)) scheme = "tee";
  const mirror = random() < 0.5;
  const fx = 2;
  const fy = 2;
  const [left, right, top, bottom] = [fx, fx + plan.width - 1, fy, fy + plan.height - 1];
  const cx = fx + Math.floor(plan.width / 2);
  const spineH = plan.wealth >= 2 ? 2 : 1;
  const hallH = plan.wealth >= 2 && plan.height >= 21 ? 5 : 3;
  // The court: rooms all round it, a passage on each side.
  const band = plan.height >= 25 ? 5 : 4;
  const side = Math.max(4, Math.min(7, Math.floor((plan.width - 2) * 0.2)));
  const court = { yA: top + band + 2, yB: bottom - band - 2, xA: left + side + 2, xB: right - side - 2 };
  const linkRow =
    scheme === "court" ? court.yA : top + Math.floor((plan.height - (scheme === "hall" ? hallH : spineH)) / 2);
  // One cell per link, none shared: a ladder to an inset level stands in the middle (inside the inset),
  // the others spread along the link row, away from the middle and from the far end.
  const free = plan.links.filter((link) => !plan.levels[link.upper]!.inset && !plan.levels[link.lower]!.inset);
  const step = (plan.width - 14) / Math.max(1, free.length + 1);
  const slots: number[] = [];
  for (let k = 0; slots.length < free.length && k < 40; k++) {
    const x = fx + 5 + Math.round(step * (k + 0.5));
    if (Math.abs(x - cx) >= 2 && !slots.includes(x) && x < right - 2) slots.push(x);
    if (k >= free.length + 4) {
      // Too many for the even steps: any free cell of the row.
      for (let x2 = fx + 3; slots.length < free.length && x2 < right - 2; x2++)
        if (Math.abs(x2 - cx) >= 2 && !slots.includes(x2)) slots.push(x2);
    }
  }
  let ladders = 0;
  const linkX = plan.links.map((link) =>
    free.includes(link) ? slots[free.indexOf(link)]! : cx + (ladders++ % 2 ? -1 : 0),
  );
  return {
    scheme,
    mirror,
    fx,
    fy,
    left,
    right,
    top,
    bottom,
    cx,
    spineH,
    hallH,
    court,
    linkRow,
    linkX,
    mapW: plan.width + 4,
    mapH: plan.height + 4,
  };
}

/** A level of a site as a map: the footprint's walls, the ways through it as the building's scheme lays
 *  them, the level's rooms beside the ways in order (public near the way in, private at the far end), a
 *  door from each onto its way and now and then into the room beside it, its links, locks and furniture;
 *  with traps only when the game's rules can find them. */
export function siteLevelMap(plan: SitePlan, index: number, options: { traps?: boolean } = {}): SiteLevelMap {
  const level = plan.levels[index]!;
  const random = marinaraRandom(`site-level:${plan.template}:${plan.seed}:${level.id}`);
  const frame = siteFrame(plan);
  const { fx, mapW, mapH, cx, linkRow } = frame;
  // An inset level (an attic, a tower top) is a narrower box round the middle.
  const inset = level.inset ? Math.max(4, Math.floor(plan.width * 0.22)) : 0;
  const left = fx + inset;
  const right = fx + plan.width - 1 - inset;
  const { top, bottom } = frame;
  const entry = index === plan.entry;
  const ground: DungeonGround[] = Array.from({ length: mapW * mapH }, () => "rock" as DungeonGround);
  const props: number[] = ground.map(() => -1);
  const cell = (x: number, y: number) => y * mapW + x;
  // Solid inside the footprint; the ways and rooms are cut out of it.
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) ground[cell(x, y)] = "wall";
  const carve = (rect: SiteRect) => {
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) ground[cell(x, y)] = "floor";
  };
  const rect = (x0: number, y0: number, x1: number, y1: number): SiteRect => ({
    x: x0,
    y: y0,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
  });

  // ── The ways ──
  let planned = [...level.rooms];
  const claim = (pick: (room: SitePlanRoom) => boolean) => {
    const room = planned.find(pick);
    if (room) planned = planned.filter((each) => each !== room);
    return room;
  };
  const hallRoom =
    !level.inset && frame.scheme === "hall" ? claim((room) => SITE_HALL_ROOMS.has(room.name)) : undefined;
  const scheme: SiteScheme = level.inset
    ? "spine"
    : frame.scheme === "hall"
      ? hallRoom
        ? "hall"
        : "spine"
      : frame.scheme === "tee" && !entry
        ? "spine"
        : frame.scheme;
  const ways: SiteRect[] = [];
  const regions: SiteRegion[] = [];
  /** The great room, the court and a temple's sanctuary: rooms that are not cut into columns. */
  const special: Array<{ room: SitePlanRoom; rect: SiteRect }> = [];
  let entrance = { x: -1, y: -1 };
  /** The way in from the front door up to the way at row `from`: the entrance hall (a gatehouse, a
   *  narthex), three or five wide, where the level has one, else a passage. Its half-width, past the
   *  middle column. */
  const arm = (from: number, end: number) => {
    entrance = { x: cx, y: bottom };
    const room = claim((each) => SITE_ENTRY_ROOMS.has(each.name));
    if (!room) {
      ways.push(rect(cx, from + 1, cx, bottom - 1));
      return 0;
    }
    const half = plan.wealth >= 3 && end - cx >= 10 ? 2 : 1;
    special.push({ room, rect: rect(cx - half, from + 2, cx + half, bottom - 1) });
    ground[cell(cx, from + 1)] = "floor";
    return half;
  };
  if (scheme === "court") {
    const { yA, yB, xA, xB } = frame.court;
    ways.push(rect(left + 1, yA, right - 1, yA), rect(left + 1, yB, right - 1, yB));
    ways.push(rect(xA, yA, xA, yB), rect(xB, yA, xB, yB));
    // A great hall (a nave) is the whole range across the court from the way in, open onto its passage.
    const range = !level.inset ? claim((room) => SITE_HALL_ROOMS.has(room.name)) : undefined;
    if (range) {
      special.push({ room: range, rect: rect(left + 1, top + 1, right - 1, yA - 2) });
      for (const x of [left + 2, cx, right - 2]) ground[cell(x, yA - 1)] = "floor";
    } else regions.push({ ...rect(left + 1, top + 1, right - 1, yA - 2), door: "S" });
    regions.push({ ...rect(left + 1, yA + 2, xA - 2, yB - 2), door: "E" });
    regions.push({ ...rect(xB + 2, yA + 2, right - 1, yB - 2), door: "W" });
    const inner = rect(xA + 2, yA + 2, xB - 2, yB - 2);
    if (level.depth === 0) {
      // The court on the ground; above it is sky and below it earth, so other levels have none.
      const room = claim((each) => each.use === "open") ?? {
        name: SITE_COURT_NAMES[plan.template],
        use: "open" as const,
        size: 3 as const,
        zone: "public" as const,
        furniture: [],
      };
      special.push({ room, rect: inner });
      const cy = inner.y + Math.floor(inner.h / 2);
      for (const [x, y] of [
        [cx, yA + 1],
        [cx, yB - 1],
        [xA + 1, cy],
        [xB - 1, cy],
      ] as const)
        ground[cell(x, y)] = "floor";
    }
    if (entry) {
      const half = arm(yB, right - 1);
      regions.push({ ...rect(left + 1, yB + 2, cx - half - 2, bottom - 1), door: "N" });
      regions.push({ ...rect(cx + half + 2, yB + 2, right - 1, bottom - 1), door: "N" });
    } else regions.push({ ...rect(left + 1, yB + 2, right - 1, bottom - 1), door: "N" });
  } else {
    const hallH = scheme === "hall" ? frame.hallH : level.inset ? 1 : frame.spineH;
    const [r0, r1] = [linkRow, linkRow + hallH - 1];
    // A temple's sanctuary closes the nave's far end, the whole height of the building.
    const apse =
      scheme === "hall" && plan.template === "temple"
        ? claim((room) => !!room.heart && room.use === "holders")
        : undefined;
    const apseW = apse ? (plan.width >= 40 ? 7 : 6) : 0;
    const end = right - 1 - (apse ? apseW + 1 : 0);
    const hall = rect(left + 1, r0, end, r1);
    ways.push(hall);
    if (hallRoom) special.push({ room: hallRoom, rect: hall });
    if (apse) {
      special.push({ room: apse, rect: rect(end + 2, top + 1, right - 1, bottom - 1) });
      for (let y = r0; y <= r1; y++) ground[cell(end + 1, y)] = "floor";
    }
    const arms = (scheme === "tee" && entry) || scheme === "cross";
    if (scheme === "cross") {
      ways.push(rect(cx, top + 1, cx, r0 - 1));
      regions.push({ ...rect(left + 1, top + 1, cx - 2, r0 - 2), door: "S" });
      regions.push({ ...rect(cx + 2, top + 1, end, r0 - 2), door: "S" });
    } else regions.push({ ...rect(left + 1, top + 1, end, r0 - 2), door: "S" });
    if (arms) {
      const half = entry ? arm(r1, end) : (ways.push(rect(cx, r1 + 1, cx, bottom - 1)), 0);
      regions.push({ ...rect(left + 1, r1 + 2, cx - half - 2, bottom - 1), door: "N" });
      regions.push({ ...rect(cx + half + 2, r1 + 2, end, bottom - 1), door: "N" });
    } else regions.push({ ...rect(left + 1, r1 + 2, end, bottom - 1), door: "N" });
    if (entry && entrance.x < 0) entrance = { x: left, y: r0 + Math.floor((hallH - 1) / 2) };
  }
  for (const way of ways) carve(way);

  // ── The rooms ──
  // Along a region (u, from its first cell along the way) and away from its way (v, 0 against the way).
  const along = (region: SiteRegion) => (region.door === "N" || region.door === "S" ? region.w : region.h);
  const deep = (region: SiteRegion) => (region.door === "N" || region.door === "S" ? region.h : region.w);
  const place = (region: SiteRegion, u: number, v: number, lu: number, lv: number): SiteRect => {
    switch (region.door) {
      case "N":
        return { x: region.x + u, y: region.y + v, w: lu, h: lv };
      case "S":
        return { x: region.x + u, y: region.y + region.h - v - lv, w: lu, h: lv };
      case "W":
        return { x: region.x + v, y: region.y + u, w: lv, h: lu };
      case "E":
        return { x: region.x + region.w - v - lv, y: region.y + u, w: lv, h: lu };
    }
  };
  const usable = regions.filter((region) => along(region) >= 2 && deep(region) >= 2);
  // The rooms in order (public near the way in, private at the far end), shared out over the regions
  // nearest the way in first, each its share by its length.
  const order = { public: 0, service: 1, guest: 2, private: 3, deep: 4 } as const;
  planned = planned
    .map((room, n) => ({ room, n }))
    .sort((a, b) => order[a.room.zone] - order[b.room.zone] || a.n - b.n)
    .map((each) => each.room);
  const start = entrance.x >= 0 ? entrance : { x: frame.linkX[0] ?? cx, y: linkRow };
  const near = (region: SiteRect) =>
    Math.abs(region.x + region.w / 2 - start.x) + Math.abs(region.y + region.h / 2 - start.y);
  usable.sort((a, b) => near(a) - near(b));
  const held = usable.map(() => [] as SitePlanRoom[]);
  const capacity = (region: SiteRegion) => Math.max(1, Math.floor(along(region) / 3));
  const fits = (n: number, room: SitePlanRoom) =>
    (held[n]!.length + 1) * 4 - 1 <= along(usable[n]!) &&
    held[n]!.reduce((sum, each) => sum + each.size, 0) + room.size <= capacity(usable[n]!);
  const total = planned.reduce((sum, room) => sum + room.size, 0);
  const room0 = usable.reduce((sum, region) => sum + capacity(region), 0);
  let at = 0;
  for (const room of planned) {
    const share = (n: number) => Math.ceil((total * capacity(usable[n]!)) / Math.max(1, room0));
    while (at < usable.length - 1 && held[at]!.reduce((sum, each) => sum + each.size, 0) + room.size > share(at)) at++;
    let n = fits(at, room) ? at : usable.findIndex((_, k) => fits(k, room));
    if (n < 0 && room.heart) {
      // The heart always fits: a room made for it is never dropped.
      n = held.reduce((best, rooms, k) => (rooms.length > held[best]!.length ? k : best), 0);
      held[n]!.splice(-1, 1);
    }
    if (n >= 0) held[n]!.push(room);
  }
  // Rooms never stretch past a sensible width: what is left of a region is spare rooms (box rooms, empty
  // stores), left to squatters; a region with no room of the plan's is one or more of them.
  const widest = (room: SitePlanRoom) => 4 + room.size * 3;
  let spares = 0;
  for (const [n, region] of usable.entries()) {
    const rooms = held[n]!;
    const spare = () => along(region) + 1 - rooms.reduce((sum, each) => sum + widest(each) + 1, 0);
    let added = 0;
    while ((spare() >= 5 || !rooms.length) && added < 4) {
      rooms.push({
        name: `${SPARE_ROOM_NAMES[plan.template]}${spares ? ` ${spares + 1}` : ""}`,
        use: "squat",
        size: 1,
        zone: "service",
        furniture: [],
      });
      added++;
      spares++;
    }
  }
  const rooms: DungeonRoom[] = [];
  const info: SiteLevelMap["rooms"] = [];
  /** Each room's door, the side it opens on (none for a great room or a court) and whether it is locked. */
  const doors: Array<{ x: number; y: number; room: number; locked: boolean } | null> = [];
  const opens: Array<SiteSide | null> = [];
  const roomOf = new Map<SitePlanRoom, number>();
  const add = (room: SitePlanRoom, area: SiteRect, door: { x: number; y: number } | null, side: SiteSide | null) => {
    const n = rooms.length;
    roomOf.set(room, n);
    rooms.push(area);
    carve(area);
    info.push({ name: room.name, use: room.use, ...(room.heart ? { heart: true as const } : {}) });
    if (door) ground[cell(door.x, door.y)] = "floor";
    doors.push(door ? { ...door, room: n, locked: !!room.locked } : null);
    opens.push(side);
    return n;
  };
  for (const { room, rect: area } of special) add(room, area, null, null);
  for (const [n, region] of usable.entries()) {
    const L = along(region);
    const D = deep(region);
    // Columns: a small room in a deep region stands behind the room before it, through that room (a
    // dressing room behind a bedroom, a vault behind the wine cellar), so not every room is a strip.
    const columns: Array<{ front: SitePlanRoom; back?: SitePlanRoom }> = [];
    for (const room of held[n]!) {
      const before = columns.at(-1);
      if (room.size === 1 && D >= 7 && before && !before.back && !before.front.locked && before.front.size > 1)
        before.back = room;
      else columns.push({ front: room });
    }
    // A deep room now and then has a closet or a store behind it, so a row of rooms is not all strips.
    for (const column of columns)
      if (!column.back && D >= 8 && !column.front.locked && column.front.use !== "squat" && random() < 0.45)
        column.back = {
          name: `${SPARE_ROOM_NAMES[plan.template]}${spares++ ? ` ${spares}` : ""}`,
          use: "squat",
          size: 1,
          zone: "service",
          furniture: [],
        };
    const walls = columns.length - 1;
    const weight = columns.reduce((sum, column) => sum + column.front.size, 0);
    // Widths by size, at least 3 each (2 in a short region), the last taking what is left; trimmed from
    // the widest to fit.
    const least = Math.min(3, Math.floor((L - walls) / columns.length));
    const widths = columns.map((column) => Math.max(least, Math.floor(((L - walls) * column.front.size) / weight)));
    while (widths.reduce((sum, w) => sum + w, 0) > L - walls) {
      const most = widths.indexOf(Math.max(...widths));
      if (widths[most]! <= least) break;
      widths[most]!--;
    }
    widths[widths.length - 1] = L - walls - widths.slice(0, -1).reduce((sum, w) => sum + w, 0);
    let u = 0;
    for (const [k, column] of columns.entries()) {
      const w = widths[k]!;
      if (w < 2) break;
      const backD = column.back ? Math.floor((D - 1) / 2) : 0;
      const frontD = D - (backD ? backD + 1 : 0);
      const door = place(region, u + Math.floor(random() * w), -1, 1, 1);
      add(column.front, place(region, u, 0, w, frontD), { x: door.x, y: door.y }, region.door);
      // A ruined room: its wall to the way breached.
      if (column.front.ruined && !column.front.locked)
        for (let j = 0; j < w; j++)
          if (random() < 0.4) {
            const breach = place(region, u + j, -1, 1, 1);
            ground[cell(breach.x, breach.y)] = "floor";
          }
      if (column.back) {
        const inner = place(region, u + Math.floor(random() * w), frontD, 1, 1);
        add(column.back, place(region, u, frontD + 1, w, backD), { x: inner.x, y: inner.y }, region.door);
      }
      u += w + 1;
    }
  }
  // Doors between rooms side by side, now and then, so not every room is a dead end; never into a
  // locked one, a great room or a court.
  for (let a = 0; a < rooms.length; a++)
    for (let c = 0; c < rooms.length; c++) {
      const [one, two] = [rooms[a]!, rooms[c]!];
      if (!doors[a] || !doors[c] || doors[a]!.locked || doors[c]!.locked) continue;
      if (one.x + one.w + 1 === two.x) {
        const [y0, y1] = [Math.max(one.y, two.y), Math.min(one.y + one.h, two.y + two.h) - 1];
        if (y1 < y0 || random() >= 0.3) continue;
        ground[cell(one.x + one.w, y0 + Math.floor(random() * (y1 - y0 + 1)))] = "floor";
      } else if (one.y + one.h + 1 === two.y) {
        const [x0, x1] = [Math.max(one.x, two.x), Math.min(one.x + one.w, two.x + two.w) - 1];
        if (x1 < x0 || random() >= 0.3) continue;
        ground[cell(x0 + Math.floor(random() * (x1 - x0 + 1)), one.y + one.h)] = "floor";
      }
    }
  // A great room's pillars, in two rows down a hall five wide (aisles along its walls); never on a link.
  const links: SiteLevelLink[] = [];
  for (const link of plan.links) {
    if (link.upper !== index && link.lower !== index) continue;
    const x = Math.min(right - 1, Math.max(left + 1, frame.linkX[plan.links.indexOf(link)]!));
    links.push({ x, y: linkRow, level: link.upper === index ? link.lower : link.upper, kind: link.kind });
  }
  if (scheme === "hall" && frame.hallH >= 5) {
    const hall = ways[0]!;
    for (const y of [hall.y + 1, hall.y + 3])
      for (let x = hall.x + 2; x < hall.x + hall.w - 2; x += 3)
        if (!links.some((link) => link.x === x && link.y === y)) ground[cell(x, y)] = "wall";
  }
  // The way in, on the level the party comes in on: a door in the outer wall.
  if (entry) {
    ground[cell(entrance.x, entrance.y)] = "floor";
    props[cell(entrance.x, entrance.y)] = DUNGEON_EXIT_PROP;
  } else {
    // Without a way in, the party arrives at the first link (the way it came by is set by the caller).
    const first = links[0];
    if (first) entrance = { x: first.x, y: first.y };
  }
  // Solid with nothing open beside it is not wall but the land round the building (or a court's sky).
  const solid = ground.map((g, i) => {
    if (g !== "wall") return false;
    const [x, y] = [i % mapW, Math.floor(i / mapW)];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
        if (ground[cell(nx, ny)] !== "wall" && ground[cell(nx, ny)] !== "rock") return false;
      }
    return true;
  });
  for (const [i, inside] of solid.entries()) if (inside) ground[i] = "rock";
  // Flooded: water across the rooms' middles, never cutting a room off from its door.
  if (level.flooded)
    for (const area of rooms) {
      if (area.w < 3 || area.h < 3) continue;
      for (let y = area.y + 1; y < area.y + area.h - 1; y++)
        for (let x = area.x + 1; x < area.x + area.w - 1; x++)
          if (ground[cell(x, y)] === "floor" && random() < 0.7) ground[cell(x, y)] = "liquid";
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
    const backCell = (): [number, number] => {
      const [x, y] = [area.x + Math.floor(random() * area.w), area.y + Math.floor(random() * area.h)];
      switch (side) {
        case "N":
          return [x, area.y + area.h - 1];
        case "S":
          return [x, area.y];
        case "W":
          return [area.x + area.w - 1, y];
        case "E":
          return [area.x, y];
        default:
          return [x, y];
      }
    };
    for (const [k, slot] of room.furniture.entries()) {
      for (let tries = 0; tries < 6; tries++) {
        const [x, y] =
          k === 0 || Math.min(area.w, area.h) < 3
            ? backCell()
            : [area.x + Math.floor(random() * area.w), area.y + Math.floor(random() * area.h)];
        if (put(slot, x, y)) break;
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
      const area = target < 0 ? ways[Math.floor(random() * ways.length)]! : rooms[target]!;
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
  // A building faces either way: the whole of it turned left for right, the same on every level.
  if (frame.mirror) {
    const flip = (x: number) => mapW - 1 - x;
    for (let y = 0; y < mapH; y++) {
      const row = y * mapW;
      for (let x = 0; x < mapW / 2 - 0.5; x++) {
        const [a, b] = [row + x, row + flip(x)];
        [ground[a], ground[b]] = [ground[b]!, ground[a]!];
        [props[a], props[b]] = [props[b]!, props[a]!];
      }
    }
    for (const area of rooms) area.x = mapW - area.x - area.w;
    for (const each of [entrance, ...links, ...locks, ...traps]) each.x = flip(each.x);
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
