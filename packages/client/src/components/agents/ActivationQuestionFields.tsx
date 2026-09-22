import { useTranslation } from "react-i18next";
import { MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";

export function ActivationQuestionFields({
  question,
  threshold,
  maxSkip,
  enabled,
  onChange,
}: {
  question: string;
  threshold: number;
  maxSkip: number | "";
  enabled: boolean;
  onChange: (values: { question?: string; threshold?: number; maxSkip?: number | "" }) => void;
}) {
  const { t } = useTranslation();
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
              onClick={() => useUIStore.getState().openRightPanel("connections")}
            >
              {t("agents.activation.openConnections")}
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
        </fieldset>
      )}
    </section>
  );
}
