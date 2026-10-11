// ──────────────────────────────────────────────
// Experience map packs (worldgen W9e): an Experience's own setting kit, ready-made worlds built with it
// and tile pack, read from the installed package through the same verification as every package asset,
// and checked as share files are. A game started with the Experience is locked to them.
// ──────────────────────────────────────────────
import {
  parseTilePack,
  readWorldFile,
  readWorldKitFile,
  storyCapabilityMinor,
  type ExperienceMapPack,
  type TilePack,
} from "@marinara-engine/shared";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";
import { cleanImageTilePack } from "./tile-pack-images.service.js";

/** Map pack tiles already checked, by package, version and the tiles file's hash; the oldest go first. */
const checkedTiles = new Map<string, TilePack>();
const CHECKED_TILES_KEPT = 8;

export type MapPack = ExperienceMapPack;

export type MapPackRead = { ok: true; pack: MapPack } | { ok: false; reason: string } | null;

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
  return { ok: true, pack: { packageId, name: files.name, kit: kit.kit, worlds, tiles } };
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
