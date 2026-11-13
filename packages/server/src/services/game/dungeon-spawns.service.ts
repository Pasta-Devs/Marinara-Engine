// Dungeon spawns in a game (location spawns, 2026-11-13): the site of the map the party is on, its areas'
// foes now, and what the game keeps of it (its band, set the first time the party went in, and what the
// party cleared). Only Classic Marinara games without a ruleset have them: the rosters are bestiary foes.

import {
  dungeonAreaFoesNow,
  dungeonAreaNumberAt,
  dungeonAreas,
  dungeonFallbackRegionBand,
  dungeonRosterWords,
  dungeonSiteBand,
  dungeonSiteFate,
  dungeonSiteFor,
  dungeonSiteOrigin,
  gameDungeonMapFromMetadata,
  gameDungeonSiteKey,
  gameDungeonSitesFromMetadata,
  gameDungeonSitesWith,
  dungeonSiteAfterWin,
  marinaraBestiarySetting,
  readMarinaraCardProgression,
  worldHistory,
  worldPlaceByName,
  worldSiteAnchor,
  type DungeonArea,
  type DungeonSite,
  type GameDungeonMap,
  type GameDungeonSiteState,
  type GameWorld,
  type MarinaraBestiarySetting,
  type MarinaraEncounterFoe,
} from "@marinara-engine/shared";

export interface DungeonSiteHere {
  key: string;
  map: GameDungeonMap;
  setting: MarinaraBestiarySetting;
  site: DungeonSite;
  areas: DungeonArea[];
  state: GameDungeonSiteState;
  /** Whether `state` is new and not yet kept on the game. */
  fresh: boolean;
}

/** The setting whose bestiary a game's dungeons draw from, or null for a game they have none in (no
 *  Classic classes, or a ruleset of its own). */
export function dungeonSpawnSetting(
  meta: Record<string, unknown>,
  setup: Record<string, unknown> | null | undefined,
): MarinaraBestiarySetting | null {
  if (setup?.marinaraClasses !== true || meta.gameRuleset) return null;
  const kit = meta.gameWorldKit as { id?: unknown } | undefined;
  return marinaraBestiarySetting(
    typeof kit?.id === "string" ? kit.id : null,
    typeof setup.genre === "string" ? setup.genre : null,
  );
}

/** The game's day, for cleared areas. */
export function gameDay(meta: Record<string, unknown>): number {
  const day = (meta.gameTime as { day?: unknown } | undefined)?.day;
  return typeof day === "number" && Number.isFinite(day) ? Math.floor(day) : 1;
}

/** The party's average Classic level, or undefined with nobody on a Classic card. */
export function gamePartyLevel(meta: Record<string, unknown>): number | undefined {
  const levels = (Array.isArray(meta.gameCharacterCards) ? meta.gameCharacterCards : []).flatMap(
    (card: Record<string, unknown>) => {
      const progression = readMarinaraCardProgression(card.marinara);
      return progression && !progression.fallen ? [progression.level] : [];
    },
  );
  return levels.length ? levels.reduce((sum: number, one: number) => sum + one, 0) / levels.length : undefined;
}

/**
 * A new site's state: its band from the land where it lies (the site's own place, else where the party
 * stands on the overworld, else where the game began) and how it fell. Set once and kept: the band never
 * moves after.
 */
export function newDungeonSiteState(
  world: GameWorld | null,
  map: GameDungeonMap,
  partyPlace: string | undefined,
  partyLevel: number | undefined,
): GameDungeonSiteState {
  const origin = dungeonSiteOrigin(map.set, map.name);
  const place =
    (map.place ? world?.world.places.find((each) => each.id === map.place) : undefined) ??
    (world ? worldPlaceByName(world.world, map.name) : undefined);
  const at =
    place?.at ??
    (world ? worldPlaceByName(world.world, partyPlace)?.at : undefined) ??
    (world ? world.world.places.find((each) => each.id === world.world.startId)?.at : undefined);
  // With no world to read, the land is where the party first found the place.
  const region =
    world && at
      ? dungeonFallbackRegionBand(world.world, at)
      : { low: Math.max(1, Math.round(partyLevel ?? 1)), high: Math.max(1, Math.round(partyLevel ?? 1)) + 3 };
  const anchor = world && place ? worldSiteAnchor(world, place) : undefined;
  const fate = world ? dungeonSiteFate(worldHistory(world), map.name, anchor?.id) : undefined;
  return { band: dungeonSiteBand(origin, region), ...(fate ? { fate } : {}), cleared: {} };
}

