// ──────────────────────────────────────────────
// Character Onboarding Modal
// Shown during chat setup when a chosen character's card ships interactive
// onboarding: the player answers the card's questions and the answers become
// chat variables (and optionally a new persona). One section is rendered per
// card, since each answer lands in that card's own field.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PencilLine, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  answersFromStoredValues,
  getNextOnboardingVariable,
  getOnboardingVariables,
  getRelevantCardVariables,
  getRelevantOnboardingVariables,
  listNames,
  mergeCardVariables,
  ONBOARDING_PERSONA_FIELDS,
  ONBOARDING_PLAYER_VARIABLE,
  resolveOnboardingPersona,
  resolveCardQuestions,
  resolveOnboardingQuestions,
  type CharacterOnboarding,
  type CharacterOnboardingVariable,
  type OnboardingAnswer,
  type OnboardingAnswers,
  type OnboardingCardFields,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { ChoiceOptionsField } from "../presets/ChoiceOptionsField";
import { useCreatePersona } from "../../hooks/use-characters";
import { HIGHLIGHT_CLASS, highlightAnswerValues } from "../../lib/onboarding-preview-highlight";
import { cn } from "../../lib/utils";
import { ONBOARDING_FIELD_COPY } from "./onboarding-field-copy";

const FIELD_CLASS =
  "w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const ROW_CLASS = "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all";
const ROW_SELECTED_CLASS = "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30";
// The State Editor's secondary action (StateEditor.tsx: SECONDARY_BUTTON), with
// this window's own corner radius: Review sits beside the ghost Back and the
// primary Create, so it needs to read as a button without competing with Create.
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-4 py-2 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const PREVIEW_FIELD_CLASS =
  "whitespace-pre-wrap break-words rounded-lg bg-[var(--secondary)]/60 p-2.5 text-xs font-sans leading-relaxed text-[var(--foreground)] ring-1 ring-[var(--border)]/60";

/** The answer namespace for the persona's own questions, which belong to no card. */
const PERSONA_ANSWER_SCOPE = "\u0000persona";
/** Shared empty map, so an untouched card does not allocate per render. */
const EMPTY_ANSWERS: OnboardingAnswers = Object.freeze({});

/** Choices start on their first option; free text starts empty. */
function defaultAnswer(variable: CharacterOnboardingVariable): OnboardingAnswer {
  const first = variable.options[0];
  return first ? { optionIds: [first.id] } : { text: "" };
}

/** Answers for one list of questions, defaults for whatever isn't overridden. */
function answersFor(variables: CharacterOnboardingVariable[], overrides: OnboardingAnswers): OnboardingAnswers {
  // Own properties only, on an object without a prototype: a question named
  // `toString` or `__proto__` must not read or replace Object.prototype.
  const merged: OnboardingAnswers = Object.create(null);
  for (const variable of variables) {
    const name = variable.variableName;
    merged[name] = Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name]! : defaultAnswer(variable);
  }
  return merged;
}

/** One card the window asks about: its name, its onboarding block, and its fields. */
export interface OnboardingCardTarget {
  characterId: string;
  name: string;
  onboarding: CharacterOnboarding;
  cardFields: OnboardingCardFields;
}

/**
 * What the wizard needs to fill the owning card's greetings from the persona
 * answers: whose template it was, the template, and the answers as given.
 */
export type OnboardingPersonaTemplate = {
  cardId: string;
  onboarding: CharacterOnboarding;
  personaAnswers: OnboardingAnswers;
};

