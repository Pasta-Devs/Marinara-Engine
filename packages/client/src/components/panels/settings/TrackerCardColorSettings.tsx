import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Palette, RotateCcw, Save, TriangleAlert } from "lucide-react";
import type { Persona, PresentCharacter, TrackerCardColorConfig } from "@marinara-engine/shared";
import {
  useCharacters,
  usePersonas,
  useUpdateCharacter,
  useUpdatePersona,
} from "../../../hooks/use-characters";
import { useChat } from "../../../hooks/use-chats";
import { useChatStore } from "../../../stores/chat.store";
import { useUIStore } from "../../../stores/ui.store";
import { parseCharacterDisplayData } from "../../../lib/character-display";
import { cn } from "../../../lib/utils";
import {
  mergeTrackerCardPortraitFields,
  parseTrackerCardColorConfig,
  serializeTrackerCardColorConfig,
  setTrackerCardColorPreview,
  type TrackerCardColorTargetKey,
  type TrackerCardPaintColors,
} from "../../../lib/tracker-card-colors";
import { useTrackerGameState } from "../../../features/tracker-panel/hooks/use-tracker-game-state";
import {
  buildCharacterLookupMap,
  normalizeLookupText,
  normalizeMaybeJsonStringArray,
} from "../../../features/tracker-panel/lib/tracker-metadata";
import { TrackerCardColorControls, type TrackerCardColorEntityLabel } from "../../ui/TrackerCardColorControls";

type TrackerCardColorSaveState = "idle" | "saving" | "saved" | "error";

interface CharacterRow {
  id: string;
  data: unknown;
  comment?: string | null;
  avatarPath?: string | null;
}

interface TrackerCardColorTarget {
  key: TrackerCardColorTargetKey;
  id: string;
  kind: "persona" | "character";
  entityLabel: TrackerCardColorEntityLabel;
  optionLabel: string;
  chatColors: TrackerCardPaintColors;
  config: TrackerCardColorConfig;
}

