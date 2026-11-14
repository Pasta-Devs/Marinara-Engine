// ──────────────────────────────────────────────
// Who lives in a dungeon (location spawns, 2026-11-13): a site's foes are fixed by the world, never by the
// party. Each generated map gets a site record (what kind of place it is, how it fell, the foes that hold
// it and the ones that squat in it, and a level band set once, when the party first goes in), and each of
// its areas a roster rolled from that record: guard posts and the heart for the holders, the rest for the
// squatters or nobody. The Game Master narrates the rosters and may not swap them; a fight in an area is
// fought by its roster at the site's levels. A cleared area stays empty for three days, then squatters move
// back in; the heart's leader, once dead, stays dead. Maps made by hand have no rosters: their author
// writes who is there. Pure and seeded: the same site and map always roll the same foes.
// ──────────────────────────────────────────────
import { z } from "zod";
import {
  MARINARA_BESTIARY,
  MARINARA_TIER_RULES,
  marinaraEnemyFamily,
  marinaraEnemyName,
  marinaraFitEncounter,
  type MarinaraBestiarySetting,
  type MarinaraEncounterFoe,
  type MarinaraEnemyFamily,
  type MarinaraHabitat,
} from "../marinara-bestiary.js";
import type { MarinaraEnemyTier } from "../marinara-combat.js";
import { MARINARA_LEVEL_CAP, marinaraRandom } from "../marinara-classes.js";
import {
  DUNGEON_SETS,
  dungeonFromGameDungeonMap,
  dungeonWalkable,
  gameDungeonMapForFloor,
  type GameDungeonMap,
} from "./dungeon-map.js";
import {
  SITE_LOCK_PROP,
  gameDungeonPlannedMap,
  sitePlanInputFor,
  siteTemplateForSet,
  type SiteTerrain,
} from "./site-plans.js";
import type { WorldHistory } from "./history.js";

/** What kind of place a site is, which decides who holds it. */
export const DUNGEON_SITE_ORIGINS = [
  "cave",
  "mine",
  "crypt",
  "ruin",
  "sewer",
  "station",
  "manor",
  "keep",
  "temple",
] as const;
export type DungeonSiteOrigin = (typeof DUNGEON_SITE_ORIGINS)[number];

/** How a site (or the town it lies by) fell, from the world's history: it decides who moved in. */
export const DUNGEON_SITE_FATES = ["war", "sickness", "famine", "flood"] as const;
export type DungeonSiteFate = (typeof DUNGEON_SITE_FATES)[number];

export interface DungeonLevelBand {
  low: number;
  high: number;
}

export interface DungeonSite {
  origin: DungeonSiteOrigin;
  fate?: DungeonSiteFate;
  band: DungeonLevelBand;
  /** The family that holds the place: its guard posts and its heart. */
  holder: string;
  /** Who leads the holders in the heart, when it is another family (a captain over sellswords). */
  leader?: string;
  /** Families that squat in the rest of it. */
  squatters: string[];
}

export type DungeonAreaRole = "entry" | "guard" | "lair" | "empty" | "rest" | "heart";

export interface DungeonArea {
  /** The map's area number (1-based, as the Game Master's prompt counts them). */
  area: number;
  /** Where its clearing is kept (dungeonAreaKey). */
  key: string;
  /** The way down to the next floor stands in it: the holders guard it. */
  wayDown?: true;
  role: DungeonAreaRole;
  level: number;
  foes: MarinaraEncounterFoe[];
}

/** How many in-game days a cleared area stays empty before squatters move back in. */
export const DUNGEON_REFILL_DAYS = 3;

/** How far each kind of place sits above the land around it. */
const ORIGIN_OFFSET: Record<DungeonSiteOrigin, number> = {
  cave: 0,
  mine: 0,
  sewer: 0,
  crypt: 1,
  ruin: 1,
  station: 1,
  manor: 1,
  keep: 1,
  temple: 1,
};
/** How many levels a site's band spans, from its first room to its heart. */
const BAND_SPAN = 4;

/** The habitats a kind of place takes its squatters from. */
const ORIGIN_HABITATS: Record<DungeonSiteOrigin, readonly MarinaraHabitat[]> = {
  cave: ["underground"],
  mine: ["underground"],
  crypt: ["ruins", "underground"],
  ruin: ["ruins"],
  sewer: ["urban", "underground"],
  station: ["ruins", "urban"],
  manor: ["urban", "ruins"],
  keep: ["ruins"],
  temple: ["ruins"],
};

