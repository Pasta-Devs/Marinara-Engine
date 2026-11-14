import { useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  LOCATION_BACKGROUND_PIN_SHOWN_KEY,
  LOCATION_BACKGROUND_PINS_KEY,
  normalizeLocationBackgroundPins,
  resolveLocationBackgroundPin,
  type LocationBackgroundMatch,
  type LocationBackgroundPin,
} from "@marinara-engine/shared";
import { chatBackgroundMetadataToUrl } from "../lib/backgrounds";
import { useGameStateStore } from "../stores/game-state.store";
import { useUIStore } from "../stores/ui.store";
import { useUpdateChatMetadata } from "./use-chats";
import { useSpatialContext } from "./use-spatial-context";

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

  const gameState = useGameStateStore((state) => state.current);
  const stateKnown = !!gameState && gameState.chatId === chatId;
  const location = stateKnown ? (gameState?.location ?? null) : null;

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
    const url = chatBackgroundMetadataToUrl(matchBackground);
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
  ]);
}