interface SavedTrackerCardColorConfig {
  key: string;
  config: TrackerCardColorConfig;
  serializedConfig: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCharacterData(raw: unknown): Record<string, unknown> | null {
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

function getCharacterExtensions(data: Record<string, unknown>) {
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

function getTargetSavedConfig(target: TrackerCardColorTarget): SavedTrackerCardColorConfig {
  return {
    key: target.key,
    config: target.config,
    serializedConfig: serializeTrackerCardColorConfig(target.config),
  };
}

function resolvePresentCharacterId(
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

export function TrackerCardColorSettings() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const settingsTab = useUIStore((s) => s.settingsTab);
  const { data: activeChat } = useChat(activeChatId);
  const { currentGameState, isLoadingGameState } = useTrackerGameState(activeChatId);
  const { data: personasData } = usePersonas(!!activeChatId);
  const { data: charactersData } = useCharacters(!!activeChatId);
  const updatePersona = useUpdatePersona();
  const updateCharacter = useUpdateCharacter();
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const [draftConfig, setDraftConfig] = useState<TrackerCardColorConfig | null>(null);
  const [saveState, setSaveState] = useState<TrackerCardColorSaveState>("idle");
  const savedConfigRef = useRef<SavedTrackerCardColorConfig | null>(null);
  const previewTargetKeyRef = useRef<TrackerCardColorTargetKey | null>(null);

  const restorePreviewSnapshot = useCallback(() => {
    const previewTargetKey = previewTargetKeyRef.current;
    if (!previewTargetKey) return false;
    setTrackerCardColorPreview(previewTargetKey, null);
    previewTargetKeyRef.current = null;
    return true;
  }, []);

  useEffect(() => {
    return () => {
      restorePreviewSnapshot();
    };
  }, [restorePreviewSnapshot]);

  useEffect(() => {
    if (settingsTab === "appearance") return;
    const restored = restorePreviewSnapshot();
    if (!restored) return;
    savedConfigRef.current = null;
    setDraftConfig(null);
    setSaveState("idle");
  }, [restorePreviewSnapshot, settingsTab]);

  const targets = useMemo<TrackerCardColorTarget[]>(() => {
    const personas = Array.isArray(personasData) ? (personasData as Persona[]) : [];
    const characterRows = Array.isArray(charactersData)
      ? (charactersData as CharacterRow[]).filter((character) => typeof character.id === "string" && character.id)
      : [];
    const charactersById = new Map(characterRows.map((character) => [character.id, character]));
    const activeChatCharacterIds = normalizeMaybeJsonStringArray(
      (activeChat as { characterIds?: unknown } | null | undefined)?.characterIds,
    );
    const activeChatCharacterIdSet = new Set(activeChatCharacterIds);
    const displayRows = characterRows.map((character) => ({
      character,
      display: parseCharacterDisplayData(character),
    }));
    const chatDisplayRows = displayRows.filter(({ character }) => activeChatCharacterIdSet.has(character.id));
    const fallbackDisplayRows = displayRows.filter(({ character }) => !activeChatCharacterIdSet.has(character.id));

    const idByLookupText = buildCharacterLookupMap(chatDisplayRows, fallbackDisplayRows);

    const nextTargets: TrackerCardColorTarget[] = [];
    const chatPersonaId =
      activeChat && typeof activeChat.personaId === "string" && activeChat.personaId.trim()
        ? activeChat.personaId
        : null;
    const activePersona =
      (chatPersonaId ? personas.find((persona) => persona.id === chatPersonaId) : null) ??
      personas.find((persona) => persona.isActive) ??
      null;

    if (activePersona) {
      const config = parseTrackerCardColorConfig(activePersona.trackerCardColors);
      nextTargets.push({
        key: `persona:${activePersona.id}`,
        id: activePersona.id,
        kind: "persona",
        entityLabel: "Persona",
        optionLabel: activePersona.name || "Persona",
        chatColors: getPersonaChatColors(activePersona),
        config,
      });
    }

    const presentCharacterIds = new Set<string>();
    for (const id of activeChatCharacterIds) {
      if (charactersById.has(id)) presentCharacterIds.add(id);
    }
    for (const character of currentGameState?.presentCharacters ?? []) {
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
      nextTargets.push({
        key: `character:${id}`,
        id,
        kind: "character",
        entityLabel: "Character",
        optionLabel: display.name,
        chatColors: getCharacterChatColors(characterData),
        config,
      });
    }

    return nextTargets;
  }, [activeChat, charactersData, currentGameState?.presentCharacters, personasData]);

  const selectedTarget = targets.find((target) => target.key === selectedTargetKey) ?? null;
  const getSavedConfigForTarget = useCallback((target: TrackerCardColorTarget): SavedTrackerCardColorConfig => {
    const targetSavedConfig = getTargetSavedConfig(target);
    if (
      savedConfigRef.current?.key === target.key &&
      savedConfigRef.current.serializedConfig === targetSavedConfig.serializedConfig
    ) {
      return savedConfigRef.current;
    }
    return targetSavedConfig;
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
  }, [selectedTargetKey, targets]);

  useEffect(() => {
    if (!selectedTarget) {
      restorePreviewSnapshot();
      savedConfigRef.current = null;
      setDraftConfig(null);
      setSaveState("idle");
      return;
    }

    if (savedConfigRef.current?.key !== selectedTarget.key) {
      const previewTargetKey = previewTargetKeyRef.current;
      if (previewTargetKey && previewTargetKey !== selectedTarget.key) {
        restorePreviewSnapshot();
      }
      savedConfigRef.current = getTargetSavedConfig(selectedTarget);
      setDraftConfig(selectedTarget.config);
      setSaveState("idle");
      return;
    }

    const targetSavedConfig = getTargetSavedConfig(selectedTarget);
    if (previewTargetKeyRef.current === selectedTarget.key) {
      if (savedConfigRef.current?.serializedConfig !== targetSavedConfig.serializedConfig) {
        savedConfigRef.current = targetSavedConfig;
      }
      return;
    }

    savedConfigRef.current = targetSavedConfig;
    setDraftConfig(selectedTarget.config);
  }, [restorePreviewSnapshot, selectedTarget]);

  useEffect(() => {
    if (settingsTab !== "appearance" || !selectedTarget || draftConfig) return;

    savedConfigRef.current = getTargetSavedConfig(selectedTarget);
    setDraftConfig(selectedTarget.config);
    setSaveState("idle");
  }, [draftConfig, selectedTarget, settingsTab]);

  const persistTargetConfig = useCallback(
    async (target: TrackerCardColorTarget, config: TrackerCardColorConfig) => {
      if (target.kind === "persona") {
        const updatedPersona = await updatePersona.mutateAsync({
          id: target.id,
          trackerCardPaint: config,
        });
        return parseTrackerCardColorConfig(updatedPersona?.trackerCardColors);
      }

      const updatedCharacter = await updateCharacter.mutateAsync({
        id: target.id,
        trackerCardPaint: config,
      });
      const updatedCharacterData = isRecord(updatedCharacter) ? parseCharacterData(updatedCharacter.data) : null;
      if (!updatedCharacterData) return config;
      const extensions = getCharacterExtensions(updatedCharacterData);
      return parseTrackerCardColorConfig(extensions.trackerCardColors);
    },
    [updateCharacter, updatePersona],
  );

  const handleChange = (nextConfig: TrackerCardColorConfig) => {
    if (!selectedTarget) return;

    const cleanConfig = mergeTrackerCardPortraitFields(nextConfig, selectedTarget.config);
    const serializedConfig = serializeTrackerCardColorConfig(cleanConfig);
    const savedTargetConfig = getSavedConfigForTarget(selectedTarget);
    const matchesSavedConfig = serializedConfig === savedTargetConfig.serializedConfig;
    setTrackerCardColorPreview(selectedTarget.key, matchesSavedConfig ? null : serializedConfig);

    if (matchesSavedConfig) {
      previewTargetKeyRef.current = null;
    } else {
      previewTargetKeyRef.current = selectedTarget.key;
    }
    setSaveState("idle");
    setDraftConfig(cleanConfig);
  };

  const handleSave = useCallback(async () => {
    if (!selectedTarget || !draftConfig) return;

    const cleanConfig = mergeTrackerCardPortraitFields(draftConfig, selectedTarget.config);
    const serializedConfig = serializeTrackerCardColorConfig(cleanConfig);
    const savedTargetConfig = getSavedConfigForTarget(selectedTarget);

    if (serializedConfig === savedTargetConfig.serializedConfig) {
      previewTargetKeyRef.current = null;
      setDraftConfig(savedTargetConfig.config);
      setSaveState("idle");
      return;
    }

    setSaveState("saving");
    try {
      const persistedConfig = await persistTargetConfig(selectedTarget, cleanConfig);
      const persistedSerializedConfig = serializeTrackerCardColorConfig(persistedConfig);
      setTrackerCardColorPreview(selectedTarget.key, null);
      savedConfigRef.current = {
        key: selectedTarget.key,
        config: persistedConfig,
        serializedConfig: persistedSerializedConfig,
      };
      previewTargetKeyRef.current = null;
      setDraftConfig(persistedConfig);
      setSaveState("saved");
    } catch (error) {
      console.error("[TrackerCardColorSettings] Save failed:", error);
      setSaveState("error");
    }
  }, [draftConfig, getSavedConfigForTarget, persistTargetConfig, selectedTarget]);

  const handleRevert = useCallback(() => {
    if (!selectedTarget) return;

    const savedTargetConfig = getSavedConfigForTarget(selectedTarget);
    setTrackerCardColorPreview(selectedTarget.key, null);
    previewTargetKeyRef.current = null;
    setDraftConfig(savedTargetConfig.config);
    setSaveState("idle");
  }, [getSavedConfigForTarget, selectedTarget]);

  const saveMessage =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed"
        : hasUnsavedChanges
          ? "Unsaved preview"
          : saveState === "saved"
            ? "Saved"
            : "";

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-[var(--background)]/36 p-1.5 ring-1 ring-[var(--border)]">
      <div className="flex min-h-5 items-center justify-between gap-2 px-0.5">
        <span className="inline-flex min-w-0 items-center gap-1 text-[0.625rem] font-medium text-[var(--foreground)]">
          <Palette size="0.6875rem" className="text-[var(--primary)]" />
          Card colors
        </span>
        {saveMessage && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[0.5625rem] text-[var(--muted-foreground)]",
              saveState === "error" && "text-[var(--destructive)]",
              saveState === "saved" && "text-[var(--primary)]",
              hasUnsavedChanges && saveState !== "error" && "text-[var(--primary)]",
            )}
          >
            {saveState === "saving" ? (
              <Loader2 size="0.625rem" className="animate-spin" />
            ) : saveState === "error" ? (
              <TriangleAlert size="0.625rem" />
            ) : hasUnsavedChanges ? (
              <Palette size="0.625rem" />
            ) : (
              <CheckCircle2 size="0.625rem" />
            )}
            {saveMessage}
          </span>
        )}
      </div>

