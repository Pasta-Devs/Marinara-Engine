import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TrackerCardColorConfig } from "../../../../engine/contracts/types/persona";
import {
  characterKeys,
  useCharacters,
  usePersonas,
  useUpdateCharacter,
  useUpdatePersona,
} from "../../../catalog/characters/index";
import { useChat } from "../../../catalog/chats/index";
import { useTrackerStateController } from "../../../runtime/world-state/index";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import {
  cleanTrackerCardColorConfig,
  serializeTrackerCardColorConfig,
  TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD,
} from "../../../../shared/lib/tracker-card-colors";
import {
  getCharacterExtensions,
  getTargetSavedConfig,
  isRecord,
  mergeTrackerCardPortraitFields,
  parseCharacterData,
  resolveTrackerCardColorTargets,
  updateCachedTrackerCardColorTargetConfig,
  type SavedTrackerCardColorConfig,
  type TrackerCardColorPreviewSnapshot,
  type TrackerCardColorSaveState,
  type TrackerCardColorTarget,
} from "./tracker-card-color-manager";

export function useTrackerCardColorManager() {
  const queryClient = useQueryClient();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const settingsTab = useUIStore((s) => s.settingsTab);
  const { data: activeChat } = useChat(activeChatId);
  const { gameState: currentGameState, isLoadingGameState } = useTrackerStateController(
    activeChatId,
    "settings-tracker-card-colors",
  );
  const { data: personasData } = usePersonas(!!activeChatId);
  const { data: charactersData } = useCharacters(!!activeChatId);
  const updatePersona = useUpdatePersona();
  const updateCharacter = useUpdateCharacter();
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const [draftConfig, setDraftConfig] = useState<TrackerCardColorConfig | null>(null);
  const [saveState, setSaveState] = useState<TrackerCardColorSaveState>("idle");
  const selectedKeyRef = useRef<string | null>(null);
  const savedConfigRef = useRef<SavedTrackerCardColorConfig | null>(null);
  const previewSnapshotRef = useRef<TrackerCardColorPreviewSnapshot | null>(null);
  const draftChangedRef = useRef(false);

  const updateCachedTargetConfig = useCallback(
    (target: TrackerCardColorTarget, serializedConfig: string, previewBaseSerializedConfig?: string) => {
      updateCachedTrackerCardColorTargetConfig(queryClient, target, serializedConfig, previewBaseSerializedConfig);
    },
    [queryClient],
  );

  const restorePreviewSnapshot = useCallback(() => {
    const previewSnapshot = previewSnapshotRef.current;
    if (!previewSnapshot) return false;
    updateCachedTargetConfig(previewSnapshot.target, previewSnapshot.savedConfig.serializedConfig);
    previewSnapshotRef.current = null;
    return true;
  }, [updateCachedTargetConfig]);

  useEffect(() => () => void restorePreviewSnapshot(), [restorePreviewSnapshot]);

  useEffect(() => {
    if (settingsTab === "appearance") return;
    const restored = restorePreviewSnapshot();
    if (!restored) return;
    selectedKeyRef.current = null;
    savedConfigRef.current = null;
    draftChangedRef.current = false;
    setDraftConfig(null);
    setSaveState("idle");
  }, [restorePreviewSnapshot, settingsTab]);

  const targets = useMemo(
    () =>
      resolveTrackerCardColorTargets({
        activeChat,
        charactersData,
        currentPresentCharacters: currentGameState?.presentCharacters,
        personasData,
      }),
    [activeChat, charactersData, currentGameState?.presentCharacters, personasData],
  );

  const targetKeySignature = targets.map((target) => target.key).join("|");
  const selectedTarget = targets.find((target) => target.key === selectedTargetKey) ?? null;
  const getSavedConfigForTarget = useCallback((target: TrackerCardColorTarget): SavedTrackerCardColorConfig => {
    if (
      savedConfigRef.current?.key === target.key &&
      savedConfigRef.current.serializedConfig === target.savedSerializedConfig
    ) {
      return savedConfigRef.current;
    }
    return getTargetSavedConfig(target);
  }, []);
  const draftSerializedConfig = useMemo(
    () => (draftConfig ? serializeTrackerCardColorConfig(draftConfig) : ""),
    [draftConfig],
  );
  const savedConfig = selectedTarget ? getSavedConfigForTarget(selectedTarget) : null;
  const hasUnsavedChanges =
    !!selectedTarget && !!draftConfig && !!savedConfig && draftSerializedConfig !== savedConfig.serializedConfig;

  useEffect(() => {
    if (targets.length === 0) {
      setSelectedTargetKey("");
      return;
    }
    if (!selectedTargetKey || !targets.some((target) => target.key === selectedTargetKey)) {
      setSelectedTargetKey(targets[0]!.key);
    }
  }, [selectedTargetKey, targetKeySignature, targets]);

  useEffect(() => {
    if (!selectedTarget) {
      const previewSnapshot = previewSnapshotRef.current;
      if (previewSnapshot) {
        updateCachedTargetConfig(previewSnapshot.target, previewSnapshot.savedConfig.serializedConfig);
        previewSnapshotRef.current = null;
      }
      selectedKeyRef.current = null;
      savedConfigRef.current = null;
      draftChangedRef.current = false;
      setDraftConfig(null);
      setSaveState("idle");
      return;
    }

    if (selectedKeyRef.current !== selectedTarget.key) {
      const previewSnapshot = previewSnapshotRef.current;
      if (previewSnapshot && previewSnapshot.target.key !== selectedTarget.key) {
        updateCachedTargetConfig(previewSnapshot.target, previewSnapshot.savedConfig.serializedConfig);
        previewSnapshotRef.current = null;
      }
      selectedKeyRef.current = selectedTarget.key;
      savedConfigRef.current = getTargetSavedConfig(selectedTarget);
      draftChangedRef.current = false;
      setDraftConfig(selectedTarget.config);
      setSaveState("idle");
      return;
    }

    const targetSavedConfig = getTargetSavedConfig(selectedTarget);
    if (draftChangedRef.current) {
      if (savedConfigRef.current?.serializedConfig !== targetSavedConfig.serializedConfig) {
        savedConfigRef.current = targetSavedConfig;
        if (previewSnapshotRef.current?.target.key === selectedTarget.key) {
          previewSnapshotRef.current = {
            target: selectedTarget,
            savedConfig: targetSavedConfig,
          };
        }
      }
      return;
    }

    savedConfigRef.current = targetSavedConfig;
    setDraftConfig(selectedTarget.config);
  }, [selectedTarget, updateCachedTargetConfig]);

  const persistTargetConfig = useCallback(
    async (target: TrackerCardColorTarget, serializedConfig: string) => {
      if (target.kind === "persona") {
        await updatePersona.mutateAsync({ id: target.id, trackerCardColors: serializedConfig });
        return;
      }

      if (!target.characterData) return;

      const latestCharacterData =
        queryClient
          .getQueryData<unknown[] | undefined>(characterKeys.list())
          ?.map((character) => (isRecord(character) && character.id === target.id ? character : null))
          .find((character): character is Record<string, unknown> => !!character)?.data ?? target.characterData;
      const characterData = parseCharacterData(latestCharacterData) ?? target.characterData;
      const nextExtensions: Record<string, unknown> = {
        ...getCharacterExtensions(characterData),
        trackerCardColors: serializedConfig,
      };
      delete nextExtensions[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD];

      await updateCharacter.mutateAsync({
        id: target.id,
        data: {
          ...characterData,
          extensions: nextExtensions,
        },
      });
    },
    [queryClient, updateCharacter, updatePersona],
  );

  const handleChange = useCallback(
    (nextConfig: TrackerCardColorConfig) => {
      const cleanConfig = cleanTrackerCardColorConfig(
        selectedTarget ? mergeTrackerCardPortraitFields(nextConfig, selectedTarget.config) : nextConfig,
      );
      const serializedConfig = serializeTrackerCardColorConfig(cleanConfig);
      if (selectedTarget) {
        const savedTargetConfig = getSavedConfigForTarget(selectedTarget);
        updateCachedTargetConfig(
          selectedTarget,
          serializedConfig,
          serializedConfig === savedTargetConfig.serializedConfig ? undefined : savedTargetConfig.serializedConfig,
        );

        if (serializedConfig === savedTargetConfig.serializedConfig) {
          previewSnapshotRef.current = null;
          draftChangedRef.current = false;
          setSaveState("idle");
        } else {
          previewSnapshotRef.current = {
            target: selectedTarget,
            savedConfig: savedTargetConfig,
          };
          draftChangedRef.current = true;
          setSaveState("dirty");
        }
      }
      setDraftConfig(cleanConfig);
    },
    [getSavedConfigForTarget, selectedTarget, updateCachedTargetConfig],
  );

  const handleSave = useCallback(async () => {
    if (!selectedTarget || !draftConfig) return;

    const cleanConfig = cleanTrackerCardColorConfig(mergeTrackerCardPortraitFields(draftConfig, selectedTarget.config));
    const serializedConfig = serializeTrackerCardColorConfig(cleanConfig);
    const savedTargetConfig = getSavedConfigForTarget(selectedTarget);

    if (serializedConfig === savedTargetConfig.serializedConfig) {
      previewSnapshotRef.current = null;
      draftChangedRef.current = false;
      setDraftConfig(savedTargetConfig.config);
      setSaveState("idle");
      return;
    }

    setSaveState("saving");
    try {
      await persistTargetConfig(selectedTarget, serializedConfig);
      updateCachedTargetConfig(selectedTarget, serializedConfig);
      savedConfigRef.current = {
        key: selectedTarget.key,
        config: cleanConfig,
        serializedConfig,
      };
      previewSnapshotRef.current = null;
      draftChangedRef.current = false;
      setDraftConfig(cleanConfig);
      setSaveState("saved");
    } catch (error) {
      console.error("[TrackerCardColorSettings] Save failed:", error);
      draftChangedRef.current = true;
      setSaveState("error");
    }
  }, [draftConfig, getSavedConfigForTarget, persistTargetConfig, selectedTarget, updateCachedTargetConfig]);

  const handleRevert = useCallback(() => {
    if (!selectedTarget) return;

    const savedTargetConfig = getSavedConfigForTarget(selectedTarget);
    updateCachedTargetConfig(selectedTarget, savedTargetConfig.serializedConfig);
    previewSnapshotRef.current = null;
    draftChangedRef.current = false;
    setDraftConfig(savedTargetConfig.config);
    setSaveState("idle");
  }, [getSavedConfigForTarget, selectedTarget, updateCachedTargetConfig]);

  return {
    activeChatId,
    draftConfig,
    handleChange,
    handleRevert,
    handleSave,
    hasUnsavedChanges,
    isLoadingGameState,
    saveState,
    selectedTarget,
    selectedTargetKey,
    setSelectedTargetKey,
    targets,
  };
}