/** Who holds each kind of place, best fit first; the first few the setting has at the band are drawn from. */
const HOLDERS: Record<DungeonSiteOrigin, readonly string[]> = {
  cave: ["great-beast", "stalker", "lout", "serpent", "gel", "drake"],
  mine: ["clay-spirit", "warder", "lout", "edge-spirit", "gel"],
  crypt: ["bones", "grave-duelist", "shade", "gorger", "night-courtier", "cultist"],
  ruin: ["cultist", "sellsword", "shade", "warder", "fiend", "cutpurse"],
  sewer: ["gnawer", "gel", "cutpurse", "stinger"],
  station: ["drone", "turret", "warder", "shooter", "adept"],
  manor: ["cutpurse", "cultist", "sellsword", "shade", "night-courtier"],
  keep: ["sellsword", "shieldbearer", "grave-duelist", "lout", "bones"],
  temple: ["cultist", "adept", "fiend", "shade", "warder"],
};
/** Undead holders for a building that grew a crypt for them (a vampire's mansion, a dead lord's keep). */
const UNDEAD_HOLDERS = ["night-courtier", "grave-duelist", "gorger", "shade", "bones"] as const;
/** Who a fall leaves behind: a ruin or crypt that fell this way is held by these first. */
const FATE_HOLDERS: Record<DungeonSiteFate, readonly string[]> = {
  war: ["sellsword", "bones", "grave-duelist", "cutpurse"],
  sickness: ["gorger", "bones", "shade"],
  famine: ["bones", "gnawer", "shade"],
  flood: ["tide-spirit", "gel", "serpent"],
};
/** Who squats in each kind of place first, before any vermin or beast. */
const SQUATTERS: Record<DungeonSiteOrigin, readonly string[]> = {
  cave: ["stinger", "serpent", "raptor", "gnawer"],
  mine: ["gnawer", "stinger", "clay-spirit", "gel"],
  crypt: ["bones", "gorger", "gnawer", "shade"],
  ruin: ["thornling", "stinger", "gnawer", "serpent", "bones"],
  sewer: ["gnawer", "gel", "serpent", "stinger"],
  station: ["drone", "gnawer", "gel"],
  manor: ["gnawer", "stinger", "shade", "gel"],
  keep: ["gnawer", "raptor", "bones", "stinger"],
  temple: ["gnawer", "thornling", "shade", "stinger"],
};
/** A cave's own look calls its holder: a lava cave the fire spirits, an ice cave the frost ones. */
const SET_HOLDERS: Partial<Record<string, readonly string[]>> = {
  cave_lava: ["cinder-spirit", "drake"],
  cave_ice: ["rime-spirit", "great-beast"],
  cave_crystal: ["edge-spirit", "clay-spirit"],
};

/** The kind of place a generated map is, by its set and name. */
export function dungeonSiteOrigin(setId: string, name = ""): DungeonSiteOrigin {
  const set = DUNGEON_SETS.find((each) => each.id === setId);
  const words = name.toLowerCase();
  if (set?.kind === "station") return "station";
  if (/\b(mines?|mineshaft|quarr(y|ies)|delve|adits?)\b/u.test(words)) return "mine";
  if (setId === "dungeon_sewer") return "sewer";
  if (setId === "dungeon_crypt") return "crypt";
  if (setId === "dungeon_temple") return "ruin";
  if (setId === "building_manor") return "manor";
  if (setId === "building_keep") return "keep";
  if (setId === "building_temple") return "temple";
  return "cave";
}

/** How a place fell, read from the history's severe events that name it or the town it lies by, the
 *  latest first. None for a place history never touched. */
export function dungeonSiteFate(
  history: Pick<WorldHistory, "events"> | null | undefined,
  name: string,
  nearId?: string,
): DungeonSiteFate | undefined {
  if (!history) return undefined;
  const own = name.toLowerCase();
  const touched = history.events
    .filter(
      (event) => event.severe && (event.text.toLowerCase().includes(own) || (nearId && event.places.includes(nearId))),
    )
    .sort((a, b) => a.yearsAgo - b.yearsAgo);
  for (const event of touched) {
    const text = event.text.toLowerCase();
    if (/\bflood/u.test(text)) return "flood";
    if (/\b(plague|sickness|pox|fever)\b/u.test(text)) return "sickness";
    if (/\b(famine|drought|dry spell)\b/u.test(text)) return "famine";
    if (event.kind === "conflict" || /\b(war|destroyed|sacked|razed)\b/u.test(text)) return "war";
    if (/\babandoned\b/u.test(text)) {
      // Abandoned "after it": the woe before it in the same year.
      const before = history.events.find(
        (other) => other.yearsAgo === event.yearsAgo && other !== event && other.kind === "catastrophe",
      );
      const was = before?.text.toLowerCase() ?? "";
      return /\bplague|sickness/u.test(was) ? "sickness" : "famine";
    }
  }
  return undefined;
}

