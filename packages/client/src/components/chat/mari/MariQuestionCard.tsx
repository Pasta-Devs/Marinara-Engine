import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { CheckCircle2, CheckSquare, Circle, MessageCircleQuestion, Square } from "lucide-react";
import { formatMariQuestionAnswers } from "@marinara-engine/shared";
import type { MariQuestion } from "@marinara-engine/shared";

import { MariRow } from "../mari-primitives";

/**
 * The card `ask` ends her turn on, in the same frame as `MariHeldChangeCard`: one question at a time, then Submit
 * sends the answers as your next message. Nothing is focused on arrival, so a stray Enter never answers it.
 */
export function MariQuestionCard({
  questions,
  disabled,
  onSubmit,
}: {
  questions: readonly MariQuestion[];
  disabled: boolean;
  onSubmit: (answer: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const lastPickedQuestion = useRef<string | null>(null);
  const question = questions[step];
  if (!question) return null;
  const isLast = step === questions.length - 1;
  const answers = Object.fromEntries(
    questions.map(({ id }) => [id, [...(picked[id] ?? []), typed[id] ?? ""].filter((answer) => answer.trim())]),
  );
  const answer = formatMariQuestionAnswers(questions, answers);

  const goTo = (next: number) => {
    lastPickedQuestion.current = null;
    setStep(next);
  };
  const pick = (label: string) => {
    lastPickedQuestion.current = question.id;
    if (question.multiple) {
      const current = picked[question.id] ?? [];
      setPicked({
        ...picked,
        [question.id]: current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
      });
      return;
    }
    // One answer: your typed one gives way to the pick, and the next question comes up.
    setPicked({ ...picked, [question.id]: [label] });
    setTyped({ ...typed, [question.id]: "" });
    if (!isLast) setStep(step + 1);
  };
  const type = (value: string) => {
    setTyped({ ...typed, [question.id]: value });
    if (!question.multiple && value.trim()) setPicked({ ...picked, [question.id]: [] });
  };
  const submit = () => {
    if (!disabled && answer) onSubmit(answer);
  };

  const SelectedIcon = question.multiple ? CheckSquare : CheckCircle2;
  const OpenIcon = question.multiple ? Square : Circle;
  return (
    <div className="mari-list mari-receipt mari-question" data-needs-you="true">
      <div className="mari-receipt__head">
        <span className="mari-receipt__face">
          <MessageCircleQuestion size="1rem" aria-hidden="true" />
        </span>
        <span className="mari-receipt__text">
          <span className="mari-question__title">{question.question}</span>
          <span className="mari-receipt__what">
            {questions.length > 1
              ? localizeUi("mari.question.step", { step: step + 1, count: questions.length })
              : null}
            {questions.length > 1 && question.multiple ? " · " : null}
            {question.multiple ? localizeUi("mari.question.chooseAny") : null}
          </span>
        </span>
      </div>
      <div role={question.multiple ? "group" : "radiogroup"} aria-label={question.question}>
        {question.options.map((option) => {
          const selected = (picked[question.id] ?? []).includes(option.label);
          return (
            <MariRow
              key={option.label}
              slot={selected ? <SelectedIcon size="1rem" /> : <OpenIcon size="1rem" />}
              title={option.label}
              fact={option.detail}
              badge={
                option.recommended ? (
                  <span className="mari-question__recommended">{localizeUi("mari.question.recommended")}</span>
                ) : undefined
              }
              state={selected ? "selected" : undefined}
              role={question.multiple ? "checkbox" : "radio"}
              aria-checked={selected}
              disabled={disabled}
              // A single pick moves to the next question, under the same pointer: a double-click must not answer that one
              // too. A repeat click on the question it picked in is a real one, which a multi-select toggles.
              onClick={(event) => {
                if (event.detail < 2 || lastPickedQuestion.current === question.id) pick(option.label);
              }}
            />
          );
        })}
      </div>
      <input
        type="text"
        className="mari-question__other"
        value={typed[question.id] ?? ""}
        placeholder={localizeUi("mari.question.other")}
        aria-label={localizeUi("mari.question.other")}
        disabled={disabled}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (isLast) submit();
          else goTo(step + 1);
        }}
      />
      <div className="mari-receipt__foot">
        <span className="mari-receipt__actions">
          {step > 0 ? (
            <button type="button" className="mari-link" onClick={() => goTo(step - 1)}>
              {localizeUi("mari.question.back")}
            </button>
          ) : null}
        </span>
        <span className="mari-receipt__actions">
          {isLast ? (
            <button type="button" className="mari-btn mari-btn--solid" disabled={disabled || !answer} onClick={submit}>
              {localizeUi("mari.question.submit")}
            </button>
          ) : (
            <button type="button" className="mari-btn" onClick={() => goTo(step + 1)}>
              {localizeUi("mari.question.next")}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
