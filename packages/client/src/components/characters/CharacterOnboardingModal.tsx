// ──────────────────────────────────────────────
// Character Onboarding Modal
// Shown during chat setup when a chosen character's card ships interactive
// onboarding: the player answers the card's questions and the answers become
// a new persona. Questions appear and disappear as the answers change.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { PencilLine, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  getNextOnboardingVariable,
  getOnboardingVariables,
  getRelevantOnboardingVariables,
  ONBOARDING_PLAYER_VARIABLE,
  resolveOnboardingPersona,
  type CharacterOnboarding,
  type CharacterOnboardingVariable,
  type OnboardingAnswer,
  type OnboardingAnswers,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { ChoiceOptionsField } from "../presets/ChoiceOptionsField";
import { useCreatePersona } from "../../hooks/use-characters";
import { cn } from "../../lib/utils";

const FIELD_CLASS =
  "w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const ROW_CLASS = "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all";
const ROW_SELECTED_CLASS = "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30";

/** Choices start on their first option; free text starts empty. */
function defaultAnswer(variable: CharacterOnboardingVariable): OnboardingAnswer {
  const first = variable.options[0];
  return first ? { optionIds: [first.id] } : { text: "" };
}

export function CharacterOnboardingModal({
  open,
  characterName,
  onboarding,
  onBack,
  onCreated,
}: {
  open: boolean;
  characterName: string;
  onboarding: CharacterOnboarding;
  /** Return to the persona picker without creating anything. */
  onBack: () => void;
  onCreated: (personaId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const createPersona = useCreatePersona();
  const [overrides, setOverrides] = useState<OnboardingAnswers>({});

  const answers = useMemo<OnboardingAnswers>(() => {
    const merged: OnboardingAnswers = {};
    for (const variable of getOnboardingVariables(onboarding)) {
      merged[variable.variableName] = overrides[variable.variableName] ?? defaultAnswer(variable);
    }
    return merged;
  }, [onboarding, overrides]);
  const questions = useMemo(() => getRelevantOnboardingVariables(onboarding, answers), [onboarding, answers]);
  const complete = useMemo(() => getNextOnboardingVariable(onboarding, answers) === null, [onboarding, answers]);
  const setAnswer = (name: string, answer: OnboardingAnswer) => setOverrides((prev) => ({ ...prev, [name]: answer }));

  const handleCreate = async () => {
    try {
      const persona = await createPersona.mutateAsync(resolveOnboardingPersona(onboarding, answers));
      onCreated(persona.id);
    } catch {
      toast.error(localizeUi("ui.characters.onboarding.createFailed"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onBack}
      title={localizeUi("ui.characters.onboarding.modalTitle")}
      width="max-w-lg"
      closeDisabled={createPersona.isPending}
    >
      <fieldset disabled={createPersona.isPending} className="min-w-0 space-y-4 p-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.onboarding.modalIntro", { value1: characterName })}
        </p>

        {questions.map((variable) => {
          const name = variable.variableName;
          const answer = answers[name];
          const ownText = answer && "text" in answer ? answer.text : null;
          const isPlayer = name === ONBOARDING_PLAYER_VARIABLE;
          const question = variable.question || (isPlayer ? localizeUi("ui.characters.onboarding.nameQuestion") : name);
          const textInput = (value: string) =>
            isPlayer ? (
              <input
                value={value}
                onChange={(event) => setAnswer(name, { text: event.target.value })}
                placeholder={localizeUi("ui.characters.onboarding.yourAnswer")}
                aria-label={question}
                className={FIELD_CLASS}
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => setAnswer(name, { text: event.target.value })}
                placeholder={localizeUi("ui.characters.onboarding.yourAnswer")}
                aria-label={question}
                rows={3}
                className={cn(FIELD_CLASS, "resize-y")}
              />
            );

          return (
            <div key={variable.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
              <h4 className="mb-2 text-xs font-semibold text-[var(--foreground)]">{question}</h4>
              {variable.options.length === 0 ? (
                textInput(ownText ?? "")
              ) : (
                <div className="space-y-1.5">
                  <ChoiceOptionsField
                    variable={variable}
                    selection={
                      answer && "optionIds" in answer
                        ? variable.multiSelect
                          ? answer.optionIds
                          : answer.optionIds[0]
                        : undefined
                    }
                    optionKey={(option) => option.id}
                    onChange={(next) => setAnswer(name, { optionIds: Array.isArray(next) ? next : next ? [next] : [] })}
                    allowBooleanToggle={false}
                  />
                  {variable.allowCustom && (
                    <>
                      <button
                        type="button"
                        aria-pressed={ownText !== null}
                        onClick={() => setAnswer(name, { text: ownText ?? "" })}
                        className={cn(ROW_CLASS, ownText !== null ? ROW_SELECTED_CLASS : "hover:bg-[var(--accent)]")}
                      >
                        {ownText !== null ? (
                          <CheckCircle2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        ) : (
                          <Circle size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium",
                            ownText !== null && "text-[var(--primary)]",
                          )}
                        >
                          <PencilLine size="0.75rem" />
                          {localizeUi("ui.characters.onboarding.writeYourOwn")}
                        </span>
                      </button>
                      {ownText !== null && textInput(ownText)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            {localizeUi("navigation.common.back")}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!complete || createPersona.isPending}
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {createPersona.isPending
              ? localizeUi("chat.settings.inlineEditor.saving")
              : localizeUi("ui.characters.onboarding.createPersona")}
          </button>
        </div>
      </fieldset>
    </Modal>
  );
}
