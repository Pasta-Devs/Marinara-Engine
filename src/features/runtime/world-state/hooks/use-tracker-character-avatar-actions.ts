import { useCallback, useMemo, useRef } from "react";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import { makeManualTrackerRowId } from "../../../../engine/shared/game-state/tracker-row-ids";
import { npcAvatarApi } from "../../../../shared/api/avatar-api";
import { useAgentConfigs, useUpdateAgent, type AgentConfigRow } from "../../../catalog/agents/index";
import { replaceTrackerListItem } from "../lib/tracker-state-edits";
import { TRACKER_SECTION_AGENT_TYPES } from "../lib/tracker-state-display";
import { useGameStateStore } from "../stores/world-state.store";

type UseTrackerCharacterAvatarActionsOptions = {
  chatId: string | null | undefined;
  characters: PresentCharacter[];
  onUpdateCharacters: (characters: PresentCharacter[]) => void;
  agentConfigLookupEnabled?: boolean;
};

function parseAgentSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "string") {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read avatar image."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read avatar image."));
    reader.readAsDataURL(file);
  });
}

export function useTrackerCharacterAvatarActions({
  chatId,
  characters,
  onUpdateCharacters,
  agentConfigLookupEnabled = true,
}: UseTrackerCharacterAvatarActionsOptions) {
  const avatarUploadSerialRef = useRef(0);
  const avatarUploadTokenByCharacterRef = useRef(new Map<string, number>());
  const { data: agentConfigs } = useAgentConfigs(agentConfigLookupEnabled);
  const updateAgent = useUpdateAgent();
  const characterTrackerConfig = useMemo(() => {
    if (!Array.isArray(agentConfigs)) return null;
    return (
      (agentConfigs as AgentConfigRow[]).find((agent) => agent.type === TRACKER_SECTION_AGENT_TYPES.characters) ?? null
    );
  }, [agentConfigs]);
  const characterTrackerSettings = useMemo(
    () => parseAgentSettings(characterTrackerConfig?.settings),
    [characterTrackerConfig],
  );
  const autoGenerateCharacterAvatars = characterTrackerSettings.autoGenerateAvatars === true;

  const toggleAutoGenerateCharacterAvatars = useCallback(() => {
    if (!characterTrackerConfig) return;
    const nextSettings = { ...characterTrackerSettings };
    if (autoGenerateCharacterAvatars) {
      delete nextSettings.autoGenerateAvatars;
    } else {
      nextSettings.autoGenerateAvatars = true;
    }
    updateAgent.mutate({ id: characterTrackerConfig.id, settings: nextSettings });
  }, [autoGenerateCharacterAvatars, characterTrackerConfig, characterTrackerSettings, updateAgent]);

  const uploadCharacterAvatar = useCallback(
    async (index: number, file: File) => {
      if (!chatId) return;

      const currentState = useGameStateStore.getState().current;
      const currentCharacters = currentState?.chatId === chatId ? (currentState.presentCharacters ?? []) : characters;
      const character = currentCharacters[index] ?? characters[index];
      if (!character) return;

      const existingCharacterId = character.characterId?.trim();
      const targetCharacterId = existingCharacterId || makeManualTrackerRowId();
      const uploadCharacter = existingCharacterId ? character : { ...character, characterId: targetCharacterId };
      const currentCharactersForUpload = existingCharacterId
        ? currentCharacters
        : replaceTrackerListItem(currentCharacters, index, uploadCharacter);
      if (!existingCharacterId) {
        onUpdateCharacters(currentCharactersForUpload);
      }
      const uploadKey = `${chatId}:${targetCharacterId}`;
      const uploadToken = avatarUploadSerialRef.current + 1;
      avatarUploadSerialRef.current = uploadToken;
      avatarUploadTokenByCharacterRef.current.set(uploadKey, uploadToken);
      const isLatestUpload = () => avatarUploadTokenByCharacterRef.current.get(uploadKey) === uploadToken;
      const clearUploadToken = () => {
        if (isLatestUpload()) {
          avatarUploadTokenByCharacterRef.current.delete(uploadKey);
        }
      };

      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (!isLatestUpload()) return;
        const response = await npcAvatarApi.upload(chatId, uploadCharacter.name, dataUrl);
        if (!isLatestUpload()) return;
        const latestState = useGameStateStore.getState().current;
        const latestCharacters =
          latestState?.chatId === chatId ? (latestState.presentCharacters ?? []) : currentCharactersForUpload;
        const targetIndex = latestCharacters.findIndex((candidate) => candidate.characterId === targetCharacterId);
        const latestCharacter = latestCharacters[targetIndex];
        if (!latestCharacter) return;

        onUpdateCharacters(
          replaceTrackerListItem(latestCharacters, targetIndex, {
            ...latestCharacter,
            avatarPath: response.avatarPath,
          }),
        );
      } catch {
        // Avatar uploads are an optional tracker enhancement; failed uploads leave tracker data unchanged.
      } finally {
        clearUploadToken();
      }
    },
    [characters, chatId, onUpdateCharacters],
  );

  return {
    autoGenerateCharacterAvatars,
    canToggleAutoGenerateCharacterAvatars: !!characterTrackerConfig,
    isUpdatingAutoGenerateCharacterAvatars: updateAgent.isPending,
    toggleAutoGenerateCharacterAvatars,
    uploadCharacterAvatar,
  };
}