/** How many floors each kind of place has, at least and at most (owner 2026-11-13: separate maps). */
const ORIGIN_FLOORS: Record<DungeonSiteOrigin, readonly [number, number]> = {
  cave: [1, 2],
  mine: [2, 3],
  crypt: [2, 3],
  ruin: [1, 2],
  sewer: [1, 2],
  station: [1, 2],
  manor: [3, 5],
  keep: [3, 4],
  temple: [2, 3],
};
/** How many levels each floor down climbs. */
const FLOOR_RISE = 2;

/** How many floors a place has: by its kind, drawn from its seed. */
export function dungeonSiteFloors(origin: DungeonSiteOrigin, siteSeed: number): number {
  const [least, most] = ORIGIN_FLOORS[origin];
  return least + Math.floor(marinaraRandom(`${siteSeed}:floors`)() * (most - least + 1));
}

/** A site's band from the land around it: the region's band, the kind of place's offset on top, and two
 *  levels more for each floor below the first. */
export function dungeonSiteBand(origin: DungeonSiteOrigin, region: DungeonLevelBand, floors = 1): DungeonLevelBand {
  const deeper = FLOOR_RISE * Math.max(0, floors - 1);
  const low = Math.max(
    1,
    Math.min(MARINARA_LEVEL_CAP - BAND_SPAN - deeper, Math.round(region.low) + ORIGIN_OFFSET[origin]),
  );
  return { low, high: Math.min(MARINARA_LEVEL_CAP, low + BAND_SPAN + deeper) };
}

/**
 * A floor of a place laid out by its name (owner 2026-11-13: separate maps per floor): how many floors it
 * has follows from what kind of place it is and its seed, the same every time it is laid out.
 */
export function gameDungeonSiteMap(input: {
  setId: string;
  name: string;
  siteSeed: number;
  id: string;
  floor?: number;
  /** What the world says of a building laid out to a plan: how it fell, the land under it. */
  fate?: DungeonSiteFate;
  terrain?: SiteTerrain;
  /** The game's rules can find traps (a ruleset with a skill for it): a building has them. */
  traps?: boolean;
}): GameDungeonMap {
  // A building (a manor, a keep, a temple, a crypt) is laid out to a plan of the whole of it.
  const template = siteTemplateForSet(input.setId);
  if (template)
    return gameDungeonPlannedMap({
      plan: sitePlanInputFor({
        template,
        name: input.name,
        seed: input.siteSeed,
        ...(input.fate ? { fate: input.fate } : {}),
        ...(input.terrain ? { terrain: input.terrain } : {}),
      }),
      name: input.name,
      id: input.id,
      ...(input.traps ? { traps: true } : {}),
    });
  const floors = dungeonSiteFloors(dungeonSiteOrigin(input.setId, input.name), input.siteSeed);
  return gameDungeonMapForFloor({ ...input, floor: input.floor ?? 1, floors });
}

/** One floor's band within its site's: two levels deeper for each floor down. */
export function dungeonFloorBand(band: DungeonLevelBand, floor: number): DungeonLevelBand {
  const low = Math.min(band.high, band.low + FLOOR_RISE * Math.max(0, floor - 1));
  return { low, high: Math.min(band.high, low + BAND_SPAN) };
}

/** The key an area's clearing is kept under: its number on the first floor, "floor:area" below it. */
export function dungeonAreaKey(floor: number, area: number): string {
  return floor > 1 ? `${floor}:${area}` : String(area);
}

/** Whether a family can stand in a site at every level of its band, in the game's setting. */
function livesAt(family: MarinaraEnemyFamily, setting: MarinaraBestiarySetting, band: DungeonLevelBand): boolean {
  return (
    family.role !== "treasure" &&
    family.levels[0] <= band.low &&
    family.levels[1] >= band.high &&
    Boolean(marinaraEnemyName(family, setting, band.low)) &&
    Boolean(marinaraEnemyName(family, setting, band.high))
  );
}

/** A seeded pick, the earlier entries a little likelier. */
function pickLeaning<T>(items: readonly T[], random: () => number): T | undefined {
  if (!items.length) return undefined;
  const weights = items.map((_, index) => 1 / (index + 1));
  let roll = random() * weights.reduce((sum, one) => sum + one, 0);
  for (let index = 0; index < items.length; index++) if ((roll -= weights[index]!) <= 0) return items[index];
  return items.at(-1);
}

/**
 * A site's record: who holds it and who squats in it, at its band. Null when the setting has nobody who
 * could live there at that band (a band past every family's reach).
 */
