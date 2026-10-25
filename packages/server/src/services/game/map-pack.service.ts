// ──────────────────────────────────────────────
// Experience map packs (worldgen W9e): an Experience's own setting kit, ready-made worlds built with it
// and tile pack, read from the installed package through the same verification as every package asset,
// and checked as share files are. A game started with the Experience is locked to them.
// ──────────────────────────────────────────────
import {
  CREATURE_PACK_MAX_BYTES,
  WORLD_SHARE_FILE_MAX_BYTES,
  capabilityPackageManifestSchema,
  supportedCapabilityApi,
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
  applyExperienceRulesetOverlay,
  readExperienceRulesetOverlay,
  type ExperiencePeople,
  type ExperienceRulesetOverlay,
  type GameWorld,
  compileGameWorld,
  gameWorldFromSnapshot,
  type ExperienceMapPack,
  type TilePack,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";
import { rulesetFileCatalogIds } from "./ruleset-catalog.service.js";
import { loadRulesetRegistry, overlayCatalogIds } from "./ruleset-registry.service.js";
import { cleanImageTilePack } from "./tile-pack-images.service.js";

// The Capability API minors a map pack and an image tile pack need (1.72, 1.80). The manifest schema
// refuses a map pack below 1.72, this reader refuses image tiles below 1.80, and the authoring check
// reports both from these numbers.
const MAP_PACK_MINOR = 72;
const IMAGE_TILES_MINOR = 80;
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

/** What a dungeon look of an Experience must draw at least (1.357): its liquid and props fall back to
 *  plain colours, as a library set's do. */
const DUNGEON_LOOK_TILES = ["dn_floor", "dn_wall"] as const;

/** Whether a world's boards are painted with seasons (Capability API 1.351). */
const worldSeasonPainted = (world: { edits?: { battlefields?: Array<{ seasons?: unknown }> } }) =>
  Boolean(world.edits?.battlefields?.some((board) => board.seasons));

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

/** An Experience's people (1.346) for a game of it, read on their own (the pack was checked whole when the
 *  game began); null when it ships none or the file no longer reads. */
export async function readMapPackPeople(packageId: string): Promise<NonNullable<MapPack["people"]> | null> {
  let file: Awaited<ReturnType<typeof capabilityPackageManager.mapPackPeople>>;
  try {
    file = await capabilityPackageManager.mapPackPeople(packageId);
  } catch (error) {
    logger.warn(error, "Could not read the people file of Experience %s", packageId);
    return null;
  }
  if (!file) return null;
  const key = `${packageId}@${file.version}#${file.sha256}`;
  let people = checkedPeople.get(key);
  if (!people) {
    const read = readExperiencePeople(file.data.toString("utf8"));
    if (!read.ok) {
      logger.warn("The people file of Experience %s no longer reads: %s", packageId, read.issues.join(" "));
      return null;
    }
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
  let files: MapPackFiles | null;
  try {
    files = await capabilityPackageManager.mapPackFiles(packageId);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (!files) return null;
  return checkMapPackFiles(packageId, files);
}

/** A map pack's files as the package holds them (or as an author sends them to be checked). */
export type MapPackFiles = NonNullable<Awaited<ReturnType<typeof capabilityPackageManager.mapPackFiles>>>;

/** A map pack's files, read and checked whole: the pack, or the first reason it is refused. `cache: false`
 *  for files that are not an installed package's (an author's, before export). */
export async function checkMapPackFiles(
  packageId: string,
  files: MapPackFiles,
  { cache = true }: { cache?: boolean } = {},
): Promise<{ ok: true; pack: MapPack } | { ok: false; reason: string }> {
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
    // The tracks its story cues are the pack's own (1.345).
    const missing = world.story
      ? storyMusicCues(world.story).find((cue) => !files.music?.tracks.some((track) => track.id === cue))
      : undefined;
    if (missing) return { ok: false, reason: `${path}'s story cues the track "${missing}", which its music lacks` };
    // A story using clocks (1.342) or story actions (1.343) needs an Experience that declares them.
    const needs = world.story ? storyCapabilityMinor(world.story) : 0;
    if (needs && (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < needs)) {
      return { ok: false, reason: `${path}'s story needs capabilityApi 1.${needs} or newer` };
    }
    // Boards painted with seasons (1.351) likewise.
    if (
      worldSeasonPainted(world.world) &&
      (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < 351)
    ) {
      return { ok: false, reason: `${path}'s battlefields painted with seasons need capabilityApi 1.351 or newer` };
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
    const cached = cache ? checkedTiles.get(key) : undefined;
    if (cached) tiles = cached;
    else {
      const read = parseTilePack(files.tiles.toString("utf8"));
      if (!read.ok) return { ok: false, reason: `its tiles do not read: ${read.issues[0]}` };
      tiles = read.pack;
      if (tiles.tilePackVersion === 2) {
        const api = files.capabilityApi;
        if (!api || !(api.major > 1 || (api.major === 1 && api.minor >= IMAGE_TILES_MINOR)))
          return {
            ok: false,
            reason: `its tiles are an image pack, which needs capabilityApi 1.${IMAGE_TILES_MINOR} or newer`,
          };
        const cleaned = await cleanImageTilePack(tiles);
        if (!cleaned.ok) return { ok: false, reason: `its tiles do not read: ${cleaned.issue}` };
        tiles = cleaned.pack;
      }
      if (cache) checkedTiles.set(key, tiles);
      if (checkedTiles.size > CHECKED_TILES_KEPT) checkedTiles.delete(checkedTiles.keys().next().value!);
    }
  }
  // Its image packs for maps made by hand (1.357), each read as its tiles are, laid out as a dungeon set,
  // and named once.
  const dungeons: TilePack[] = [];
  for (const { path, data, sha256 } of files.dungeons ?? []) {
    if (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < 357) {
      return { ok: false, reason: `${path} is a dungeon look, which needs capabilityApi 1.357 or newer` };
    }
    const key = `${packageId}@${files.version}#dungeon:${sha256}`;
    let pack = cache ? checkedTiles.get(key) : undefined;
    if (!pack) {
      const read = parseTilePack(data.toString("utf8"));
      if (!read.ok) return { ok: false, reason: `${path} does not read: ${read.issues[0]}` };
      pack = read.pack;
      if (pack.tilePackVersion === 2) {
        const cleaned = await cleanImageTilePack(pack);
        if (!cleaned.ok) return { ok: false, reason: `${path} does not read: ${cleaned.issue}` };
        pack = cleaned.pack;
      }
      if (cache) checkedTiles.set(key, pack);
      if (checkedTiles.size > CHECKED_TILES_KEPT) checkedTiles.delete(checkedTiles.keys().next().value!);
    }
    const missing = DUNGEON_LOOK_TILES.filter((id) => !pack!.tiles[id]?.length);
    if (missing.length)
      return { ok: false, reason: `${path} has no ${missing.join(", ")}, which a dungeon look needs` };
    if (dungeons.some((each) => each.id === pack!.id)) {
      return { ok: false, reason: `${path} is called "${pack.id}", as another of its dungeon looks is` };
    }
    dungeons.push(pack);
  }
  // A hand map's own words for the Game Master (1.357) likewise need an Experience that declares them.
  for (const { path, world } of worlds) {
    if (
      world.edits?.maps?.some((map) => map.words) &&
      (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < 357)
    ) {
      return { ok: false, reason: `${path}'s maps with their own words need capabilityApi 1.357 or newer` };
    }
  }
  const games = worlds.map((entry) => ({ entry, game: packGameWorld(kit.kit, entry) }));
  // Its music (1.345): a place a track is for is a place of one of its worlds.
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
  // Its creature packs (1.344), each checked as the library checks one; one that does not read refuses all.
  const creatures: CreaturePack[] = [];
  for (const { path, data, sha256 } of files.creatures ?? []) {
    const key = `${packageId}@${files.version}#${sha256}`;
    const cached = cache ? checkedCreatures.get(key) : undefined;
    if (cached) {
      creatures.push(cached);
      continue;
    }
    const read = parseCreaturePack(data.toString("utf8"));
    if (!read.ok) return { ok: false, reason: `${path} does not read: ${read.issues[0]}` };
    // Flying art (creaturePackVersion 2) needs an Experience that declares 1.352.
    if (
      read.pack.creaturePackVersion >= 2 &&
      (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < 352)
    ) {
      return { ok: false, reason: `${path} has flying art, which needs capabilityApi 1.352 or newer` };
    }
    creatures.push(read.pack);
    if (cache) checkedCreatures.set(key, read.pack);
    if (checkedCreatures.size > CHECKED_CREATURES_KEPT) checkedCreatures.delete(checkedCreatures.keys().next().value!);
  }
  // Its people (1.346): each a named person of one of its worlds, their pictures its own assets, their
  // walking look one of its tiles' characters; a companion (1.347) needs an Experience that declares it,
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
    if (cache) rememberPeople(`${packageId}@${files.version}#${files.people.sha256}`, read.people);
    people = {
      ...read.people,
      urls: experiencePeopleUrls(packageId, files.version, read.people),
    };
  } else {
    const stray = worlds.find((entry) => entry.story && storyCompanionsNamed(entry.story).length);
    if (stray) return { ok: false, reason: `${stray.path}'s story takes in companions, and the pack has no people` };
  }
  // Its ruleset overlays (1.355), read for their shape: each is checked against the game's ruleset when
  // it is merged in.
  for (const file of files.rulesets ?? []) {
    const read = readExperienceRulesetOverlay(file.data.toString("utf8"));
    if (!read.ok) return { ok: false, reason: `${file.path} does not read: ${read.issues[0]}` };
    if (!files.capabilityApi || files.capabilityApi.major !== 1 || files.capabilityApi.minor < 355) {
      return { ok: false, reason: `${file.path} is a ruleset overlay, which needs capabilityApi 1.355 or newer` };
    }
    // Item uses that cost a story number (1.359): a number flag of one of its worlds' stories.
    if (read.overlay.storyUses?.length) {
      if (files.capabilityApi!.minor < 359) {
        return { ok: false, reason: `${file.path} has story costs, which need capabilityApi 1.359 or newer` };
      }
      const numbers = new Set(
        worlds.flatMap((entry) =>
          (entry.story?.flags ?? []).flatMap((flag) => (flag.kind === "number" ? [flag.id] : [])),
        ),
      );
      const stray = read.overlay.storyUses.find((use) => !numbers.has(use.flag));
      if (stray) {
        return {
          ok: false,
          reason: `${file.path}'s story cost for "${stray.item}" is of "${stray.flag}", which no story of its worlds has as a number`,
        };
      }
    }
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
      ...(dungeons.length ? { dungeons } : {}),
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

/** An author's map pack to check before export (E7-A): the manifest's `gameSurface.mapPack` block, its
 *  JSON files by path as parsed, and the package's other assets (pictures, audio) by path and size. */
export interface MapPackCheckInput {
  mapPack: unknown;
  files: Record<string, unknown>;
  assets?: Array<{ path: string; bytes: number }>;
}

export interface MapPackCheck {
  ok: boolean;
  /** The Capability API minor the pack needs (1.x), as far as it could be read. */
  minor: number;
  issues: Array<{ path: string; message: string }>;
}

/** Checks a whole map pack as an installed one is read (the manifest's rules, then its files), without
 *  installing it: so an authoring app can say what is wrong before it exports. */
export async function checkMapPack(input: MapPackCheckInput): Promise<MapPackCheck> {
  const issues: MapPackCheck["issues"] = [];
  const texts = new Map(Object.entries(input.files).map(([path, value]) => [path, JSON.stringify(value)]));
  const assets = input.assets ?? [];
  // The files its block names are declared too, so one left out is said to be missing, not undeclared.
  const block = (input.mapPack && typeof input.mapPack === "object" ? input.mapPack : {}) as Record<string, unknown>;
  const named = [
    block.kit,
    block.tiles,
    block.people,
    ...[block.worlds, block.creatures, block.dungeons].flatMap((list) => (Array.isArray(list) ? list : [])),
    ...(Array.isArray(block.rulesets) ? block.rulesets : []).map((each) =>
      each && typeof each === "object" ? (each as Record<string, unknown>).overlay : undefined,
    ),
  ].filter((path): path is string => typeof path === "string");
  const declared = [...new Set([...texts.keys(), ...named, ...assets.map((asset) => asset.path)])];
  // The manifest's own rules, on a stand-in manifest that declares exactly these files.
  const manifest = {
    schemaVersion: 2,
    capabilityApi: { ...supportedCapabilityApi },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "experience-check",
    name: "Experience check",
    version: "0.0.0",
    description: "A map pack checked before export.",
    engine: { min: "2.3.0", maxExclusive: "99.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: { setup: {}, mapPack: input.mapPack },
      ...(declared.length ? { assets: { paths: declared } } : {}),
    },
    files: [
      { path: "client.js", sha256: "0".repeat(64), bytes: 1 },
      ...declared.map((path) => ({
        path,
        sha256: "0".repeat(64),
        bytes: texts.has(path)
          ? Buffer.byteLength(texts.get(path)!)
          : (assets.find((asset) => asset.path === path)?.bytes ?? 0),
      })),
    ],
    permissions: ["ui"],
    restartRequired: false,
  };
  const parsed = capabilityPackageManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const at = issue.path.join(".");
      issues.push({
        path: at.replace(/^contributions\.gameSurface\.mapPack\.?/u, "mapPack.").replace(/\.$/u, "") || "mapPack",
        message: issue.message,
      });
    }
  }
  const mapPack = parsed.success ? parsed.data.contributions?.gameSurface?.mapPack : undefined;
  let minor = MAP_PACK_MINOR;
  if (!mapPack) return { ok: false, minor, issues };
  // Its files, each sent and within what an installed package may hold.
  const fileOf = (path: string, maxBytes = WORLD_SHARE_FILE_MAX_BYTES): Buffer | null => {
    const text = texts.get(path);
    if (text === undefined) {
      issues.push({ path, message: `${path} was not sent` });
      return null;
    }
    if (Buffer.byteLength(text) > maxBytes) {
      issues.push({ path, message: `${path} is larger than ${maxBytes} bytes` });
      return null;
    }
    return Buffer.from(text);
  };
  const kit = fileOf(mapPack.kit);
  const worlds = (mapPack.worlds ?? []).map((path) => ({ path, data: fileOf(path) }));
  const tiles = mapPack.tiles ? fileOf(mapPack.tiles) : null;
  const creatures = (mapPack.creatures ?? []).map((path) => ({
    path,
    data: fileOf(path, CREATURE_PACK_MAX_BYTES),
    sha256: "",
  }));
  const people = mapPack.people ? fileOf(mapPack.people) : null;
  const dungeons = (mapPack.dungeons ?? []).map((path) => ({ path, data: fileOf(path), sha256: "" }));
  let storyCosts = false;
  let overlayTracks = false;
  const rulesets = (mapPack.rulesets ?? []).map((each) => ({
    ruleset: each.ruleset,
    path: each.overlay,
    data: fileOf(each.overlay),
    sha256: "",
  }));
  if (
    issues.length ||
    !kit ||
    worlds.some((world) => !world.data) ||
    creatures.some((each) => !each.data) ||
    dungeons.some((each) => !each.data) ||
    rulesets.some((each) => !each.data)
  ) {
    return { ok: false, minor, issues };
  }
  const checked = await checkMapPackFiles(
    "experience-check",
    {
      version: "0.0.0",
      name: "Experience check",
      kit,
      worlds: worlds.map((world) => ({ path: world.path, data: world.data! })),
      tiles,
      tilesSha256: null,
      capabilityApi: { ...supportedCapabilityApi },
      creatures: creatures.map((each) => ({ ...each, data: each.data! })),
      music: mapPack.music ?? null,
      assets: declared,
      people: mapPack.people && people ? { path: mapPack.people, data: people, sha256: "" } : null,
      rulesets: rulesets.map((each) => ({ ...each, data: each.data! })),
      dungeons: dungeons.map((each) => ({ ...each, data: each.data! })),
    },
    { cache: false },
  );
  if (!checked.ok) {
    const path = [...texts.keys(), ...declared].find((each) => checked.reason.startsWith(each)) ?? "mapPack";
    issues.push({ path, message: checked.reason });
    return { ok: false, minor, issues };
  }
  // Each overlay merged into its ruleset as installed here, as a game of it would (1.355).
  for (const each of rulesets) {
    const read = readExperienceRulesetOverlay(each.data!.toString("utf8"));
    if (read.ok && read.overlay.storyUses?.length) storyCosts = true;
    if (read.ok && read.overlay.tracks?.length) overlayTracks = true;
  }
  if (rulesets.length) {
    const registry = await loadRulesetRegistry();
    for (const each of rulesets) {
      const registered = registry.get(each.ruleset);
      if (!registered) continue;
      const read = readExperienceRulesetOverlay(each.data!.toString("utf8"));
      // Checked against the ruleset's catalog files too, whose ids only a read gives.
      const files = read.ok
        ? await rulesetFileCatalogIds(
            registered.packageId,
            registered.definition,
            overlayCatalogIds(read.overlay as ExperienceRulesetOverlay),
            registry,
          )
        : null;
      const merged = read.ok
        ? applyExperienceRulesetOverlay(
            registered.definition,
            read.overlay as ExperienceRulesetOverlay,
            false,
            files?.ids,
          )
        : read;
      if (!merged.ok) {
        for (const message of merged.issues) issues.push({ path: each.path, message });
      }
    }
    if (issues.length) return { ok: false, minor, issues };
  }
  // What it needs, from what it holds.
  const pack = checked.pack;
  const audio = declared.some((path) => /\.(?:ogg|mp3|wav)$/iu.test(path));
  minor = Math.max(
    minor,
    pack.tiles?.tilePackVersion === 2 ? IMAGE_TILES_MINOR : 0,
    ...pack.worlds.map((world) => (world.story ? storyCapabilityMinor(world.story) : 0)),
    pack.worlds.some((world) => worldSeasonPainted(world.world)) ? 351 : 0,
    pack.creatures?.length ? 344 : 0,
    pack.creatures?.some((each) => each.creaturePackVersion >= 2) ? 352 : 0,
    pack.music || audio ? 345 : 0,
    pack.people ? experiencePeopleMinor(pack.people) : 0,
    rulesets.length ? 355 : 0,
    storyCosts ? 359 : 0,
    overlayTracks ? 367 : 0,
    pack.dungeons?.length || pack.worlds.some((world) => world.world.edits?.maps?.some((map) => map.words)) ? 357 : 0,
  );
  return { ok: true, minor, issues };
}