      {!activeChatId ? (
        <p className="rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          Select a chat to edit tracker card colors.
        </p>
      ) : isLoadingGameState && targets.length === 0 ? (
        <p className="mari-chrome-text-muted rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed">
          Loading current tracker cards...
        </p>
      ) : targets.length === 0 ? (
        <p className="rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          No active persona or present character IDs are available for this chat.
        </p>
      ) : (
        <>
          <label className="grid gap-1">
            <span className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">Editing</span>
            <select
              value={selectedTargetKey}
              onChange={(event) => setSelectedTargetKey(event.target.value)}
              disabled={saveState === "saving" || hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save or revert before choosing another card." : undefined}
              className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {targets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.optionLabel}
                </option>
              ))}
            </select>
          </label>

          {selectedTarget && (
            <div className="flex min-w-0 items-center justify-end gap-1 px-0.5">
              <button
                type="button"
                onClick={handleRevert}
                disabled={!hasUnsavedChanges || saveState === "saving"}
                title="Revert to previous save"
                className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-1.5 text-[0.625rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RotateCcw size="0.6875rem" />
                <span>Revert</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || saveState === "saving"}
                className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-[var(--primary)]/30 bg-[var(--primary)]/12 px-1.5 text-[0.625rem] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/18 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--secondary)] disabled:text-[var(--muted-foreground)] disabled:opacity-45"
              >
                {saveState === "saving" ? (
                  <Loader2 size="0.6875rem" className="animate-spin" />
                ) : (
                  <Save size="0.6875rem" />
                )}
                <span>Save</span>
              </button>
            </div>
          )}

          {selectedTarget && draftConfig && (
            <TrackerCardColorControls
              value={draftConfig}
              onChange={handleChange}
              chatColors={selectedTarget.chatColors}
              entityLabel={selectedTarget.entityLabel}
              disabled={saveState === "saving"}
            />
          )}
        </>
      )}
    </div>
  );
}