/** The site of the map the party is on, with its areas and state; null when there is none to have foes. */
export function dungeonSiteHere(input: {
  meta: Record<string, unknown>;
  setup: Record<string, unknown> | null | undefined;
  world: GameWorld | null;
  partyPlace?: string;
}): DungeonSiteHere | null {
  const map = gameDungeonMapFromMetadata(input.meta);
  if (!map || map.hand || !map.rooms.length) return null;
  const setting = dungeonSpawnSetting(input.meta, input.setup);
  if (!setting) return null;
  const key = gameDungeonSiteKey(map);
  const kept = gameDungeonSitesFromMetadata(input.meta)[key];
  const state = kept ?? newDungeonSiteState(input.world, map, input.partyPlace, gamePartyLevel(input.meta));
  const site = dungeonSiteFor({
    setId: map.set,
    name: map.name,
    setting,
    band: state.band,
    ...(state.fate ? { fate: state.fate } : {}),
    seed: map.seed,
  });
  if (!site) return null;
  return { key, map, setting, site, areas: dungeonAreas(map, site, setting), state, fresh: !kept };
}

/** The foes in the area the party stands in now, and which area it is; none in a passage. */
export function dungeonFoesHere(
  here: DungeonSiteHere,
  today: number,
): { area: DungeonArea; foes: MarinaraEncounterFoe[] } | null {
  const number = dungeonAreaNumberAt(here.map, here.map.at);
  const area = here.areas.find((each) => each.area === number);
  if (!area) return null;
  const foes = dungeonAreaFoesNow(area, here.site, here.setting, here.state, today);
  return foes.length ? { area, foes } : null;
}

/** The fight setup's instruction for a fight in a held area: these foes and no others. */
export function dungeonFightPromptText(here: DungeonSiteHere, foes: readonly MarinaraEncounterFoe[]): string {
  return `This fight is in ${here.map.name}, and the place decides who is fighting: ${dungeonRosterWords(foes, here.setting)}. The enemies are exactly these, each with its family id, tier and level as listed; add none, drop none, and write them as the story sees them.`;
}

/** A fight in a dungeon area, kept on the game from its start to its end: which site and area it was. */
export interface GameDungeonFight {
  key: string;
  area: number;
}

export function gameDungeonFightFromMetadata(meta: Record<string, unknown>): GameDungeonFight | null {
  const raw = meta.gameDungeonFight as Partial<GameDungeonFight> | null | undefined;
  return raw && typeof raw.key === "string" && typeof raw.area === "number" ? { key: raw.key, area: raw.area } : null;
}

/**
 * What a dungeon fight's end changes on the game: won, its area is cleared (and a heart's leader dead, its
 * holders displaced when they scatter); any end forgets the fight. Empty when no dungeon fight was on.
 */
export function dungeonFightEndPatch(
  meta: Record<string, unknown>,
  outcome: string | undefined,
): Record<string, unknown> {
  const fight = gameDungeonFightFromMetadata(meta);
  if (!fight) return {};
  const patch: Record<string, unknown> = { gameDungeonFight: null };
  if (outcome !== "victory") return patch;
  const here = dungeonSiteHere({
    meta,
    setup: meta.gameSetupConfig as Record<string, unknown> | undefined,
    world: null,
  });
  if (!here || here.key !== fight.key || here.fresh) return patch;
  const area = here.areas.find((each) => each.area === fight.area);
  if (!area) return patch;
  patch.gameDungeonSites = gameDungeonSitesWith(
    gameDungeonSitesFromMetadata(meta),
    here.key,
    dungeonSiteAfterWin(here.state, here.site, area, gameDay(meta)),
  );
  return patch;
}
