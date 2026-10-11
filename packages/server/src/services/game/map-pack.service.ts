// ──────────────────────────────────────────────
// Experience map packs (worldgen W9e): an Experience's own setting kit, ready-made worlds built with it
// and tile pack, read from the installed package through the same verification as every package asset,
// and checked as share files are. A game started with the Experience is locked to them.
// ──────────────────────────────────────────────
import {
  parseCreaturePack,
  parseTilePack,
  type CreaturePack,
  readWorldFile,
  readWorldKitFile,
  storyCapabilityMinor,
  storyMusicCues,
  storyCompanionsNamed,
  storyPerson,
  experiencePeopleImages,
  experiencePeopleMinor,
  readExperiencePeople,
  type ExperiencePeople,
  type GameWorld,
  compileGameWorld,
  gameWorldFromSnapshot,
  type ExperienceMapPack,
  type TilePack,
} from "@marinara-engine/shared";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";
import { cleanImageTilePack } from "./tile-pack-images.service.js";

/** Map pack tiles already checked, by package, version and the tiles file's hash; the oldest go first. */
const checkedTiles = new Map<string, TilePack>();
const CHECKED_TILES_KEPT = 8;
/** Map pack creature packs already checked, by package, version and file hash (their sheets are decoded
 *  to be checked); the oldest go first. */
const checkedCreatures = new Map<string, CreaturePack>();
const CHECKED_CREATURES_KEPT = 16;

/** Map pack people files already read, by package, version and file hash; the oldest go first. */
const checkedPeople = new Map<string, ExperiencePeople>();
const CHECKED_PEOPLE_KEPT = 16;

export type MapPack = ExperienceMapPack;

/** A map pack world as a game plays it. */
function packGameWorld(kit: MapPack["kit"], entry: MapPack["worlds"][number]): GameWorld {
  return entry.snapshot
    ? gameWorldFromSnapshot(entry.snapshot)
    : { kit, ...entry.world, world: compileGameWorld({ kit, ...entry.world }) };
}

function rememberPeople(key: string, people: ExperiencePeople) {
  checkedPeople.set(key, people);
  if (checkedPeople.size > CHECKED_PEOPLE_KEPT) checkedPeople.delete(checkedPeople.keys().next().value!);
}

/** An Experience's people (1.354) for a game of it, read on their own (the pack was checked whole when the
 *  game began); null when it ships none or the file no longer reads. */
export async function readMapPackPeople(packageId: string): Promise<NonNullable<MapPack["people"]> | null> {
  let file: Awaited<ReturnType<typeof capabilityPackageManager.mapPackPeople>>;
  try {
    file = await capabilityPackageManager.mapPackPeople(packageId);
  } catch {
    return null;
  }
  if (!file) return null;
  const key = `${packageId}@${file.version}#${file.sha256}`;
  let people = checkedPeople.get(key);
  if (!people) {
    const read = readExperiencePeople(file.data.toString("utf8"));
    if (!read.ok) return null;
    people = read.people;
    rememberPeople(key, people);
  }
  return { ...people, urls: experiencePeopleUrls(packageId, file.version, people) };
}

/** Where each picture a people file names is served. */
function experiencePeopleUrls(packageId: string, version: string, people: ExperiencePeople) {
  return Object.fromEntries(
    experiencePeopleImages(people).map((path) => [path, packageAssetUrl(packageId, version, path)]),
  );
}

export type MapPackRead = { ok: true; pack: MapPack } | { ok: false; reason: string } | null;