export function dungeonSiteFor(input: {
  setId: string;
  name: string;
  setting: MarinaraBestiarySetting;
  band: DungeonLevelBand;
  fate?: DungeonSiteFate;
  /** The map's seed (or the game's seed for the site): the same site always draws the same foes. */
  seed: string | number;
  /** A building planned with a crypt for undead holders: the dead hold it. */
  undead?: boolean;
}): DungeonSite | null {
  const origin = dungeonSiteOrigin(input.setId, input.name);
  const random = marinaraRandom(`${input.seed}:site:${input.name.toLowerCase()}`);
  const fits = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const family = marinaraEnemyFamily(id);
      return family && livesAt(family, input.setting, input.band) ? [family.id] : [];
    });
  // A ruin or crypt that fell a known way is held by what the fall left; a cave by what its look calls.
  const preferred = [
    ...(input.undead ? UNDEAD_HOLDERS : []),
    ...((origin === "ruin" || origin === "crypt") && input.fate ? FATE_HOLDERS[input.fate] : []),
    ...(origin === "cave" ? (SET_HOLDERS[input.setId] ?? []) : []),
    ...HOLDERS[origin],
  ];
  let holders = fits([...new Set(preferred)]);
  // Nobody of the place's kind lives at this band in this setting: anyone whose habitat it is.
  if (!holders.length)
    holders = MARINARA_BESTIARY.filter(
      (family) =>
        family.role !== "swarm" &&
        family.habitats?.some((habitat) => ORIGIN_HABITATS[origin].includes(habitat)) &&
        livesAt(family, input.setting, input.band),
    ).map((family) => family.id);
  // A setting with no monsters for the place (a 1920s cave): people who hide there, smugglers and gangs.
  if (!holders.length) holders = fits(["sellsword", "cutpurse", "shooter", "brawler", "cultist"]);
  const holder = pickLeaning(holders.slice(0, 3), random);
  if (!holder) return null;
  const holderFamily = marinaraEnemyFamily(holder)!;
  // People follow a captain: a gang's or a band's heart is its chief with their own around them.
  const leader = holderFamily.kind === "humanoid" && holderFamily.role !== "leader" ? fits(["captain"])[0] : undefined;
  // Squatters: what moves into an empty hole, the place's own kind first (rats in a sewer, the dead in a
  // crypt), then vermin, beasts, oozes and plants, the rest after; within each, in the site's own order.
  const flavour = SQUATTERS[origin];
  const critter = (family: MarinaraEnemyFamily) => ["vermin", "beast", "ooze", "plant"].includes(family.kind);
  const order = new Map(MARINARA_BESTIARY.map((family) => [family.id, random()]));
  const squatters = MARINARA_BESTIARY.filter(
    (family) =>
      family.id !== holder &&
      family.id !== leader &&
      family.role !== "leader" &&
      family.role !== "healer" &&
      family.kind !== "humanoid" &&
      family.habitats?.some((habitat) => ORIGIN_HABITATS[origin].includes(habitat)) &&
      livesAt(family, input.setting, input.band),
  )
    .map((family) => ({
      id: family.id,
      score: (flavour.includes(family.id) ? 2 : 0) + (critter(family) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || order.get(a.id)! - order.get(b.id)!)
    .map((family) => family.id);
  const chosen: string[] = [];
  for (let tries = 0; tries < 6 && chosen.length < 2 && squatters.length; tries++) {
    const one = pickLeaning(squatters.slice(0, 4), random)!;
    if (!chosen.includes(one)) chosen.push(one);
  }
  return {
    origin,
    ...(input.fate ? { fate: input.fate } : {}),
    band: input.band,
    holder,
    ...(leader ? { leader } : {}),
    squatters: chosen,
  };
}

/** The tier a foe can take at a level, from the one asked down. */
function tierAt(family: MarinaraEnemyFamily, tier: MarinaraEnemyTier, level: number): MarinaraEnemyTier | null {
  const order: MarinaraEnemyTier[] = ["boss", "elite", "standard", "minion"];
  for (const each of order.slice(order.indexOf(tier)))
    if (family.tiers.includes(each) && level >= MARINARA_TIER_RULES[each].minLevel) return each;
  return null;
}

function group(familyId: string, tier: MarinaraEnemyTier, level: number, count: number): MarinaraEncounterFoe[] {
  const family = marinaraEnemyFamily(familyId);
  if (!family) return [];
  const at = tierAt(family, tier, level);
  return at ? Array.from({ length: count }, () => ({ familyId, tier: at, level })) : [];
}

/** A roster held to a fight's caps, sized for a party of four at its own level. */
function fitted(
  setting: MarinaraBestiarySetting,
  level: number,
  foes: MarinaraEncounterFoe[],
  difficulty: "normal" | "hard",
): MarinaraEncounterFoe[] {
  if (!foes.length) return [];
  return marinaraFitEncounter({ setting, party: { level, size: 4 }, foes, difficulty, fixedLevels: true }).foes;
}

/** A squatters' roster for an area: a few of one squatter family. */
function squatRoster(
  site: DungeonSite,
  setting: MarinaraBestiarySetting,
  level: number,
  random: () => number,
): MarinaraEncounterFoe[] {
  const squatter = site.squatters.length ? site.squatters[Math.floor(random() * site.squatters.length)]! : site.holder;
  const swarm = marinaraEnemyFamily(squatter)?.role === "swarm";
  return fitted(
    setting,
    level,
    random() < 0.5 || swarm
      ? group(squatter, "minion", level, 3 + Math.floor(random() * 2))
      : group(squatter, "standard", level, 1 + Math.floor(random() * 2)),
    "normal",
  );
}

/**
 * Each area of a generated map with its role and its foes. The entry (where the way in is) is always
 * empty; the area furthest in is the heart, held by the holder's strongest; areas past the halfway mark
 * are guard posts of the holders, the rest squatters' lairs or empty, and one empty area is a place to
 * rest. Levels climb from the band's low at the way in to its high in the heart. A map made by hand, or
 * with no areas, has none.
 */
export function dungeonAreas(map: GameDungeonMap, site: DungeonSite, setting: MarinaraBestiarySetting): DungeonArea[] {
  if (map.hand || !map.rooms.length) return [];
  if (map.site && map.roomInfo) return plannedAreas(map, site, setting);
  const floor = map.floor ?? 1;
  const deepest = floor >= (map.floors ?? 1);
  const band = dungeonFloorBand(site.band, floor);
  const cells = dungeonFromGameDungeonMap(map);
  // Steps from the way in to every cell.
  const steps = new Int32Array(cells.width * cells.height).fill(-1);
  const start = map.entrance.y * cells.width + map.entrance.x;
  steps[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const x = cell % cells.width;
    const y = (cell - x) / cells.width;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!dungeonWalkable(cells, nx, ny)) continue;
      const next = ny * cells.width + nx;
      if (steps[next] !== -1) continue;
      steps[next] = steps[cell]! + 1;
      queue.push(next);
    }
  }
  const distance = map.rooms.map((room) => {
    let best = -1;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        const at = steps[y * cells.width + x]!;
        if (at >= 0 && (best < 0 || at < best)) best = at;
      }
    return best;
  });
  const inside = (room: { x: number; y: number; w: number; h: number }) =>
    map.entrance.x >= room.x &&
    map.entrance.x < room.x + room.w &&
    map.entrance.y >= room.y &&
    map.entrance.y < room.y + room.h;
  const entry = Math.max(0, map.rooms.findIndex(inside));
  const far = Math.max(1, ...distance);
  const furthest = distance.reduce(
    (best, d, index) => (index !== entry && d > (distance[best] ?? -1) ? index : best),
    -1,
  );
  // The heart is on the deepest floor; above it, the furthest area is where the way down is, held.
  const heart = deepest ? furthest : -1;
  const downArea = map.down
    ? map.rooms.findIndex(
        (room) =>
          map.down!.x >= room.x &&
          map.down!.x < room.x + room.w &&
          map.down!.y >= room.y &&
          map.down!.y < room.y + room.h,
      )
    : -1;
  const random = marinaraRandom(`${map.seed}:areas:${site.holder}:${band.low}`);
  const levelAt = (index: number) =>
    Math.round(band.low + ((band.high - 1 - band.low) * Math.max(0, distance[index]!)) / far);
  const areas: DungeonArea[] = map.rooms.map((_, index) => {
    const level = index === heart ? band.high : levelAt(index);
    const area = index + 1;
    const key = dungeonAreaKey(floor, area);
    if (index === entry || distance[index]! < 0) return { area, key, role: "entry", level, foes: [] };
    if (index === downArea) {
      const foes = fitted(
        setting,
        level,
        group(site.holder, "standard", level, 2 + Math.floor(random() * 2)),
        "normal",
      );
      return { area, key, role: "guard", wayDown: true, level, foes };
    }
    if (index === heart) {
      const top = marinaraEnemyFamily(site.leader ?? site.holder)!;
      const head = group(top.id, top.tiers.includes("boss") ? "boss" : "elite", level, 1);
      const guard = group(site.holder, "standard", level, site.leader ? 2 : 1 + Math.floor(random() * 2));
      return { area, key, role: "heart", level, foes: fitted(setting, level, [...head, ...guard], "hard") };
    }
    const deep = distance[index]! / far >= 0.5;
    if (deep && random() < 0.75) {
      const foes = fitted(
        setting,
        level,
        group(site.holder, "standard", level, 2 + Math.floor(random() * 2)),
        "normal",
      );
      return { area, key, role: "guard", level, foes };
    }
    if (random() < 0.5) return { area, key, role: "lair", level, foes: squatRoster(site, setting, level, random) };
    return { area, key, role: "empty", level, foes: [] };
  });
  // One empty area (the one nearest halfway in) is quiet enough to rest in.
  const quiet = areas
    .filter((area) => area.role === "empty")
    .sort(
      (a, b) =>
        Math.abs(distance[a.area - 1]! / far - 0.5) - Math.abs(distance[b.area - 1]! / far - 0.5) || a.area - b.area,
    )[0];
  if (quiet) quiet.role = "rest";
  return areas;
}

