import { useEffect, useState, type ReactNode } from "react";
import type { ScenePromptPreferences, ScenePromptPov, ScenePromptTense } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { normalizeScenePromptPreferences } from "../../stores/ui.store";
import { usePresets } from "../../hooks/use-presets";
import { useChat } from "../../hooks/use-chats";
import { useCharacterSummaries, usePersonas } from "../../hooks/use-characters";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ScenePromptPreferencesModalProps {
  open: boolean;
  onClose: () => void;
  initialPreferences: ScenePromptPreferences;
  sourceLabel?: string | null;
  chatId?: string;
  onSubmit: (preferences: ScenePromptPreferences) => void;
  onCancel?: () => void;
}

const POV_OPTIONS: Array<{ id: ScenePromptPov; label: string }> = [
  { id: "first_person", label: "First Person" },
  { id: "second_person", label: "Second Person" },
  { id: "third_person", label: "Third Person" },
];

const TENSE_OPTIONS: Array<{ id: ScenePromptTense; label: string }> = [
  { id: "past", label: "Past" },
  { id: "present", label: "Present" },
  { id: "future", label: "Future" },
];

export function ScenePromptPreferencesModal({
  open,
  onClose,
  initialPreferences,
  sourceLabel,
  chatId,
  onSubmit,
  onCancel,
}: ScenePromptPreferencesModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: sourceChat } = useChat(chatId ?? null);
  const originCharacterIds = sourceChat?.characterIds ?? [];
  const {
    data: characters = [],
    isPending: charactersLoading,
    isError: charactersError,
  } = useCharacterSummaries(originCharacterIds, !!chatId);
  const { data: personas = [] } = usePersonas(!!chatId);
  const [participantCharacterIds, setParticipantCharacterIds] = useState<string[] | undefined>();
  const [personaSelection, setPersonaSelection] = useState("source");
  const {
    data: presetData,
    isLoading: presetsLoading,
    isError: presetsError,
    isFetching: presetsFetching,
    refetch: retryPresets,
  } = usePresets();
  const presets = presetData ?? [];
  const presetsUnverified = presetData === undefined;
  const presetLoadFailed = presetsError && presetsUnverified;
  const initial = normalizeScenePromptPreferences(initialPreferences);
  const [pov, setPov] = useState<ScenePromptPov>(initial.pov);
  const [tense, setTense] = useState<ScenePromptTense>(initial.tense);
  const [extraInstructions, setExtraInstructions] = useState(initial.extraInstructions ?? "");
  const [promptPresetId, setPromptPresetId] = useState(initial.promptPresetId ?? "");
  const [configuringPresetId, setConfiguringPresetId] = useState<string | null>(null);
  const [presetChoices, setPresetChoices] = useState<Record<string, string | string[]> | null>(null);
  const [submitAfterChoices, setSubmitAfterChoices] = useState(false);
  const unavailablePreset =
    !!promptPresetId && !presetsUnverified && !presets.some((preset) => preset.id === promptPresetId);

  useEffect(() => {
    const next = normalizeScenePromptPreferences(initialPreferences);
    setPov(next.pov);
    setTense(next.tense);
    setExtraInstructions(next.extraInstructions ?? "");
    setPromptPresetId(next.promptPresetId ?? "");
    setConfiguringPresetId(null);
    setPresetChoices(null);
    setSubmitAfterChoices(false);
  }, [initialPreferences]);

  const handleClose = () => {
    onCancel?.();
    onClose();
  };

  const submitPreferences = (choices: Record<string, string | string[]> | null) => {
    onSubmit({
      ...normalizeScenePromptPreferences({ pov, tense, extraInstructions, promptPresetId: promptPresetId || null }),
      ...(promptPresetId && choices ? { presetChoices: choices } : {}),
      ...(participantCharacterIds ? { participantCharacterIds } : {}),
      ...(personaSelection !== "source" ? { personaId: personaSelection || null } : {}),
    });
  };
  const handleSubmit = () => {
    if (promptPresetId && presetChoices === null) {
      setSubmitAfterChoices(true);
      setConfiguringPresetId(promptPresetId);
      return;
    }
    submitPreferences(presetChoices);
  };

  if (configuringPresetId) {
    return (
      <ChoiceSelectionModal
        open={open}
        presetId={configuringPresetId}
        onClose={handleClose}
        onConfirm={(choices) => {
          setPresetChoices(choices);
          setConfiguringPresetId(null);
          if (submitAfterChoices) submitPreferences(choices);
        }}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={localizeUi("ui.modals.scenepromptpreferencesmodal.scenePromptSetup")}
      width="max-w-lg"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {sourceLabel
              ? localizeUi("ui.modals.scenepromptpreferencesmodal.value1WantsToStartAScene", { value1: sourceLabel })
              : localizeUi("ui.modals.scenepromptpreferencesmodal.startAScene")}
          </p>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.scenepromptpreferencesmodal.pickTheWritingShapeBeforeMarinaraPlansTheScene")}
          </p>
        </div>

        {chatId && (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {localizeUi("scene.setup.persona")}
              </span>
              <select
                value={personaSelection}
                onChange={(event) => setPersonaSelection(event.target.value)}
                className="mari-preset-native-select min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="source">{localizeUi("scene.setup.sourcePersona")}</option>
                <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold text-[var(--foreground)]">
                {localizeUi("scene.setup.characters")}
              </legend>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={participantCharacterIds === undefined}
                  disabled={!sourceChat || originCharacterIds.length === 0}
                  onChange={(event) =>
                    setParticipantCharacterIds(event.target.checked ? undefined : [...originCharacterIds])
                  }
                  className="accent-[var(--primary)]"
                />
                {localizeUi("scene.setup.automaticParticipants")}
              </label>
              {participantCharacterIds !== undefined && (
                <div className="max-h-44 overflow-y-auto">
                  {charactersError && (
                    <p role="alert" className="text-sm">
                      {localizeUi("scene.setup.charactersLoadFailed")}
                    </p>
                  )}
                  {characters
                    .filter((character) => originCharacterIds.includes(character.id))
                    .map((character) => (
                      <label key={character.id} className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={participantCharacterIds.includes(character.id)}
                          onChange={(event) =>
                            setParticipantCharacterIds(
                              event.target.checked
                                ? [...participantCharacterIds, character.id]
                                : participantCharacterIds.filter((id) => id !== character.id),
                            )
                          }
                          className="accent-[var(--primary)]"
                        />
                        <span className="min-w-0 break-words">{character.name}</span>
                      </label>
                    ))}
                  {participantCharacterIds.length === 0 && (
                    <p role="alert" className="text-xs">
                      {localizeUi("scene.setup.chooseParticipant")}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </div>
        )}

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">
            {localizeUi("scene.setup.promptPreset")}
          </span>
          <select
            value={promptPresetId}
            disabled={presetsLoading}
            onChange={(event) => {
              setPromptPresetId(event.target.value);
              setPresetChoices(null);
              setSubmitAfterChoices(false);
              setConfiguringPresetId(event.target.value || null);
            }}
            className="mari-preset-native-select min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
          >
            <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
            {promptPresetId && (presetsUnverified || unavailablePreset) && (
              <option value={promptPresetId}>
                {localizeUi(presetsUnverified ? "scene.setup.unverifiedPreset" : "scene.setup.unavailablePreset")}
              </option>
            )}
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <span className="block text-xs text-[var(--muted-foreground)]">
            {localizeUi("scene.setup.rememberPreset")}
          </span>
          {unavailablePreset && (
            <span role="alert" className="block text-xs text-[var(--foreground)]">
              {localizeUi("scene.setup.chooseAvailablePreset")}
            </span>
          )}
        </label>
        {presetLoadFailed && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground)]">
            <span>{localizeUi("scene.setup.loadPresetsFailed")}</span>
            <button
              type="button"
              disabled={presetsFetching}
              onClick={() => void retryPresets()}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 py-2 font-semibold transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {localizeUi("scene.setup.retryPresets")}
            </button>
          </div>
        )}

        <OptionGroup label={localizeUi("ui.modals.scenepromptpreferencesmodal.pov")}>
          {POV_OPTIONS.map((option) => (
            <OptionButton
              key={option.id}
              active={pov === option.id}
              label={option.label}
              onClick={() => setPov(option.id)}
            />
          ))}
        </OptionGroup>

        <OptionGroup label={localizeUi("ui.modals.scenepromptpreferencesmodal.tense")}>
          {TENSE_OPTIONS.map((option) => (
            <OptionButton
              key={option.id}
              active={tense === option.id}
              label={option.label}
              onClick={() => setTense(option.id)}
            />
          ))}
        </OptionGroup>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">
            {localizeUi("ui.modals.scenepromptpreferencesmodal.extraInstructions")}
          </span>
          <textarea
            value={extraInstructions}
            onChange={(event) => setExtraInstructions(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={localizeUi("ui.modals.scenepromptpreferencesmodal.optionalNotesForTheGeneratedScenePrompt")}
            className="min-h-24 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--primary)]/45 focus:ring-1 focus:ring-[var(--primary)]/25"
          />
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              (!!promptPresetId && (presetsUnverified || unavailablePreset)) ||
              (participantCharacterIds !== undefined &&
                (charactersLoading || charactersError || participantCharacterIds.length === 0))
            }
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {localizeUi("ui.modals.scenepromptpreferencesmodal.planScene")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-[var(--foreground)]">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">{children}</div>
    </div>
  );
}

function OptionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-10 rounded-md border px-2 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