/** Where a package's asset is served, as the browser asks for it. */
export function packageAssetUrl(packageId: string, version: string, path: string): string {
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${encoded}?v=${encodeURIComponent(version)}`;
}

/** Two values the same. Both sides always come out of the same parsers (the share file readers, the
 *  create route's schema and brief check), so their keys are in one order whatever order they were sent
 *  in (the regression sends them shuffled). */
export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** The Experience's map pack, checked; null when it ships none (or is not installed and ready). A pack
 *  whose files do not read is refused whole, with the reason, never half used. */
export async function readMapPack(packageId: string): Promise<MapPackRead> {
  let files: Awaited<ReturnType<typeof capabilityPackageManager.mapPackFiles>>;
  try {
    files = await capabilityPackageManager.mapPackFiles(packageId);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (!files) return null;
  const kit = readWorldKitFile(files.kit.toString("utf8"));
  if (!kit.ok) return { ok: false, reason: `its kit does not read: ${kit.issues[0]}` };
  const api = files.capabilityApi;
  const declaresIntro = !!api && (api.major > 1 || (api.major === 1 && api.minor >= 339));
  const worlds: MapPack["worlds"] = [];
  for (const { path, data } of files.worlds) {
    const world = readWorldFile(data.toString("utf8"));
    if (!world.ok) return { ok: false, reason: `${path} does not read: ${world.issues[0]}` };
    if (!sameJson(world.kit, kit.kit)) return { ok: false, reason: `${path} was made with another kit` };
    if (world.notes.length) return { ok: false, reason: `${path} does not fit its kit: ${world.notes[0]}` };
    // A story's intro message is Capability API 1.339.
    if (world.story?.intro && !declaresIntro) {
      return { ok: false, reason: `${path} sets an intro message, which needs Capability API 1.339` };
    }
    // The tracks its story cues are the pack's own (1.353).
    const missing = world.story
      ? storyMusicCues(world.story).find((cue) => !files.music?.tracks.some((track) => track.id === cue))
      : undefined;
    if (missing) return { ok: false, reason: `${path}'s story cues the track "${missing}", which its music lacks` };
    // A story using clocks (1.350) or story actions (1.351) needs an Experience that declares them.
    const needs = world.story ? storyCapabilityMinor(world.story) : 0;
    if (needs && (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < needs)) {
      return { ok: false, reason: `${path}'s story needs capabilityApi 1.${needs} or newer` };
    }
    worlds.push({
      path,
      name: world.name,
      world: world.world,
      ...(world.story ? { story: world.story } : {}),
      // A world another generator made is played from its snapshot (W11).
      ...(world.snapshot ? { snapshot: world.snapshot } : {}),
    });
  }
  let tiles: TilePack | null = null;
  if (files.tiles) {
    // Checked once per package version and file (an image pack's sheets are decoded to be checked).
    const key = `${packageId}@${files.version}#${files.tilesSha256 ?? ""}`;
    const cached = checkedTiles.get(key);
    if (cached) tiles = cached;
    else {
      const read = parseTilePack(files.tiles.toString("utf8"));
      if (!read.ok) return { ok: false, reason: `its tiles do not read: ${read.issues[0]}` };
      tiles = read.pack;
      if (tiles.tilePackVersion === 2) {
        const api = files.capabilityApi;
        if (!api || !(api.major > 1 || (api.major === 1 && api.minor >= 80)))
          return { ok: false, reason: "its tiles are an image pack, which needs capabilityApi 1.80 or newer" };
        const cleaned = await cleanImageTilePack(tiles);
        if (!cleaned.ok) return { ok: false, reason: `its tiles do not read: ${cleaned.issue}` };
        tiles = cleaned.pack;
      }
      checkedTiles.set(key, tiles);
      if (checkedTiles.size > CHECKED_TILES_KEPT) checkedTiles.delete(checkedTiles.keys().next().value!);
    }
  }
  const games = worlds.map((entry) => ({ entry, game: packGameWorld(kit.kit, entry) }));
  // Its music (1.353): a place a track is for is a place of one of its worlds.
  let music: MapPack["music"];
  if (files.music) {
    const places = new Set(games.flatMap(({ game }) => game.world.places.map((place) => place.id)));
    const stray = files.music.places?.find((each) => !places.has(each.place));
    if (stray) return { ok: false, reason: `its music names the place "${stray.place}", which none of its worlds has` };
    music = {
      ...files.music,
      urls: Object.fromEntries(
        files.music.tracks.map((track) => [track.id, packageAssetUrl(packageId, files.version, track.path)]),
      ),
    };
  }
  // Its creature packs (1.352), each checked as the library checks one; one that does not read refuses all.
  const creatures: CreaturePack[] = [];
  for (const { path, data, sha256 } of files.creatures ?? []) {
    const key = `${packageId}@${files.version}#${sha256}`;
    const cached = checkedCreatures.get(key);
    if (cached) {
      creatures.push(cached);
      continue;
    }
    const read = parseCreaturePack(data.toString("utf8"));
    if (!read.ok) return { ok: false, reason: `${path} does not read: ${read.issues[0]}` };
    creatures.push(read.pack);
    checkedCreatures.set(key, read.pack);
    if (checkedCreatures.size > CHECKED_CREATURES_KEPT) checkedCreatures.delete(checkedCreatures.keys().next().value!);
  }
  // Its people (1.354): each a named person of one of its worlds, their pictures its own assets, their
  // walking look one of its tiles' characters; a companion (1.355) needs an Experience that declares it,
  // and every companion a story recruits or dismisses is one.
  let people: MapPack["people"];
  if (files.people) {
    const read = readExperiencePeople(files.people.data.toString("utf8"));
    if (!read.ok) return { ok: false, reason: `${files.people.path} does not read: ${read.issues[0]}` };
    const needs = experiencePeopleMinor(read.people);
    if (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < needs) {
      return { ok: false, reason: `its people need capabilityApi 1.${needs} or newer` };
    }
    const declared = new Set(files.assets);
    const image = experiencePeopleImages(read.people).find((path) => !declared.has(path));
    if (image) return { ok: false, reason: `its people's picture ${image} is not one of its assets` };
    const sprites = new Set(
      tiles && tiles.tilePackVersion === 2 ? (tiles.characters ?? []).map((each) => each.id) : [],
    );
    for (const person of read.people.people) {
      if (!games.some(({ game }) => storyPerson(game, person.person)?.named)) {
        return { ok: false, reason: `its people name "${person.person}", whom none of its worlds has by name` };
      }
      if (person.sprite && !sprites.has(person.sprite)) {
        return {
          ok: false,
          reason: `${person.person} walks as "${person.sprite}", which its tiles have no character for`,
        };
      }
    }
    for (const { entry } of games) {
      const stray = entry.story
        ? storyCompanionsNamed(entry.story).find(
            (id) => !read.people.people.some((person) => person.person === id && person.companion),
          )
        : undefined;
      if (stray)
        return { ok: false, reason: `${entry.path}'s story takes in "${stray}", who is not one of its companions` };
    }
    rememberPeople(`${packageId}@${files.version}#${files.people.sha256}`, read.people);
    people = {
      ...read.people,
      urls: experiencePeopleUrls(packageId, files.version, read.people),
    };
  } else {
    const stray = worlds.find((entry) => entry.story && storyCompanionsNamed(entry.story).length);
    if (stray) return { ok: false, reason: `${stray.path}'s story takes in companions, and the pack has no people` };
  }
  return {
    ok: true,
    pack: {
      packageId,
      name: files.name,
      kit: kit.kit,
      worlds,
      tiles,
      ...(creatures.length ? { creatures } : {}),
      ...(music ? { music } : {}),
      ...(people ? { people } : {}),
    },
  };
}

/** Why a new game's kit and world are not the ones its Experience's map pack locks it to, or nothing. */
export function mapPackLockIssue(
  pack: MapPack,
  setup: {
    worldKit?: unknown;
    world?: { seed: number; generatorVersion?: number; grounding?: string; brief: unknown; edits?: unknown } | null;
    story?: unknown;
  },
): string | null {
  if (!setup.worldKit || !sameJson(setup.worldKit, pack.kit)) {
    return `${pack.name} sets the game's setting kit to its own.`;
  }
  if (pack.worlds.length === 0) return null;
  const world = setup.world;
  const one = world
    ? pack.worlds.some(
        ({ world: shipped, story }) =>
          shipped.seed === world.seed &&
          // The version that made it too: the same seed on another generator is another world.
          shipped.generatorVersion === world.generatorVersion &&
          shipped.grounding === (world.grounding ?? "expand") &&
          sameJson(shipped.brief, world.brief) &&
          sameJson(shipped.edits ?? null, world.edits ?? null) &&
          sameJson(story ?? null, setup.story ?? null),
      )
    : false;
  return one ? null : `${pack.name} sets the game's world to one of its own maps.`;
}