// ── What the game keeps of a site ──

/** A site as the game keeps it: its band, set the first time the party went in, and what the party
 *  cleared (area number to the game day it was cleared). */
export const gameDungeonSiteStateSchema = z
  .object({
    band: z.object({ low: z.number().int().min(1).max(40), high: z.number().int().min(1).max(40) }).strict(),
    fate: z.enum(DUNGEON_SITE_FATES).optional(),
    /** Area keys (dungeonAreaKey: "5" on the first floor, "2:5" below) to the day each was cleared. */
    cleared: z.record(z.string().regex(/^(\d:)?\d{1,2}$/u), z.number().int().min(0)).default({}),
    /** The heart's leader is dead and stays dead. */
    leaderDead: z.literal(true).optional(),
    /** The holders are gone for good (owner 2026-11-13): people who lost their chief, or driven out by the
     *  story. Their posts stand empty or squatters take them, and they never come back. */
    displaced: z.literal(true).optional(),
  })
  .strict();
export type GameDungeonSiteState = z.infer<typeof gameDungeonSiteStateSchema>;

/** The key a map's site is kept under: its world place, else its name. */
export function gameDungeonSiteKey(map: Pick<GameDungeonMap, "place" | "name">): string {
  return map.place ?? `name:${map.name.trim().toLowerCase()}`;
}

