import { useEffect, useState, type ReactNode } from "react";
import type { ScenePromptPreferences, ScenePromptPov, ScenePromptTense } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { normalizeScenePromptPreferences } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ScenePromptPreferencesModalProps {
  open: boolean;
  onClose: () => void;
  initialPreferences: ScenePromptPreferences;
  sourceLabel?: string | null;
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
  onSubmit,
  onCancel,
}: ScenePromptPreferencesModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const initial = normalizeScenePromptPreferences(initialPreferences);
  const [pov, setPov] = useState<ScenePromptPov>(initial.pov);
  const [tense, setTense] = useState<ScenePromptTense>(initial.tense);
  const [extraInstructions, setExtraInstructions] = useState(initial.extraInstructions ?? "");

  useEffect(() => {
    const next = normalizeScenePromptPreferences(initialPreferences);
    setPov(next.pov);
    setTense(next.tense);
    setExtraInstructions(next.extraInstructions ?? "");
  }, [initialPreferences]);

  const handleClose = () => {
    onCancel?.();
    onClose();
  };

  const handleSubmit = () => {
    onSubmit(
      normalizeScenePromptPreferences({
        pov,
        tense,
        extraInstructions,
      }),
    );
  };

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
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
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
