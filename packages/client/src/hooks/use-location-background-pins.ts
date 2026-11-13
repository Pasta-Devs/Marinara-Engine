import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import {
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  LOCATION_BACKGROUND_PINS_KEY,
  backgroundWeatherVersion,
  backgroundWeatherVersionStem,
  normalizeLocationBackgroundPins,
  resolveLocationBackgroundPin,
  type LocationBackgroundMatch,
  type LocationBackgroundPin,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { chatBackgroundMetadataToUrl } from "../lib/backgrounds";
import { useGameStateStore } from "../stores/game-state.store";
import { useUIStore } from "../stores/ui.store";
import { useUpdateChatMetadata } from "./use-chats";
import { chatUsesWorldMaps } from "./use-scene-shelter";
import { useSpatialContext } from "./use-spatial-context";

type BackgroundListItem = { filename: string; source?: string };

function readMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** The chat's pinned places from its metadata. */
export function readLocationBackgroundPins(metadata: unknown): LocationBackgroundPin[] {
  return normalizeLocationBackgroundPins(readMetadata(metadata)[LOCATION_BACKGROUND_PINS_KEY]);
}

/** Where the open Roleplay chat is now, for the Chat settings place list ("Here now"). */
export interface LocationPinStatus {
  chatId: string | null;
  /** The tracker's location text. */
  location: string | null;
  /** The World Maps current place. */
  place: { id: string; name: string } | null;
  match: LocationBackgroundMatch | null;
}

export const useLocationPinStatus = create<LocationPinStatus & { publish: (status: LocationPinStatus) => void }>(
  (set) => ({
    chatId: null,
    location: null,
    place: null,
    match: null,
    publish: (status) => set(status),
  }),
);

/**
 * The picture to show for a pin in the story's weather: its weather version when the
 * library already has one (made by the Illustrator), else the pinned picture itself.
 */
export function pinnedBackgroundForWeather(
  background: string,
  weather: string | null | undefined,
  library: readonly BackgroundListItem[] | undefined,
  weatherVersions: boolean,
): string {
  if (!weatherVersions || !library?.length) return background;
  const wanted = backgroundWeatherVersion(weather);
  if (!wanted) return background;
  const dot = background.lastIndexOf(".");
  if (dot <= 0 || background.includes("/") || background.includes(":")) return background;
  const stem = background.slice(0, dot);
  const versionStem = backgroundWeatherVersionStem(stem, wanted);
  const names = new Set(library.map((item) => item.filename));
  const sameExt = `${versionStem}${background.slice(dot)}`;
  if (names.has(sameExt)) return sameExt;
  const other = library.find((item) => item.filename.startsWith(`${versionStem}.`));
  return other?.filename ?? background;
}

/**
 * Shows a pinned place's picture when the story arrives there: a new reply, a tracker edit, a
 * swipe or a World Maps move. It applies once per arrival, so a picture picked by hand in a
 * pinned place stays until the story moves on (the server follows the same rule on new replies).
 */
export function useLocationBackgroundPinFollower(args: {
  chatId: string | null;
  chatMode: string | null | undefined;
  chatMetadata: unknown;
  userName?: string | null;
  characterNames: readonly string[];
  /** Who wrote the message the World State belongs to ("my bedroom" is theirs). */
  speakerName?: string | null;
}) {
  const { chatId, chatMode, chatMetadata, userName, characterNames, speakerName } = args;
  const meta = readMetadata(chatMetadata);
  const isRoleplay = chatMode === "roleplay";
  const pins = useMemo(
    () => normalizeLocationBackgroundPins(meta[LOCATION_BACKGROUND_PINS_KEY]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(meta[LOCATION_BACKGROUND_PINS_KEY] ?? null)],
  );
  const shownPinId =
    typeof meta[LOCATION_BACKGROUND_PIN_SHOWN_KEY] === "string" ? meta[LOCATION_BACKGROUND_PIN_SHOWN_KEY] : null;
  const weatherVersions = meta.illustratorWeatherBackgroundsEnabled === true;

  const gameState = useGameStateStore((state) => state.current);
  const stateKnown = !!gameState && gameState.chatId === chatId;
  const location = stateKnown ? (gameState?.location ?? null) : null;
  const weather = stateKnown ? (gameState?.weather ?? null) : null;

  const mapsActive = isRoleplay && chatUsesWorldMaps(chatMetadata);
  const spatial = useSpatialContext(chatId, mapsActive);
  const spatialData = mapsActive ? spatial.data : undefined;
  const placeId = spatialData?.currentLocationId ?? null;
  const places = spatialData?.definition?.locations;
  const place = placeId ? (places?.find((entry) => entry.id === placeId) ?? null) : null;

  const characterKey = characterNames.join("\u0000");
  const match = useMemo(
    () =>
      isRoleplay
        ? resolveLocationBackgroundPin(pins, {
            location,
            placeId,
            places: places?.map((entry) => ({ id: entry.id, name: entry.name, parentId: entry.parentId })),
            userName,
            characterNames,
            speakerName,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRoleplay, pins, location, placeId, places, userName, characterKey, speakerName],
  );

  const publish = useLocationPinStatus((state) => state.publish);
  useEffect(() => {
    publish({
      chatId: isRoleplay ? chatId : null,
      location,
      place: place ? { id: place.id, name: place.name } : null,
      match,
    });
  }, [publish, chatId, isRoleplay, location, place, match]);

  const { data: library } = useQuery({
    queryKey: ["backgrounds"],
    queryFn: () => api.get<BackgroundListItem[]>("/backgrounds"),
    enabled: isRoleplay && pins.length > 0 && weatherVersions,
    staleTime: 60_000,
  });

  const updateMeta = useUpdateChatMetadata();
  const known = stateKnown || !!spatialData;
  const matchPinId = match?.pin.id ?? null;
  const matchBackground = match?.pin.background ?? null;
  useEffect(() => {
    if (!chatId || !isRoleplay || pins.length === 0 || !known) return;
    if (!matchPinId || !matchBackground) {
      // Left the pinned place: arriving there again shows its picture again.
      if (shownPinId) updateMeta.mutate({ id: chatId, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: null });
      return;
    }
    if (shownPinId === matchPinId) return;
    const filename = pinnedBackgroundForWeather(matchBackground, weather, library, weatherVersions);
    const url = chatBackgroundMetadataToUrl(filename);
    if (url) useUIStore.getState().setChatBackground(url);
    updateMeta.mutate({ id: chatId, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: matchPinId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isRoleplay, known, matchPinId, matchBackground, shownPinId]);
}