/** At most this many sites are kept; the oldest go first. */
export const GAME_DUNGEON_SITES_MAX = 64;

export function gameDungeonSitesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, GameDungeonSiteState> {
  const raw = metadata?.gameDungeonSites;
  if (!raw || typeof raw !== "object") return {};
  const kept: Record<string, GameDungeonSiteState> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = gameDungeonSiteStateSchema.safeParse(value);
    if (parsed.success) kept[key] = parsed.data;
  }
  return kept;
}

/** The sites with one set or changed, the oldest dropped past the limit. */
export function gameDungeonSitesWith(
  sites: Record<string, GameDungeonSiteState>,
  key: string,
  state: GameDungeonSiteState,
): Record<string, GameDungeonSiteState> {
  const { [key]: _old, ...rest } = sites;
  const entries = [...Object.entries(rest), [key, state] as const];
  return Object.fromEntries(entries.slice(-GAME_DUNGEON_SITES_MAX));
}

/** How many levels a planned building's level is from the one it is entered on: its floor, for its band. */
export function dungeonPlannedFloor(map: GameDungeonMap): number {
  if (!map.site) return map.floor ?? 1;
  const entry = map.site.levels.findIndex((level) => level.depth === 0);
  return 1 + Math.abs(map.site.level - Math.max(0, entry));
}

/** A planned building's areas (building plans, 2026-11-14): who is in each room by what it is for. The
 *  heart is the plan's heart room; the holders keep their own rooms and their posts; squatters take the
 *  neglected ones; quiet rooms are safe to rest in. Levels further from the way in stand deeper in the band. */
