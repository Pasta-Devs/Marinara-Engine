import type { QueryClient } from "@tanstack/react-query";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import type { Persona, TrackerCardColorConfig } from "../../../../engine/contracts/types/persona";
import { characterKeys } from "../../../catalog/characters/index";
import { personaKeys } from "../../../catalog/personas/index";
import { parseCharacterDisplayData } from "../../../../shared/lib/character-display";
import {
  cleanTrackerCardColorConfig,
  parseTrackerCardColorConfig,
  serializeTrackerCardColorConfig,
  TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD,
  type TrackerCardPaintColors,
} from "../../../../shared/lib/tracker-card-colors";
import {
  addAliasLookups,
  addExactNameLookups,
  normalizeLookupText,
  normalizeMaybeJsonStringArray,
} from "../../../../shared/lib/tracker-metadata";
import type { TrackerCardColorEntityLabel } from "../../../../shared/components/ui/TrackerCardColorControls";

export type TrackerCardColorTargetKind = "persona" | "character";
export type TrackerCardColorSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface CharacterRow {
  id: string;
  data: unknown;
  comment?: string | null;
}

export interface TrackerCardColorTarget {
  key: string;
  id: string;
  kind: TrackerCardColorTargetKind;
  entityLabel: TrackerCardColorEntityLabel;
  name: string;
  optionLabel: string;
  chatColors: TrackerCardPaintColors;
  config: TrackerCardColorConfig;
  serializedConfig: string;
  savedConfig: TrackerCardColorConfig;
  savedSerializedConfig: string;
  characterData?: Record<string, unknown>;
}

export interface SavedTrackerCardColorConfig {
  key: string;
  config: TrackerCardColorConfig;
  serializedConfig: string;
}

export interface TrackerCardColorPreviewSnapshot {
  target: TrackerCardColorTarget;
  savedConfig: SavedTrackerCardColorConfig;
}

