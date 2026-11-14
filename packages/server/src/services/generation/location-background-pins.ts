// ──────────────────────────────────────────────
// Location backgrounds: the server side of pinned place backgrounds.
//
// A pinned place owns its background: while the story is there, the
// Background agent can't swap the picture for another one, and the
// Illustrator doesn't paint a new background for it (weather versions of
// the pinned picture still happen).
// ──────────────────────────────────────────────

import {
  galleryBackgroundPins,
  galleryBackgroundUrl,
  LOCATION_BACKGROUND_PINS_KEY,
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  normalizeLocationBackgroundPins,
  normalizeLocationText,
  resolveLocationBackgroundPin,
  type LocationBackgroundMatch,
  type LocationBackgroundPin,
  type ResolvedOwnerSpatialProjection,
} from "@marinara-engine/shared";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { isChatBackgroundWeatherVersion, planChatBackgroundWeather } from "../game/game-asset-generation.js";
import { DATA_DIR } from "../../utils/data-dir.js";

export type PinnedSceneBackground = {
  match: LocationBackgroundMatch;
  /** What to show: the pinned picture, or its weather version when that already exists. */
  filename: string;
};

/** Pins only drive the Roleplay background (Game Mode's backgrounds come from its own scene tags). */
export function locationBackgroundPinsApply(
  chatMode: unknown,
  chatMetadata: Record<string, unknown>,
  galleryPins: readonly LocationBackgroundPin[] = [],
): boolean {
  return (
    String(chatMode ?? "") === "roleplay" &&
    (normalizeLocationBackgroundPins(chatMetadata[LOCATION_BACKGROUND_PINS_KEY]).length > 0 || galleryPins.length > 0)
  );
}

type GalleryRow = { id: string; filePath: string; customKind?: string | null; customName?: string | null };

/**
 * Background pictures (with places) from the galleries of the chat's characters and persona,
 * as pins: they follow the character into every chat.
 */
export async function loadGalleryBackgroundPins(args: {
  characters: ReadonlyArray<{ id: string; name: string }>;
  persona: { id: string; name: string } | null;
  characterGallery: { listByCharacterId(id: string): Promise<GalleryRow[]> };
  personaGallery: { listByPersonaId(id: string): Promise<GalleryRow[]> };
}): Promise<LocationBackgroundPin[]> {
  const toImages = (type: "character" | "persona", ownerId: string, rows: GalleryRow[]) =>
    rows.map((row) => ({ ...row, url: galleryBackgroundUrl(type, ownerId, row.filePath) }));
  const pins: LocationBackgroundPin[] = [];
  for (const character of args.characters) {
    const rows = await args.characterGallery.listByCharacterId(character.id).catch(() => [] as GalleryRow[]);
    pins.push(...galleryBackgroundPins({ type: "character", ...character }, toImages("character", character.id, rows)));
  }
  if (args.persona) {
    const rows = await args.personaGallery.listByPersonaId(args.persona.id).catch(() => [] as GalleryRow[]);
    pins.push(
      ...galleryBackgroundPins({ type: "persona", ...args.persona }, toImages("persona", args.persona.id, rows)),
    );
  }
  return pins;
}

/** The World Maps chain (outermost first) as places with parents, for walking up to a pinned building. */
function placesFromProjection(projection: ResolvedOwnerSpatialProjection | null | undefined) {
  const breadcrumb = projection?.breadcrumb ?? [];
  return breadcrumb.map((place, index) => ({
    id: place.id,
    name: place.name,
    parentId: index > 0 ? (breadcrumb[index - 1]?.id ?? null) : null,
  }));
}

export function pinnedSceneBackground(args: {
  chatMode: unknown;
  chatMetadata: Record<string, unknown>;
  location: string | null | undefined;
  projection?: ResolvedOwnerSpatialProjection | null;
  userName?: string | null;
  characterNames?: readonly string[];
  /** Who wrote the message the location belongs to ("my bedroom" is theirs). */
  speakerName?: string | null;
  weather?: string | null;
  weatherVersions?: boolean;
  /** Background pictures from the chat's characters' and persona's galleries (loadGalleryBackgroundPins). */
  galleryPins?: readonly LocationBackgroundPin[];
}): PinnedSceneBackground | null {
  const galleryPins = args.galleryPins ?? [];
  if (!locationBackgroundPinsApply(args.chatMode, args.chatMetadata, galleryPins)) return null;
  // The chat's own pins go first, so they win a tie with a gallery picture.
  const pins = [...normalizeLocationBackgroundPins(args.chatMetadata[LOCATION_BACKGROUND_PINS_KEY]), ...galleryPins];
  const match = resolveLocationBackgroundPin(pins, {
    location: args.location,
    placeId: args.projection?.currentLocationId ?? null,
    places: placesFromProjection(args.projection),
    userName: args.userName,
    characterNames: args.characterNames,
    speakerName: args.speakerName,
  });
  if (!match) return null;
  let filename = match.pin.background;
  if (args.weatherVersions && args.weather?.trim()) {
    const plan = planChatBackgroundWeather(filename, args.weather);
    if (plan.kind === "switch") filename = plan.filename;
  }
  return { match, filename };
}