function plannedAreas(map: GameDungeonMap, site: DungeonSite, setting: MarinaraBestiarySetting): DungeonArea[] {
  const level = map.site!.level;
  const band = dungeonFloorBand(site.band, dungeonPlannedFloor(map));
  const cells = dungeonFromGameDungeonMap(map);
  // Steps from where the party comes onto the level, through locked doors too.
  const passable = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cells.width || y >= cells.height) return false;
    const i = y * cells.width + x;
    return dungeonWalkable(cells, x, y) || (cells.ground[i] === "floor" && cells.props[i] === SITE_LOCK_PROP);
  };
  const steps = new Int32Array(cells.width * cells.height).fill(-1);
  const start = map.entrance.y * cells.width + map.entrance.x;
  steps[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const x = c % cells.width;
    const y = (c - x) / cells.width;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = (y + dy) * cells.width + x + dx;
      if (!passable(x + dx, y + dy) || steps[next] !== -1) continue;
      steps[next] = steps[c]! + 1;
      queue.push(next);
    }
  }
  const distance = map.rooms.map((room) => {
    let best = -1;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        const at = steps[y * cells.width + x]!;
        if (at >= 0 && (best < 0 || at < best)) best = at;
      }
    return best;
  });
  const far = Math.max(1, ...distance);
  const random = marinaraRandom(`${map.seed}:planned:${level}:${site.holder}:${band.low}`);
  const areas: DungeonArea[] = map.rooms.map((_, index) => {
    const info = map.roomInfo![index]!;
    const area = index + 1;
    const key = dungeonAreaKey(level + 1, area);
    const level_ = Math.round(band.low + ((band.high - 1 - band.low) * Math.max(0, distance[index]!)) / far);
    if (info.heart) {
      const top = marinaraEnemyFamily(site.leader ?? site.holder)!;
      const head = group(top.id, top.tiers.includes("boss") ? "boss" : "elite", band.high, 1);
      const guard = group(site.holder, "standard", band.high, site.leader ? 2 : 1 + Math.floor(random() * 2));
      return {
        area,
        key,
        role: "heart",
        level: band.high,
        foes: fitted(setting, band.high, [...head, ...guard], "hard"),
      };
    }
    const holders = () =>
      fitted(setting, level_, group(site.holder, "standard", level_, 2 + Math.floor(random() * 2)), "normal");
    switch (info.use) {
      case "post":
        return { area, key, role: "guard", level: level_, foes: holders() };
      case "holders":
        return random() < 0.75
          ? { area, key, role: "guard", level: level_, foes: holders() }
          : { area, key, role: "empty", level: level_, foes: [] };
      case "squat":
        return random() < 0.6
          ? { area, key, role: "lair", level: level_, foes: squatRoster(site, setting, level_, random) }
          : { area, key, role: "empty", level: level_, foes: [] };
      case "quiet":
        return { area, key, role: "rest", level: level_, foes: [] };
      case "open":
        return random() < 0.4
          ? { area, key, role: "lair", level: level_, foes: squatRoster(site, setting, level_, random) }
          : { area, key, role: "empty", level: level_, foes: [] };
      default:
        return random() < 0.3
          ? { area, key, role: "lair", level: level_, foes: squatRoster(site, setting, level_, random) }
          : { area, key, role: "empty", level: level_, foes: [] };
    }
  });
  return areas;
}

/** Whether a site's holders think and band together (people, cunning spirits): beaten in their heart, they
 *  scatter for good rather than breed back. Beasts, vermin and the mindless come back. */
export function dungeonHoldersScatter(site: DungeonSite): boolean {
  const mind = marinaraEnemyFamily(site.leader ?? site.holder)?.mind;
  return mind === "cunning" || mind === "tactical" || mind === "genius";
}

/**
 * The foes in an area now (owner 2026-11-13: places respawn after some days, unless their occupants were
 * displaced). Its roster until cleared; a cleared area stays empty DUNGEON_REFILL_DAYS days, then its
 * own come back, or squatters if the holders are gone (a fresh roll each time it was cleared). With the
 * holders displaced, their posts not yet cleared hold squatters or nobody. The heart, once cleared or its
 * leader dead, stays empty.
 */
export function dungeonAreaFoesNow(
  area: DungeonArea,
  site: DungeonSite,
  setting: MarinaraBestiarySetting,
  state: GameDungeonSiteState,
  today: number,
): MarinaraEncounterFoe[] {
  const cleared = state.cleared[area.key];
  const squat = (why: string) =>
    squatRoster(site, setting, area.level, marinaraRandom(`${area.key}:${why}:${site.holder}`));
  if (area.role === "heart") return cleared === undefined && !state.leaderDead && !state.displaced ? area.foes : [];
  if (cleared === undefined) {
    if (area.role !== "guard" || !state.displaced) return area.foes;
    return marinaraRandom(`${area.key}:left:${site.holder}`)() < 0.5 ? squat("left") : [];
  }
  if (area.role === "entry" || area.role === "rest") return [];
  if (today < cleared + DUNGEON_REFILL_DAYS) return [];
  if (area.role === "guard" && !state.displaced) return area.foes;
  return squat(`refill:${cleared}`);
}

/** A site's state after the party won the fight in an area: cleared that day, and a heart's leader dead,
 *  its holders displaced when they are ones to scatter. */
export function dungeonSiteAfterWin(
  state: GameDungeonSiteState,
  site: DungeonSite,
  area: Pick<DungeonArea, "key" | "role">,
  today: number,
): GameDungeonSiteState {
  const heart = area.role === "heart";
  return {
    ...state,
    cleared: { ...state.cleared, [area.key]: today },
    ...(heart ? { leaderDead: true as const } : {}),
    ...(heart && dungeonHoldersScatter(site)
      ? { displaced: true as const }
      : state.displaced
        ? { displaced: true as const }
        : {}),
  };
}

