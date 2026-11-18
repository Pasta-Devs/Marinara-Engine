import { useTranslation } from "react-i18next";
import {
  MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH,
  MAX_DECISION_CLIPS,
  MAX_DECISION_MEDIA_WITHIN,
  MAX_DECISION_PICTURES,
} from "@marinara-engine/shared";
import { openAddConnection } from "../../lib/add-connection";
import { VisionDecisionHint } from "../ui/VisionDecisionHint";

export function ActivationQuestionFields({
  question,
  threshold,
  recommendedThreshold,
  maxSkip,
  pictures,
  clips,
  mediaWithin,
  readsPictures,
  enabled,
  onChange,
}: {
  question: string;
  threshold: number;
  /** What the selected decision model answers around, when one is chosen. */
  recommendedThreshold?: number;
  maxSkip: number | "";
  /** How many of the chat's newest pictures and clips the question looks at; 0 sends text only. */
  pictures: number;
  clips: number;
  /** Ask only when one of this many newest messages has a picture or clip; "" asks every time. */
  mediaWithin: number | "";
  /** Whether the selected decision model reads pictures; the picture settings are greyed out otherwise. */
  readsPictures: boolean;
  enabled: boolean;
  onChange: (values: {
    question?: string;
    threshold?: number;
    maxSkip?: number | "";
    pictures?: number;
    clips?: number;
    mediaWithin?: number | "";
  }) => void;
}) {
  const { t } = useTranslation();
  // The slider's domain is 0.05 to 0.95 in steps of 0.05, so a recommendation off that
  // grid could never be stored by dragging it. Snapping here keeps the button's value
  // and its visibility check the same number the control can actually hold; otherwise
  // clicking it would leave the prompt on screen forever.
  const snappedRecommendation =
    recommendedThreshold === undefined
      ? undefined
      : Math.min(0.95, Math.max(0.05, Math.round(recommendedThreshold / 0.05) * 0.05));
  return (
    <section className="space-y-3">
      <div>
        <label
          className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]"
          htmlFor="agent-activation-question"
        >
          {t("agents.activation.question")}
        </label>
        <textarea
          id="agent-activation-question"
          disabled={!enabled}
          value={question}
          maxLength={MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH}
          rows={3}
          placeholder={t("agents.activation.placeholder")}
          onChange={(event) => onChange({ question: event.target.value })}
          className="w-full resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
        />
        {!enabled && (
          <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {t("agents.activation.chooseDefault")}{" "}
            <button
              type="button"
              className="text-[var(--primary)] underline"
              onClick={() => openAddConnection({ job: "decision" })}
            >
              {t("agents.activation.addDecisionModel")}
            </button>
          </p>
        )}
        <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">{t("agents.activation.help")}</p>
      </div>
      {question.trim() && (
        <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-50">
          <div>
            <label
              className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]"
              htmlFor="agent-activation-threshold"
            >
              {t("agents.activation.threshold", { value: threshold.toFixed(2) })}
            </label>
            <input
              id="agent-activation-threshold"
              className="w-full accent-[var(--primary)]"
              type="range"
              min={0.05}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(event) => onChange({ threshold: Number(event.target.value) })}
            />
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {t("agents.activation.thresholdHelp")}
            </p>
            {/* A threshold only means something next to the model that produces the
                probability, so say what the selected one answers around and offer to
                put it back rather than leaving a stale number looking deliberate. */}
            {snappedRecommendation !== undefined && Math.abs(threshold - snappedRecommendation) > 0.001 && (
              <button
                type="button"
                className="mt-1 text-[0.625rem] text-[var(--primary)] underline"
                onClick={() => onChange({ threshold: snappedRecommendation })}
              >
                {t("agents.activation.thresholdRecommended", { value: snappedRecommendation.toFixed(2) })}
              </button>
            )}
          </div>
          <div>
            <label
              htmlFor="agent-activation-max-skip"
              className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]"
            >
              {t("agents.activation.maxSkip")}
            </label>
            <input
              id="agent-activation-max-skip"
              type="number"
              min={1}
              max={100}
              value={maxSkip}
              placeholder={t("agents.activation.noCeiling")}
              onChange={(event) =>
                onChange({
                  maxSkip:
                    event.target.value === ""
                      ? ""
                      : Math.min(100, Math.max(1, Math.trunc(Number(event.target.value)) || 1)),
                })
              }
              className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">{t("agents.activation.maxSkipHelp")}</p>
          </div>
          {/* Off unless asked: each picture costs the model time, and most questions are
              about what was written. Only a decision model that reads pictures gets them. */}
          <div>
            {/* The ⓘ stays outside the greyed-out settings so it can still be opened. */}
            <span className="mb-1 flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {t("agents.activation.media")}
              {!readsPictures && <VisionDecisionHint size="0.6875rem" />}
            </span>
            {/* Greyed out for a model that cannot see, except while something is still set:
                a saved picture count or wait would otherwise stay on with no way to clear it. */}
            <fieldset
              disabled={!readsPictures && pictures === 0 && clips === 0}
              className={!readsPictures ? "opacity-50" : undefined}
            >
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label={t("agents.activation.picturesLabel")}
                  value={pictures}
                  onChange={(event) => onChange({ pictures: Number(event.target.value) })}
                  className="min-h-11 w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {/* Without a model that sees, a count can only be lowered. */}
                  {Array.from({ length: (readsPictures ? MAX_DECISION_PICTURES : pictures) + 1 }, (_, count) => (
                    <option key={count} value={count}>
                      {count === 0 ? t("agents.activation.noPictures") : t("agents.activation.pictures", { count })}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("agents.activation.clipsLabel")}
                  value={clips}
                  onChange={(event) => onChange({ clips: Number(event.target.value) })}
                  className="min-h-11 w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {/* Without a model that sees, a count can only be lowered. */}
                  {Array.from({ length: (readsPictures ? MAX_DECISION_CLIPS : clips) + 1 }, (_, count) => (
                    <option key={count} value={count}>
                      {count === 0 ? t("agents.activation.noClips") : t("agents.activation.clips", { count })}
                    </option>
                  ))}
                </select>
              </div>
              {(pictures > 0 || clips > 0) && (
                // So a picture question does not run every turn: without a picture or clip
                // in the newest messages, the agent does not run and nothing is asked.
                <label className="mt-2 block">
                  <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                    {t("agents.activation.mediaWithinLabel")}
                  </span>
                  <select
                    value={mediaWithin}
                    onChange={(event) =>
                      onChange({ mediaWithin: event.target.value === "" ? "" : Number(event.target.value) })
                    }
                    className="min-h-11 w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="">{t("agents.activation.mediaAlways")}</option>
                    {[...new Set([1, 2, 3, 5, 10, 20, ...(mediaWithin === "" ? [] : [mediaWithin])])]
                      .filter((count) => count <= MAX_DECISION_MEDIA_WITHIN)
                      .sort((a, b) => a - b)
                      .map((count) => (
                        <option key={count} value={count}>
                          {t("agents.activation.mediaWithin", { count })}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </fieldset>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">{t("agents.activation.mediaHelp")}</p>
          </div>
        </fieldset>
      )}
    </section>
  );
}
