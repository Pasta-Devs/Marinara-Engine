import { useCallback, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { PresentCharacter } from "@marinara-engine/shared";
import { characterKeys } from "../../../hooks/use-characters";
import { api } from "../../../lib/api-client";
import { parseCharacterDisplayData } from "../../../lib/character-display";
import {
  mergeTrackerCardPortraitFields,
  parseTrackerCardColorConfig,
  useTrackerCardColorPreviews,
} from "../../../lib/tracker-card-colors";
import type { TrackerSpriteLookup } from "../tracker-panel.types";
import { isSpriteLookupCharacterId } from "../lib/sprite-expressions";
import { buildCharacterLookupMap, normalizeLookupText } from "../lib/tracker-metadata";
import { getCharacterProfileColors } from "../lib/tracker-profile-style";

interface UseTrackerSpriteLookupOptions {
  enabled: boolean;
  chatCharacterIds: string[];
  presentCharacters: PresentCharacter[];
}

interface TrackerLookupCharacterRow {
  id: string;
  data: unknown;
  comment?: string | null;
  avatarPath?: string | null;
}

function normalizeLookupCharacterIds(characterIds: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of characterIds) {
    const trimmed = id.trim();
    if (!isSpriteLookupCharacterId(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function isTrackerLookupCharacterRow(value: unknown): value is TrackerLookupCharacterRow {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

export function useTrackerSpriteLookup({ enabled, chatCharacterIds, presentCharacters }: UseTrackerSpriteLookupOptions) {
  const lookupCharacterIds = useMemo(
    () =>
      normalizeLookupCharacterIds([
        ...chatCharacterIds,
        ...presentCharacters.map((character) => character.characterId),
      ]),
    [chatCharacterIds, presentCharacters],
  );
  const previewValues = useTrackerCardColorPreviews();
  const characterQueries = useQueries({
    queries: lookupCharacterIds.map((id) => ({
      queryKey: characterKeys.detail(id),
      queryFn: () => api.get<TrackerLookupCharacterRow>(`/characters/${id}`),
      enabled,
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });
  const characterSpriteLookup = useMemo<TrackerSpriteLookup>(() => {
    const rows = characterQueries
      .map((query) => query.data)
      .filter(isTrackerLookupCharacterRow);
    const knownIds = new Set(rows.map((character) => character.id));
    const pictureById: Record<string, string> = {};
    const profileColorsById: TrackerSpriteLookup["profileColorsById"] = {};
    const displayRows = rows.map((character) => ({
      character,
      display: parseCharacterDisplayData(character),
    }));
    const idByName = buildCharacterLookupMap(displayRows);

    for (const character of rows) {
      if (character.avatarPath) pictureById[character.id] = character.avatarPath;
      const profileColors = getCharacterProfileColors(character.data);
      const preview = previewValues.get(`character:${character.id}`);
      if (preview && profileColors) {
        profileColors.trackerCardColors = mergeTrackerCardPortraitFields(
          parseTrackerCardColorConfig(preview),
          profileColors.trackerCardColors ?? parseTrackerCardColorConfig(null),
        );
      } else if (preview) {
        profileColorsById[character.id] = { trackerCardColors: parseTrackerCardColorConfig(preview) };
      }
      if (profileColors) profileColorsById[character.id] = profileColors;
    }

    return { knownIds, idByName, pictureById, profileColorsById };
  }, [characterQueries, previewValues]);

  const resolveSpriteCharacterId = useCallback(
    (character: PresentCharacter) => {
      const rawId = character.characterId?.trim() ?? "";
      if (rawId && characterSpriteLookup.knownIds.has(rawId)) return rawId;
      const idNameMatch = characterSpriteLookup.idByName.get(normalizeLookupText(rawId));
      if (idNameMatch) return idNameMatch;
      const nameMatch = characterSpriteLookup.idByName.get(normalizeLookupText(character.name));
      if (nameMatch) return nameMatch;
      return isSpriteLookupCharacterId(rawId) ? rawId : null;
    },
    [characterSpriteLookup],
  );

  return { characterSpriteLookup, resolveSpriteCharacterId };
}