export function CharacterOnboardingModal({
  open,
  cards,
  participantNames,
  persona,
  playerName,
  initialAnswers,
  withPersona,
  onBack,
  onCreated,
  chatFloatingPanel = false,
}: {
  open: boolean;
  /**
   * Every selected card that has something to ask. One section is rendered per
   * card: each answer belongs to a different card's field, so they cannot share
   * one question list.
   */
  cards: OnboardingCardTarget[];
  /**
   * Every participating character's name, in wizard order. Deliberately NOT
   * derived from `cards`: a character with no card questions still participates,
   * and binding the intro to `cards` made its name vanish from the opening line
   * (and an empty `cards` left the sentence with no subject at all).
   */
  participantNames: string[];
  /** The card whose questions become a new persona, when one is being created. */
  persona?: { characterId?: string; characterName: string; onboarding: CharacterOnboarding } | null;
  /**
   * The player's name when it is already known — an existing persona's name.
   * Card questions show `{{user}}` in a heading, and without this they would
   * print the raw tag while a persona question beside them resolved.
   */
  playerName?: string;
  /**
   * The chat's variables, when this window is opened on a chat that already has
   * answers (Chat Settings, not the setup wizard). They seed each card's questions,
   * so saving one edited answer leaves the others as the chat saved them.
   */
  initialAnswers?: Record<string, string>;
  /** False when the player asked for no new persona: only the cards need answers. */
  withPersona: boolean;
  /** Return to the persona picker without creating anything. */
  onBack: () => void;
  /** The window stays open and locked until this settles. */
  onCreated: (
    personaId: string | null,
    cardVariables: Record<string, string>,
    template: OnboardingPersonaTemplate | null,
  ) => void | Promise<void>;
  /**
   * Inherit the chat's floating-panel styling, for a window opened from Chat
   * Settings rather than from the full-screen setup wizard.
   */
  chatFloatingPanel?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const createPersona = useCreatePersona();
  // Overrides are namespaced per card. Two cards may declare the SAME variable
  // name (a chat has only one value for it), but while editing they are still
  // two separate inputs, and one typing must not make the other's box jump.
  //
  // Seeded once from the chat's stored answers when there are some: a window
  // opened after setup has to show what the chat holds. An answer the current
  // options cannot express is seeded as an empty choice, which renders unselected
  // and writes nothing, so an untouched save keeps the stored value.
  const [overrides, setOverrides] = useState<Record<string, OnboardingAnswers>>(() => {
    if (!initialAnswers) return {};
    const seeded: Record<string, OnboardingAnswers> = {};
    for (const card of cards) {
      const answers = answersFromStoredValues(card.onboarding.cardVariables ?? [], initialAnswers);
      if (Object.keys(answers).length > 0) seeded[card.characterId] = answers;
    }
    return seeded;
  });
  // Stable identity, so the memos below can list it as a dependency instead of
  // closing over `overrides` invisibly.
  const overridesFor = useCallback(
    (characterId: string): OnboardingAnswers => overrides[characterId] ?? EMPTY_ANSWERS,
    [overrides],
  );
  const setAnswer = (characterId: string, name: string, answer: OnboardingAnswer) =>
    setOverrides((prev) => ({
      ...prev,
      [characterId]: { ...(prev[characterId] ?? EMPTY_ANSWERS), [name]: answer },
    }));

  const personaOnboarding = persona?.onboarding;
  const personaVariables = useMemo(
    () => (personaOnboarding ? getOnboardingVariables(personaOnboarding) : []),
    [personaOnboarding],
  );
  const personaAnswers = useMemo(
    () => answersFor(personaVariables, overridesFor(PERSONA_ANSWER_SCOPE)),
    [personaVariables, overridesFor],
  );
  // The name the player is typing RIGHT NOW wins over a persona picked earlier:
  // a persona question heading names the persona being built, and a card question
  // heading names the player. Both read this one value, so a card question cannot
  // show `{{user}}` while the persona question beside it shows the typed name.
  const typedPlayerName = (() => {
    const answer = personaAnswers[ONBOARDING_PLAYER_VARIABLE];
    return answer && "text" in answer ? answer.text.trim() : "";
  })();
  const questionPlayerName = typedPlayerName || playerName;
  // Each card's questions are resolved against ITS own fields, and the persona's
  // against the persona list: they resolve different things, so they keep
  // separate answer maps.
  const perCard = useMemo(
    () =>
      cards.map((card) => {
        const cardAnswers = answersFor(card.onboarding.cardVariables ?? [], overridesFor(card.characterId));
        return {
          card,
          cardAnswers,
          questions: getRelevantCardVariables(card.onboarding, card.cardFields, cardAnswers),
          questionTexts: resolveCardQuestions(card.onboarding, cardAnswers, card.name, questionPlayerName),
        };
      }),
    [cards, overridesFor, questionPlayerName],
  );
  const personaQuestions = useMemo(
    () => (withPersona && personaOnboarding ? getRelevantOnboardingVariables(personaOnboarding, personaAnswers) : []),
    [withPersona, personaOnboarding, personaAnswers],
  );
  const questionTexts = useMemo(
    () =>
      personaOnboarding
        ? resolveOnboardingQuestions(personaOnboarding, personaAnswers, persona?.characterName ?? "")
        : new Map<string, string>(),
    [personaOnboarding, personaAnswers, persona],
  );
  // A variable name two shown questions share. A chat stores ONE value per name,
  // so the last answer saved is what both cards end up reading — worth saying out
  // loud rather than silently overwriting.
  //
  // Built from the questions ACTUALLY rendered (`perCard[].questions`), not every
  // declared variable: a name the current answers ruled out of a `{{#if}}` is not
  // on screen, and warning about a clash the player cannot see or resolve is
  // noise. Relevance already accounts for the answers, so this stays in step.
  const clashes = useMemo(() => {
    const owners = new Map<string, string[]>();
    for (const entry of perCard) {
      for (const variable of entry.questions) {
        const name = variable.variableName;
        if (!name) continue;
        const list = owners.get(name) ?? [];
        list.push(entry.card.name);
        owners.set(name, list);
      }
    }
    return [...owners.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([name, names]) => ({ name, names: [...new Set(names)] }));
  }, [perCard]);

  // Card questions are OPTIONAL: a blank one simply writes no variable, and the
  // card keeps whatever it reads without it. The persona is not — it needs a
  // name and its fields are the persona's whole content.
  const personaComplete = useMemo(
    () => !withPersona || !personaOnboarding || getNextOnboardingVariable(personaOnboarding, personaAnswers) === null,
    [withPersona, personaOnboarding, personaAnswers],
  );
  // Nothing to show at all: the wizard suppresses the modal for this case, so
  // this only guards a direct render.
  const hasAnything = perCard.some((entry) => entry.questions.length > 0) || personaQuestions.length > 0;

  // The persona the Create handler will save, from the same resolver it calls, so
  // the preview cannot drift from what is actually written.
  const personaPreview = useMemo(
    () => (withPersona && personaOnboarding ? resolveOnboardingPersona(personaOnboarding, personaAnswers) : null),
    [withPersona, personaOnboarding, personaAnswers],
  );
  const previewFields = personaPreview ? ONBOARDING_PERSONA_FIELDS.filter((field) => personaPreview[field] !== "") : [];
  // The values the answers inserted into those fields, so the preview can mark
  // them. Labels and values are both offered because a blank option value means
  // "same as the label"; the highlighter keeps only the ones that occur.
  const answerValues = useMemo(() => {
    if (!personaPreview) return [];
    const values: string[] = [];
    for (const variable of personaVariables) {
      const answer = personaAnswers[variable.variableName];
      if (!answer) continue;
      if ("text" in answer) {
        values.push(answer.text);
        continue;
      }
      for (const option of variable.options) {
        if (!answer.optionIds.includes(option.id)) continue;
        values.push(option.label, option.value);
      }
    }
    return values;
  }, [personaPreview, personaVariables, personaAnswers]);
  const [reviewing, setReviewing] = useState(false);
  // The questions window can close underneath the preview (its card drops out, or
  // the wizard is dismissed); a preview left open would outlive what it previews.
  useEffect(() => {
    if (!open) setReviewing(false);
  }, [open]);

  // Set synchronously, so a double click can't create the persona twice before
  // the button re-renders as disabled.
  const creatingRef = useRef(false);
  // Locked from Create until the wizard has switched the chat to the new
  // persona, so Back or a second Create can't interleave with that update.
  const [busy, setBusy] = useState(false);
  const handleCreate = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    try {
      // Every card's answers merged into ONE map, keeping only the names each
      // card actually asks. The merge itself lives in the shared layer so the
      // rule is pinned by a regression instead of by a copy of it here.
      const cardVariables = mergeCardVariables(
        perCard.map((entry) => ({ onboarding: entry.card.onboarding, answers: entry.cardAnswers })),
        perCard.map((entry) => new Set(entry.questions.map((question) => question.variableName))),
      );
      let personaId: string | null = null;
      if (withPersona && personaOnboarding) {
        try {
          personaId = (await createPersona.mutateAsync(resolveOnboardingPersona(personaOnboarding, personaAnswers))).id;
        } catch {
          toast.error(localizeUi("ui.characters.onboarding.createFailed"));
          return;
        }
      }
      await onCreated(
        personaId,
        cardVariables,
        personaId && persona?.characterId && personaOnboarding
          ? { cardId: persona.characterId, onboarding: personaOnboarding, personaAnswers }
          : null,
      );
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  };

  const renderQuestion = (
    variable: CharacterOnboardingVariable,
    scope: { answers: OnboardingAnswers; texts: Map<string, string>; characterId: string; showName: boolean },
    setAnswerFor: (name: string, answer: OnboardingAnswer) => void,
  ) => {
    const name = variable.variableName;
    const answer = scope.answers[name];
    const ownText = answer && "text" in answer ? answer.text : null;
    const isPlayer = scope.showName && name === ONBOARDING_PLAYER_VARIABLE;
    // Each list reads its own map; ids can collide across lists, which is why
    // the map is chosen by list rather than by id alone. Falling back to the
    // unresolved text keeps a heading (and its input's aria-label) populated
    // even when nothing resolved it.
    const resolved = scope.texts.get(variable.id);
    const question = variable.question
      ? (resolved ?? variable.question)
      : isPlayer
        ? localizeUi("ui.characters.onboarding.nameQuestion")
        : name;
    const textInput = (value: string) =>
      isPlayer ? (
        <input
          value={value}
          onChange={(event) => setAnswerFor(name, { text: event.target.value })}
          placeholder={localizeUi("ui.characters.onboarding.yourAnswer")}
          aria-label={question}
          className={FIELD_CLASS}
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => setAnswerFor(name, { text: event.target.value })}
          placeholder={localizeUi("ui.characters.onboarding.yourAnswer")}
          aria-label={question}
          rows={3}
          className={cn(FIELD_CLASS, "resize-y")}
        />
      );

    return (
      <div key={variable.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
        <h4 className="mb-1 text-xs font-semibold text-[var(--foreground)]">{question}</h4>
        <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.presets.choiceselectionmodal.variable")}{" "}
          <code className="text-[var(--foreground)]">{`{{${name}}}`}</code>
        </p>
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
              onChange={(next) => setAnswerFor(name, { optionIds: Array.isArray(next) ? next : next ? [next] : [] })}
              allowBooleanToggle={false}
              ariaLabel={question}
            />
            {variable.allowCustom && (
              <>
                <button
                  type="button"
                  aria-pressed={ownText !== null}
                  onClick={() => setAnswerFor(name, { text: ownText ?? "" })}
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
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onBack}
        title={localizeUi(
          withPersona ? "ui.characters.onboarding.modalTitle" : "ui.characters.onboarding.modalTitleCardOnly",
        )}
        width="max-w-lg"
        closeDisabled={busy}
        chatFloatingPanel={chatFloatingPanel}
      >
        <fieldset disabled={busy} className="min-w-0 space-y-4 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              participantNames.length > 1
                ? "ui.characters.onboarding.modalIntroMany"
                : "ui.characters.onboarding.modalIntro",
              { value1: listNames(participantNames) },
            )}
          </p>

          {perCard.some((entry) => entry.questions.length > 0) && (
            // One top-level heading for ALL card questions, so the voice hint below
            // clearly belongs to them and not to the persona questions further down.
            <div className="space-y-1 border-t border-[var(--border)] pt-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {localizeUi("ui.characters.onboarding.cardQuestionsHeading")}
              </h3>
              {/* Always shown, not only on a clash: the answer is inserted into the
                card's own field, so a first-person line reads as the character
                talking about themselves ("Raven's relationship to Fel: I hate her").
                Nothing else in the window says which voice to write in. */}
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.characters.onboarding.modalVoiceHint")}
              </p>
            </div>
          )}

          {clashes.map((clash) => (
            <p
              key={clash.name}
              role="status"
              className="flex items-start gap-1.5 text-[0.625rem] text-[var(--foreground)]"
            >
              <AlertTriangle
                size="0.625rem"
                className="mt-0.5 shrink-0 text-[var(--marinara-app-accent-static)]"
                aria-hidden
              />
              {/* Wrapped in a span: as a bare text node it became its own flex item,
                so the icon and the sentence wrapped onto separate lines. */}
              <span>
                {localizeUi("ui.characters.onboarding.modalClashWarning", {
                  value1: listNames(clash.names),
                  value2: clash.name,
                })}
              </span>
            </p>
          ))}

          {perCard.map(({ card, cardAnswers, questions, questionTexts: texts }) =>
            questions.length === 0 ? null : (
              <section key={card.characterId} className="space-y-3">
                {/* One section per card: each answer lands in THAT card's field, so
                  two characters' questions can never share a list. */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.characters.onboarding.modalCardSectionNamed", { value1: card.name })}
                  </h4>
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.characters.onboarding.modalCardHelp", { value1: card.name })}
                  </p>
                </div>
                {questions.map((variable) =>
                  renderQuestion(
                    variable,
                    { answers: cardAnswers, texts, characterId: card.characterId, showName: false },
                    (name, answer) => setAnswer(card.characterId, name, answer),
                  ),
                )}
              </section>
            ),
          )}

          {personaQuestions.length > 0 && (
            <section className="space-y-3">
              {/* Same weight as "Character questions", and separated by a rule:
                the two halves of the window are easy to confuse otherwise. */}
              <div className="space-y-1 border-t border-[var(--border)] pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.characters.onboarding.modalPersonaSection")}
                  </h3>
                  {/* Names the card these questions came from, right on the heading.
                    The helper below said only "nothing here changes Raven", which
                    states the negative without explaining WHY Raven is there — the
                    feature's own author still had to ask which card this was. */}
                  {persona?.characterName && (
                    <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.characters.onboarding.modalPersonaSource", { value1: persona.characterName })}
                    </span>
                  )}
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.onboarding.modalPersonaHelp", {
                    value1: persona?.characterName ?? "",
                  })}
                </p>
              </div>
              {personaQuestions.map((variable) =>
                renderQuestion(
                  variable,
                  {
                    answers: personaAnswers,
                    texts: questionTexts,
                    characterId: PERSONA_ANSWER_SCOPE,
                    showName: true,
                  },
                  (name, answer) => setAnswer(PERSONA_ANSWER_SCOPE, name, answer),
                ),
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {/* Only when a persona is actually written: a card that merely carries
              character questions saves answers alone, so there is nothing to
              review. Pushed to the opposite end so Create stays the last, most
              prominent button. */}
            {personaPreview && (
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className={cn(SECONDARY_BUTTON_CLASS, "mr-auto")}
              >
                {localizeUi("ui.characters.onboarding.reviewPersona")}
              </button>
            )}
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
              disabled={!personaComplete || !hasAnything || busy}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {busy
                ? localizeUi("chat.settings.inlineEditor.saving")
                : // Only promise a persona when one is actually written: a card
                  // that merely carries character questions saves answers alone.
                  localizeUi(
                    withPersona ? "ui.characters.onboarding.createPersona" : "ui.characters.onboarding.saveAnswers",
                  )}
            </button>
          </div>
        </fieldset>
      </Modal>

      {/* The player-facing counterpart of the Character Editor's Rendered preview:
          the fields the answers produce, read-only. Only rendered while a persona
          is being created, and only lists fields with text, since the empty ones
          would be saved empty. */}
      {personaPreview && (
        <Modal
          open={reviewing}
          onClose={() => setReviewing(false)}
          title={localizeUi("ui.characters.onboarding.reviewTitle")}
          width="max-w-lg"
          chatFloatingPanel={chatFloatingPanel}
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.onboarding.reviewHelp")}
            </p>
            {previewFields.length > 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.characters.onboarding.reviewHighlight")}
              </p>
            )}
            {/* Always listed, whether or not the template repeats it in the
                description: the name is the persona's own field. */}
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {localizeUi("ui.characters.onboarding.reviewName")}
              </h3>
              <p className={PREVIEW_FIELD_CLASS}>
                {personaPreview.name || (
                  <span className="text-[var(--muted-foreground)]">
                    {localizeUi("ui.characters.onboarding.reviewNameEmpty")}
                  </span>
                )}
              </p>
            </section>
            {previewFields.map((field) => (
              <section key={field} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold text-[var(--foreground)]">
                  {localizeUi(ONBOARDING_FIELD_COPY[field].title)}
                </h3>
                <pre className={PREVIEW_FIELD_CLASS}>
                  {highlightAnswerValues(personaPreview[field], answerValues, personaOnboarding?.[field] ?? "").map(
                    (segment, index) =>
                      segment.yours ? (
                        <mark key={index} className={HIGHLIGHT_CLASS}>
                          {segment.text}
                        </mark>
                      ) : (
                        segment.text
                      ),
                  )}
                </pre>
              </section>
            ))}
            {!personaPreview.name && previewFields.length === 0 && (
              <p role="status" className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.characters.onboarding.reviewEmpty")}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setReviewing(false)} className={SECONDARY_BUTTON_CLASS}>
                {localizeUi("navigation.common.close")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
