// ──────────────────────────────────────────────
// The World tab (worldgen W7): the world as the party knows it, for the player. Only what the party
// could know: the news that has reached it, the trouble brewing that it has heard of, its own deeds and
// standing, and the past any local would tell; never the Game Master's own notes (trouble the party has
// not heard of, pending ids, holds). The world's own words are given as the Game Master reads them;
// the bands are for the screen to name in its own language.
// ──────────────────────────────────────────────
import { worldDayPlural, worldPlaceByName, type GameWorld } from "./game-world.js";
import { worldHistory, worldHistoryLine, worldNotablePast } from "./history.js";
import {
  worldAddedPlace,
  worldBrewingNear,
  worldNewsHere,
  worldRenown,
  worldRenownBand,
  worldStandingBand,
  type WorldPresent,
  type WorldRenownBand,
  type WorldStandingBand,
} from "./ledger.js";
import type { WorldPlace } from "./compile.js";

export interface WorldJournal {
  /** The party's place and the places it is in, innermost first. */
  where: string[];
  renown: WorldRenownBand;
  /** The groups the party has dealt with, the strongest feelings first. */
  standing: Array<{ group: string; band: WorldStandingBand }>;
  /** What the party has done, latest last. */
  deeds: Array<{ place: string; text: string }>;
  /** The news that has reached the party, newest first: how many of the setting's days ago (`day`, `days`:
   *  its own word for one and for several), for the screen to say in its own language. */
  news: Array<{ ago: number; day: string; days: string; text: string; rumour: boolean }>;
  /** Trouble brewing that the party has heard of: who, for how many weeks, and whether it could come to
   *  blows any week now. */
  brewing: Array<{ groups: [string, string]; weeks: number; close: boolean }>;
  /** The past any local would tell, oldest first. */
  past: string[];
  /** The world's story's objectives the player can see (worldgen W10), when it has a story. */
  story?: import("./story.js").StoryObjective[];
  /** The story's clocks the player can see (Capability API 1.342). */
  clocks?: import("./story.js").StoryClock[];
  /** The ending the story has had (Capability API 1.343), once it has. */
  ending?: { id: string; title: string; epilogue: string };
  /** The game's Experience track for here (Capability API 1.345): null when none applies. Left out for a
   *  game without Experience music. */
  music?: string | null;
}

/** How many of each the tab shows. */
const DEEDS = 20;
const NEWS = 10;
const PAST = 8;

/** The world as the party knows it, where the party is (`name`: the place last said; none: where the
 *  world starts the party). */
export function worldJournal(game: GameWorld, present: WorldPresent, at: { name?: string }): WorldJournal {
  const { world, kit } = game;
  const byId = new Map(world.places.map((place) => [place.id, place]));
  const named = at.name ? worldPlaceByName(world, at.name) : byId.get(world.startId);
  // A place the story added counts as inside the world place it was added in.
  const added = !named && at.name ? worldAddedPlace(game, present, at.name) : undefined;
  const place = named ?? added?.within;
  const chain: WorldPlace[] = [];
  for (let up = place; up; up = up.parentId ? byId.get(up.parentId) : undefined) chain.push(up);
  const home = chain.find((each) => each.rank !== undefined);
  const nameOf = (id: string) => byId.get(id)?.name ?? present.places.find((each) => each.id === id)?.name ?? undefined;

  return {
    where: [...(added ? [added.place.name] : at.name && !place ? [at.name] : []), ...chain.map((each) => each.name)],
    renown: worldRenownBand(worldRenown(present)),
    standing: Object.entries(present.standing)
      .filter(([group]) => !present.gone.includes(group))
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .map(([group, value]) => ({ group, band: worldStandingBand(value) })),
    deeds: present.deeds
      .flatMap(({ placeId, text }) => {
        const where = nameOf(placeId);
        return where ? [{ place: where, text }] : [];
      })
      .slice(-DEEDS),
    news: worldNewsHere(game, present, home?.id, NEWS).map(({ news, ago, rumour }) => ({
      ago,
      day: kit.calendar.day,
      days: worldDayPlural(kit.calendar.day),
      text: news.text,
      rumour,
    })),
    brewing: worldBrewingNear(game, present, home?.id)
      .filter((each) => each.heard)
      .map(({ pending, weeks, ripe }) => ({
        groups: [pending.groups[0], pending.groups[1]] as [string, string],
        weeks,
        close: ripe,
      })),
    past: worldNotablePast(worldHistory(game), PAST).map(worldHistoryLine),
  };
}