export interface TrackerCardColorTargetsInput {
  activeChat: { personaId?: unknown; characterIds?: unknown } | null | undefined;
  charactersData: unknown;
  currentPresentCharacters: readonly PresentCharacter[] | null | undefined;
  personasData: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseCharacterData(raw: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function getCharacterExtensions(data: Record<string, unknown>) {
  return isRecord(data.extensions) ? data.extensions : {};
}

function getCharacterChatColors(data: Record<string, unknown>): TrackerCardPaintColors {
  const extensions = getCharacterExtensions(data);
  return {
    nameColor: getStringValue(extensions.nameColor),
    dialogueColor: getStringValue(extensions.dialogueColor),
    boxColor: getStringValue(extensions.boxColor),
  };
}

function getPersonaChatColors(persona: Persona): TrackerCardPaintColors {
  return {
    nameColor: persona.nameColor,
    dialogueColor: persona.dialogueColor,
    boxColor: persona.boxColor,
  };
}

export function mergeTrackerCardPortraitFields(
  config: TrackerCardColorConfig,
  portraitSource: TrackerCardColorConfig,
): TrackerCardColorConfig {
  return cleanTrackerCardColorConfig({
    ...config,
    portraitFocusX: portraitSource.portraitFocusX,
    portraitFocusY: portraitSource.portraitFocusY,
    portraitZoom: portraitSource.portraitZoom,
  });
}

export function getTargetSavedConfig(target: TrackerCardColorTarget): SavedTrackerCardColorConfig {
  return {
    key: target.key,
    config: target.savedConfig,
    serializedConfig: target.savedSerializedConfig,
  };
}

export function patchCharacterDataTrackerCardColors(
  rawData: unknown,
  serializedConfig: string,
  previewBaseSerializedConfig?: string,
) {
  const characterData = parseCharacterData(rawData);
  if (!characterData) return rawData;
  const nextExtensions: Record<string, unknown> = {
    ...getCharacterExtensions(characterData),
    trackerCardColors: serializedConfig,
  };
  delete nextExtensions[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD];
  if (previewBaseSerializedConfig !== undefined) {
    nextExtensions[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD] = previewBaseSerializedConfig;
  }

  const nextData = {
    ...characterData,
    extensions: nextExtensions,
  };

  return typeof rawData === "string" ? JSON.stringify(nextData) : nextData;
}

export function updateCachedTrackerCardColorTargetConfig(
  queryClient: Pick<QueryClient, "setQueryData">,
  target: TrackerCardColorTarget,
  serializedConfig: string,
  previewBaseSerializedConfig?: string,
) {
  if (target.kind === "persona") {
    queryClient.setQueryData<unknown[] | undefined>(personaKeys.list, (old) => {
      if (!Array.isArray(old)) return old;

      return old.map((persona) => {
        if (!isRecord(persona) || persona.id !== target.id) return persona;
        const nextPersona: Record<string, unknown> = { ...persona, trackerCardColors: serializedConfig };
        delete nextPersona[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD];
        if (previewBaseSerializedConfig !== undefined) {
          nextPersona[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD] = previewBaseSerializedConfig;
        }
        return nextPersona;
      });
    });
    return;
  }

  const patchCharacterCache = (old: unknown[] | undefined) => {
    if (!Array.isArray(old)) return old;

    return old.map((character) => {
      if (!isRecord(character) || character.id !== target.id) return character;
      return {
        ...character,
        data: patchCharacterDataTrackerCardColors(character.data, serializedConfig, previewBaseSerializedConfig),
      };
    });
  };

  queryClient.setQueryData<unknown[] | undefined>(characterKeys.list(), patchCharacterCache);
  queryClient.setQueryData<unknown[] | undefined>(characterKeys.summaries(), patchCharacterCache);
}

export function resolvePresentCharacterId(
  character: PresentCharacter,
  charactersById: Map<string, CharacterRow>,
  idByLookupText: Map<string, string>,
) {
  const rawId = character.characterId?.trim() ?? "";
  if (rawId && charactersById.has(rawId)) return rawId;
  if (rawId.startsWith("manual-")) return null;
  return (
    idByLookupText.get(normalizeLookupText(rawId)) ?? idByLookupText.get(normalizeLookupText(character.name)) ?? null
  );
}

export function resolveTrackerCardColorTargets({
  activeChat,
  charactersData,
  currentPresentCharacters,
  personasData,
}: TrackerCardColorTargetsInput): TrackerCardColorTarget[] {
  if (!activeChat) return [];

  const personas = Array.isArray(personasData) ? (personasData as Persona[]) : [];
  const characterRows = Array.isArray(charactersData)
    ? (charactersData as CharacterRow[]).filter((character) => typeof character.id === "string" && character.id)
    : [];
  const charactersById = new Map(characterRows.map((character) => [character.id, character]));
  const idByLookupText = new Map<string, string>();
  const activeChatCharacterIds = normalizeMaybeJsonStringArray(activeChat?.characterIds);
  const activeChatCharacterIdSet = new Set(activeChatCharacterIds);
  const displayRows = characterRows.map((character) => ({
    character,
    display: parseCharacterDisplayData(character),
  }));
  const chatDisplayRows = displayRows.filter(({ character }) => activeChatCharacterIdSet.has(character.id));
  const fallbackDisplayRows = displayRows.filter(({ character }) => !activeChatCharacterIdSet.has(character.id));

  addExactNameLookups(chatDisplayRows, idByLookupText);
  addAliasLookups(chatDisplayRows, idByLookupText);
  addExactNameLookups(fallbackDisplayRows, idByLookupText);
  addAliasLookups(fallbackDisplayRows, idByLookupText);

  const nextTargets: TrackerCardColorTarget[] = [];
  const chatPersonaId =
    typeof activeChat?.personaId === "string" && activeChat.personaId.trim() ? activeChat.personaId : null;
  const activePersona =
    (chatPersonaId
      ? (personas.find((persona) => persona.id === chatPersonaId) ?? null)
      : (personas.find((persona) => persona.isActive) ?? null));

  if (activePersona) {
    const config = parseTrackerCardColorConfig(activePersona.trackerCardColors);
    const serializedConfig = serializeTrackerCardColorConfig(config);
    const previewBaseSerializedConfig = isRecord(activePersona)
      ? activePersona[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD]
      : null;
    const savedSerializedConfig =
      typeof previewBaseSerializedConfig === "string" ? previewBaseSerializedConfig : serializedConfig;
    const savedConfig = parseTrackerCardColorConfig(savedSerializedConfig);
    nextTargets.push({
      key: `persona:${activePersona.id}`,
      id: activePersona.id,
      kind: "persona",
      entityLabel: "Persona",
      name: activePersona.name || "Persona",
      optionLabel: activePersona.name || "Persona",
      chatColors: getPersonaChatColors(activePersona),
      config,
      serializedConfig,
      savedConfig,
      savedSerializedConfig,
    });
  }

  const presentCharacterIds = new Set<string>();
  for (const id of activeChatCharacterIds) {
    if (charactersById.has(id)) presentCharacterIds.add(id);
  }
  for (const character of currentPresentCharacters ?? []) {
    const resolvedId = resolvePresentCharacterId(character, charactersById, idByLookupText);
    if (resolvedId && charactersById.has(resolvedId)) presentCharacterIds.add(resolvedId);
  }

  for (const id of presentCharacterIds) {
    const character = charactersById.get(id);
    const characterData = character ? parseCharacterData(character.data) : null;
    if (!character || !characterData) continue;
    const display = parseCharacterDisplayData(character);
    const extensions = getCharacterExtensions(characterData);
    const config = parseTrackerCardColorConfig(extensions.trackerCardColors);
    const serializedConfig = serializeTrackerCardColorConfig(config);
    const previewBaseSerializedConfig = extensions[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD];
    const savedSerializedConfig =
      typeof previewBaseSerializedConfig === "string" ? previewBaseSerializedConfig : serializedConfig;
    const savedConfig = parseTrackerCardColorConfig(savedSerializedConfig);
    nextTargets.push({
      key: `character:${id}`,
      id,
      kind: "character",
      entityLabel: "Character",
      name: display.name,
      optionLabel: display.name,
      chatColors: getCharacterChatColors(characterData),
      config,
      serializedConfig,
      savedConfig,
      savedSerializedConfig,
      characterData,
    });
  }

  return nextTargets;
}