/** `[site: displaced]` in a reply: the story drove the holders of the map the party is on out (or they
 *  left); they never come back. */
export function readGameDungeonSiteTags(text: string): { displaced: boolean } {
  return { displaced: /\[site:\s*displaced\s*\]/iu.test(text) };
}

/** The area a cell is in (1-based), or 0 in a passage. */
export function dungeonAreaNumberAt(map: Pick<GameDungeonMap, "rooms">, at: { x: number; y: number }): number {
  return (
    map.rooms.findIndex(
      (room) => at.x >= room.x && at.x < room.x + room.w && at.y >= room.y && at.y < room.y + room.h,
    ) + 1
  );
}

/** A roster in words: "3 Mire Rats (minion, level 4), Bone Knight (boss, level 8)". */
export function dungeonRosterWords(foes: readonly MarinaraEncounterFoe[], setting: MarinaraBestiarySetting): string {
  const counted = new Map<string, number>();
  for (const foe of foes) {
    const family = marinaraEnemyFamily(foe.familyId);
    const name = (family && marinaraEnemyName(family, setting, foe.level)) ?? foe.familyId;
    const key = `${name} [${foe.familyId}] (${foe.tier}, level ${foe.level})`;
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  return [...counted].map(([key, count]) => (count > 1 ? `${count}x ${key}` : key)).join(", ");
}

const FATE_WORDS: Record<DungeonSiteFate, string> = {
  war: "war",
  sickness: "plague",
  famine: "famine",
  flood: "flood",
};

/**
 * What the Game Master is told of the site: who holds it, every area's foes now (the party has seen only
 * where it stands), and the rule that fights here are fought by these foes and no others.
 */
export function dungeonSpawnPromptText(input: {
  map: GameDungeonMap;
  site: DungeonSite;
  areas: readonly DungeonArea[];
  state: GameDungeonSiteState;
  setting: MarinaraBestiarySetting;
  today: number;
  partyLevel?: number;
}): string {
  const { map, site, setting } = input;
  if (!input.areas.length) return "";
  const holderFamily = marinaraEnemyFamily(site.holder);
  const holderName = (holderFamily && marinaraEnemyName(holderFamily, setting, site.band.low)) ?? site.holder;
  const here = dungeonAreaNumberAt(map, map.at);
  const floor = map.floor ?? 1;
  const floors = map.floors ?? 1;
  const floorBand = dungeonFloorBand(site.band, floor);
  const floorLine =
    floors > 1
      ? ` This is floor ${floor} of ${floors}, its foes levels ${floorBand.low}-${floorBand.high}; each floor down is deadlier.`
      : "";
  const lines = [
    input.state.displaced
      ? `WHO IS IN ${map.name.toUpperCase()}: a ${site.origin} once held by ${holderName}, who are gone for good; only squatters remain. Foes here are levels ${site.band.low}-${site.band.high}, fixed by the world and never by the party.${floorLine}`
      : `WHO IS IN ${map.name.toUpperCase()}: a ${site.origin} held by ${holderName}${
          site.fate ? `, since the ${FATE_WORDS[site.fate]} that touched it` : ""
        }; foes here are levels ${site.band.low}-${site.band.high}, fixed by the world and never by the party.${floorLine}`,
  ];
  for (const area of input.areas) {
    const foes = dungeonAreaFoesNow(area, site, setting, input.state, input.today);
    const role =
      area.role === "heart"
        ? " (the heart)"
        : area.wayDown
          ? " (the way down)"
          : area.role === "rest"
            ? " (quiet: safe to rest)"
            : "";
    const where = area.area === here ? " (the party is here)" : "";
    const who = foes.length
      ? dungeonRosterWords(foes, setting)
      : input.state.cleared[area.key] !== undefined
        ? "cleared"
        : "nobody";
    lines.push(`- Area ${area.area}${role}${where}: ${who}.`);
  }
  lines.push(
    "A fight in an area is fought by that area's foes exactly as listed, with their family ids, tiers and levels; never add, swap or level them, and never spawn a creature a player asks for that is not listed. Foes in other areas are unseen until the party goes there: hint at them (sounds, tracks, smells), never reveal them outright.",
  );
  if (!input.state.displaced)
    lines.push(
      `If the story drives ${holderName} out of this place for good (they flee, make peace and leave, are bought off), write [site: displaced]; they will not come back.`,
    );
  if (input.partyLevel !== undefined && input.partyLevel + 3 < site.band.low)
    lines.push(
      `This place is far beyond the party (level ${Math.round(input.partyLevel)}): show it plainly through the signs at its way in, and let them turn back.`,
    );
  return lines.join("\n");
}
