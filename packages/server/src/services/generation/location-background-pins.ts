// ──────────────────────────────────────────────
// Location backgrounds: the server side of pinned place backgrounds.
//
// A pinned place owns its background: while the story is there, the
// Background agent can't swap the picture for another one, and the
// Illustrator doesn't paint a new background for it.
// ──────────────────────────────────────────────

import {
  galleryBackgroundPins,
  galleryBackgroundUrl,
  LOCATION_BACKGROUND_PINS_KEY,
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  normalizeLocationBackgroundPins,
  resolveLocationBackgroundPin,
  type LocationBackgroundMatch,
  type LocationBackgroundPin,
  type ResolvedOwnerSpatialProjection,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

export type PinnedSceneBackground = {
  match: LocationBackgroundMatch;
  /** The pinned picture to show. */
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
    const rows = await args.characterGallery.listByCharacterId(character.id).catch((err: unknown) => {
      logger.warn(err, "[location-backgrounds] Could not read the gallery of character %s", character.id);
      return [] as GalleryRow[];
    });
    pins.push(...galleryBackgroundPins({ type: "character", ...character }, toImages("character", character.id, rows)));
  }
  if (args.persona) {
    const rows = await args.personaGallery.listByPersonaId(args.persona.id).catch((err: unknown) => {
      logger.warn(err, "[location-backgrounds] Could not read the gallery of persona %s", args.persona!.id);
      return [] as GalleryRow[];
    });
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
  return { match, filename: match.pin.background };
}

/** Metadata patch that shows a pin and remembers it was shown (a manual pick then lasts until the place changes). */
export function pinnedBackgroundMetadataPatch(pinned: PinnedSceneBackground): Record<string, unknown> {
  return { background: pinned.filename, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: pinned.match.pin.id };
}
