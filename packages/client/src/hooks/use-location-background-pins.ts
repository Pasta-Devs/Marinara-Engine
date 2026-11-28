import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import {
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  LOCATION_BACKGROUND_PINS_KEY,
  backgroundTimeOfDay,
  backgroundVersionStem,
  backgroundWeatherVersion,
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

function chatUsesAgent(metadata: unknown, agentId: string): boolean {
  const meta = readMetadata(metadata);
  return meta.enableAgents === true && Array.isArray(meta.activeAgentIds) && meta.activeAgentIds.includes(agentId);
}

/** Whether the chat runs the World Maps agent (its current place can match a pinned place). */
export function chatUsesWorldMaps(metadata: unknown): boolean {
  return chatUsesAgent(metadata, "hierarchical-maps");
}

/**
 * The picture to show for a pin in the story's weather and time of day: its version when the
 * library already has one (made by the Illustrator), else the pinned picture itself. When the exact
 * mix is missing, the weather version, then the time of day version stand in until it is made.
 */
export function pinnedBackgroundForWeather(
  background: string,
  weather: string | null | undefined,
  library: readonly BackgroundListItem[] | undefined,
  weatherVersions: boolean,
  time?: string | null,
  timeVersions = false,
): string {
  if ((!weatherVersions && !timeVersions) || !library?.length) return background;
  const wantedWeather = weatherVersions ? backgroundWeatherVersion(weather) : "";
  const wantedTime = timeVersions ? backgroundTimeOfDay(time) : "";
  if (!wantedWeather && !wantedTime) return background;
  const dot = background.lastIndexOf(".");
  if (dot <= 0 || background.includes("/") || background.includes(":")) return background;
  const stem = background.slice(0, dot);
  const names = new Set(library.map((item) => item.filename));
  const tries: Array<[typeof wantedWeather, typeof wantedTime]> = [
    [wantedWeather, wantedTime],
    [wantedWeather, ""],
    ["", wantedTime],
  ];
  for (const [weatherPart, timePart] of tries) {
    if (!weatherPart && !timePart) continue;
    const versionStem = backgroundVersionStem(stem, weatherPart, timePart);
    const sameExt = `${versionStem}${background.slice(dot)}`;
    if (names.has(sameExt)) return sameExt;
    const other = library.find((item) => item.filename.startsWith(`${versionStem}.`));
    if (other) return other.filename;
  }
  return background;
}

/**
 * Shows a pinned place's picture when the story arrives there: a new reply, a tracker edit, a
 * swipe or a World Maps move. It applies once per arrival, so a picture picked by hand in a
 * pinned place stays until the story moves on (the server follows the same rule on new replies).
 */
const NO_PINS: readonly LocationBackgroundPin[] = [];

export function useLocationBackgroundPinFollower(args: {
  chatId: string | null;
  chatMode: string | null | undefined;
  chatMetadata: unknown;
  userName?: string | null;
  characterNames: readonly string[];
  /** Who wrote the message the World State belongs to ("my bedroom" is theirs). */
  speakerName?: string | null;
  /** Background pictures (with places) from the chat's characters' and persona's galleries. */
  galleryPins?: readonly LocationBackgroundPin[];
}) {
  const { chatId, chatMode, chatMetadata, userName, characterNames, speakerName, galleryPins = NO_PINS } = args;
  const meta = readMetadata(chatMetadata);
  const isRoleplay = chatMode === "roleplay";
  // The chat's own pins go first, so they win a tie with a gallery picture.
  const pins = useMemo(
    () => [...normalizeLocationBackgroundPins(meta[LOCATION_BACKGROUND_PINS_KEY]), ...galleryPins],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(meta[LOCATION_BACKGROUND_PINS_KEY] ?? null), galleryPins],
  );
  const shownPinId =
    typeof meta[LOCATION_BACKGROUND_PIN_SHOWN_KEY] === "string" ? meta[LOCATION_BACKGROUND_PIN_SHOWN_KEY] : null;
  const weatherVersions = meta.illustratorWeatherBackgroundsEnabled === true;
  const timeVersions = meta.illustratorTimeBackgroundsEnabled === true;

  const gameState = useGameStateStore((state) => state.current);
  const stateKnown = !!gameState && gameState.chatId === chatId;
  const location = stateKnown ? (gameState?.location ?? null) : null;
  const weather = stateKnown ? (gameState?.weather ?? null) : null;
  const time = stateKnown ? (gameState?.time ?? null) : null;

  const mapsActive = isRoleplay && chatUsesWorldMaps(chatMetadata);
  const tracksLocation = chatUsesAgent(chatMetadata, "world-state");
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
    enabled: isRoleplay && pins.length > 0 && (weatherVersions || timeVersions),
    staleTime: 60_000,
  });

  const updateMeta = useUpdateChatMetadata();
  const known = stateKnown || !!spatialData;
  const matchPinId = match?.pin.id ?? null;
  const matchBackground = match?.pin.background ?? null;
  useEffect(() => {
    if (!chatId || !isRoleplay || pins.length === 0 || !known) return;
    if (!matchPinId || !matchBackground) {
      // Left the pinned place: arriving there again shows its picture again. Only once what the shown pin
      // matches on has loaded: a map place pin needs the map; a name pin the tracker location when the chat
      // runs World State, else the map's current place. So a chat still loading never forgets a hand pick.
      const shownPin = shownPinId ? pins.find((pin) => pin.id === shownPinId) : undefined;
      const shownPinLoaded = stateKnown || (!!spatialData && (!!shownPin?.placeId || (!tracksLocation && !!placeId)));
      if (shownPinId && (!shownPin || shownPinLoaded)) {
        updateMeta.mutate({ id: chatId, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: null });
      }
      return;
    }
    if (shownPinId === matchPinId) return;
    const filename = pinnedBackgroundForWeather(matchBackground, weather, library, weatherVersions, time, timeVersions);
    const url = chatBackgroundMetadataToUrl(filename);
    if (url) useUIStore.getState().setChatBackground(url);
    updateMeta.mutate({ id: chatId, [LOCATION_BACKGROUND_PIN_SHOWN_KEY]: matchPinId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatId,
    isRoleplay,
    known,
    stateKnown,
    !!spatialData,
    placeId,
    tracksLocation,
    pins,
    matchPinId,
    matchBackground,
    shownPinId,
    library,
  ]);
}
