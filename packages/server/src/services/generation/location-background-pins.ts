// ──────────────────────────────────────────────
// Location backgrounds: the server side of pinned place backgrounds.
//
// A pinned place owns its background: while the story is there, the
// Background agent can't swap the picture for another one, and the
// Illustrator doesn't paint a new background for it (weather versions of
// the pinned picture still happen).
// ──────────────────────────────────────────────

import {
  LOCATION_BACKGROUND_PINS_KEY,
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  normalizeLocationBackgroundPins,
  resolveLocationBackgroundPin,
  type LocationBackgroundMatch,
  type ResolvedOwnerSpatialProjection,
} from "@marinara-engine/shared";
import { planChatBackgroundWeather } from "../game/game-asset-generation.js";

export type PinnedSceneBackground = {
  match: LocationBackgroundMatch;
  /** What to show: the pinned picture, or its weather version when that already exists. */
  filename: string;
};

/** Pins only drive the Roleplay background (Game Mode's backgrounds come from its own scene tags). */
export function locationBackgroundPinsApply(chatMode: unknown, chatMetadata: Record<string, unknown>): boolean {
  return (
    String(chatMode ?? "") === "roleplay" &&
    normalizeLocationBackgroundPins(chatMetadata[LOCATION_BACKGROUND_PINS_KEY]).length > 0
  );
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
  weather?: string | null;
  weatherVersions?: boolean;
}): PinnedSceneBackground | null {
  if (!locationBackgroundPinsApply(args.chatMode, args.chatMetadata)) return null;
  const match = resolveLocationBackgroundPin(args.chatMetadata[LOCATION_BACKGROUND_PINS_KEY], {
    location: args.location,
    placeId: args.projection?.currentLocationId ?? null,
    places: placesFromProjection(args.projection),
    userName: args.userName,
    characterNames: args.characterNames,
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