/** Metadata patch that shows a pin and remembers it was shown (a manual pick then lasts until the place changes). */
export function pinnedBackgroundMetadataPatch(pinned: PinnedSceneBackground): Record<string, unknown> {
  return { background: pinned.filename, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: pinned.match.pin.id };
}

const LIBRARY_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

/** A library picture's place words: its file name (without "generated-", numbering and weather) and longer tags. */
function libraryPlaceNames(filename: string, tags: readonly string[]): string[] {
  const stem = filename
    .slice(0, filename.length - extname(filename).length)
    .replace(/^generated-/u, "")
    .replace(/[-_ ]\d+$/u, "");
  const names = [normalizeLocationText(stem.replace(/[-_]+/gu, " "))];
  // One-word tags ("interior", "night") say what a picture looks like, not which place it is.
  for (const tag of tags) {
    const name = normalizeLocationText(tag);
    if (name.includes(" ")) names.push(name);
  }
  return names.filter(Boolean);
}

/** The best library picture whose name is found in the location text (most words wins), or null. */
export function matchLibraryBackgroundForLocation(
  location: string | null | undefined,
  library: ReadonlyArray<{ filename: string; tags?: readonly string[] }>,
): string | null {
  const text = normalizeLocationText(location);
  if (!text) return null;
  let best: { filename: string; words: number; length: number } | null = null;
  for (const item of library) {
    if (isChatBackgroundWeatherVersion(item.filename)) continue;
    for (const name of libraryPlaceNames(item.filename, item.tags ?? [])) {
      if (!` ${text} `.includes(` ${name} `)) continue;
      const words = name.split(" ").length;
      if (!best || words > best.words || (words === best.words && name.length > best.length)) {
        best = { filename: item.filename, words, length: name.length };
      }
    }
  }
  return best?.filename ?? null;
}

export function readChatBackgroundLibrary(): Array<{ filename: string; tags: string[] }> {
  const dir = join(DATA_DIR, "backgrounds");
  if (!existsSync(dir)) return [];
  let meta: Record<string, { tags?: unknown }> = {};
  try {
    meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf-8")) as typeof meta;
  } catch {
    /* no tags */
  }
  return readdirSync(dir)
    .filter((file) => LIBRARY_EXTS.has(extname(file).toLowerCase()))
    .map((filename) => ({
      filename,
      tags: Array.isArray(meta[filename]?.tags)
        ? (meta[filename]!.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
        : [],
    }));
}

export type ExistingSceneBackground = {
  /** What to show (the weather version when the library has one). */
  filename: string;
  source: "pin" | "library";
  /** The pin, when a pinned place matched. */
  pinned?: PinnedSceneBackground;
};

/**
 * The background the chat already has for a place, before anything paints a new one:
 * 1. the chat's pinned place (Chat settings > Background > Pinned places);
 * 2. a library picture whose file name (or a multi-word tag) is found in the location text,
 *    so "generated-guest-bedroom.png" serves "Smith House, guest bedroom";
 * 3. otherwise null (paint a new one).
 * The weather version is swapped in when weatherVersions is on and that version exists.
 */
export function findExistingSceneBackground(
  args: Parameters<typeof pinnedSceneBackground>[0],
): ExistingSceneBackground | null {
  const pinned = pinnedSceneBackground(args);
  if (pinned) return { filename: pinned.filename, source: "pin", pinned };
  if (String(args.chatMode ?? "") !== "roleplay") return null;
  const location = args.location || args.projection?.breadcrumb.at(-1)?.name || "";
  const found = matchLibraryBackgroundForLocation(location, readChatBackgroundLibrary());
  if (!found) return null;
  let filename = found;
  if (args.weatherVersions && args.weather?.trim()) {
    const plan = planChatBackgroundWeather(found, args.weather);
    if (plan.kind === "switch") filename = plan.filename;
  }
  return { filename, source: "library" };
}
