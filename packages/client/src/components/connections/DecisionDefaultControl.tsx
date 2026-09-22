import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DecisionLocalSlot, DecisionModelOption, DecisionThinkingMode } from "@marinara-engine/shared";
import { DECISION_THINKING_MODES } from "@marinara-engine/shared";
import {
  useDecisionOptions,
  useSelectDecisionModel,
  useSetDecisionThinking,
  useSetThinkingPreGeneration,
  useTestDecisionSlot,
  useThinkingPreGeneration,
} from "../../hooks/use-decision-model";
import { useTestConnection } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";

/**
 * The one place the decision model is chosen.
 *
 * Three groups in one list: None, the local model slots, and the Decision connections.
 * Entries that cannot serve are greyed out with the reason rather than hidden — a user
 * who read that activation questions work with their own local model needs to see why
 * the entry is not selectable, not to wonder where it went.
 */
export function DecisionDefaultControl() {
  const { t } = useTranslation();
  const options = useDecisionOptions();
  const select = useSelectDecisionModel();
  const setThinking = useSetDecisionThinking();
  const testSlot = useTestDecisionSlot();
  const testConnection = useTestConnection();
  const preGeneration = useThinkingPreGeneration();
  const setPreGeneration = useSetThinkingPreGeneration();
  const [feedback, setFeedback] = useState("");

  const entries = options.data?.options ?? [];
  const selected = entries.find((entry) => entry.selected) ?? null;
  const locals = entries.filter((entry) => entry.group === "local");
  const connections = entries.filter((entry) => entry.group === "connection");
  const busy = select.isPending || testSlot.isPending || testConnection.isPending;

  /** Why an entry cannot serve, in the user's language, with the detail the server gave. */
  const reasonFor = (entry: DecisionModelOption) =>
    entry.unavailable
      ? t(`connections.decision.unavailable.${entry.unavailable}`, {
          defaultValue: t("connections.decision.unavailableSuffix"),
          detail: entry.detail ?? "",
        })
      : "";

  const change = async (id: string) => {
    setFeedback("");
    testSlot.reset();
    testConnection.reset();
    try {
      await select.mutateAsync(id || null);
    } catch {
      setFeedback(t("connections.decision.saveFailed"));
    }
  };

  const runTest = () => {
    if (!selected) return;
    setFeedback("");
    if (selected.slot) {
      testSlot.mutate(selected.slot, {
        onSuccess: (result) =>
          setFeedback(
            result.success
              ? t("connections.decision.testSlotSuccess", {
                  probability: result.decisionProbability?.toFixed(3),
                  latency: result.latencyMs,
                  // The two things only a local slot can be unsure about.
                  logprobs: t(
                    result.logprobs ? "connections.decision.logprobsAvailable" : "connections.decision.logprobsMissing",
                  ),
                  style: t(
                    result.answersDirectly
                      ? "connections.decision.answersDirectly"
                      : "connections.decision.needsToThink",
                  ),
                })
              : t("connections.decision.testFailed", {
                  reason: t(`connections.decision.errors.${result.errorCode ?? "network"}`, {
                    defaultValue: t("connections.decision.errors.network"),
                  }),
                }),
          ),
        onError: () => setFeedback(t("connections.decision.errors.network")),
      });
      return;
    }
    testConnection.mutate(selected.id, {
      onSuccess: (result) =>
        setFeedback(
          result.success
            ? t("connections.decision.testSuccess", {
                probability: result.decisionProbability?.toFixed(3),
                latency: result.latencyMs,
              })
            : t("connections.decision.testFailed", {
                reason: t(`connections.decision.errors.${result.errorCode ?? "network"}`, {
                  defaultValue: t("connections.decision.errors.network"),
                }),
              }),
        ),
      onError: () => setFeedback(t("connections.decision.errors.network")),
    });
  };

  // A native <option> cannot be styled, so an unavailable entry carries its reason in
  // the label text. Composed here rather than in JSX so the separator is not a stray
  // untranslated string in the markup.
  const option = (entry: DecisionModelOption) => (
    <option key={entry.id} value={entry.id} disabled={!!entry.unavailable}>
      {entry.unavailable
        ? t("connections.decision.unavailableOption", { label: entry.label, reason: reasonFor(entry) })
        : entry.label}
    </option>
  );

  return (
    <div className="space-y-2 py-3">
      <label htmlFor="decision-default" className="block text-xs font-medium">
        {t("connections.decision.defaultLabel")}
      </label>
      <div className="flex gap-2">
        <select
          id="decision-default"
          value={selected?.id ?? ""}
          disabled={busy || options.isPending}
          onChange={(event) => void change(event.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)]"
        >
          <option value="">{t("connections.decision.none")}</option>
          <optgroup label={t("connections.decision.localGroup")}>{locals.map(option)}</optgroup>
          {connections.length > 0 && (
            <optgroup label={t("connections.decision.connectionGroup")}>{connections.map(option)}</optgroup>
          )}
        </select>
        <button
          type="button"
          disabled={!selected || busy}
          onClick={runTest}
          className="rounded-lg px-3 py-2 text-xs ring-1 ring-[var(--border)] disabled:opacity-50"
        >
          {t(
            testSlot.isPending || testConnection.isPending
              ? "connections.decision.testing"
              : "connections.decision.test",
          )}
        </button>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.decision.defaultHelp")}</p>

      {/* A selected entry that has since become unusable stays selected; gates fail
          open and the reason is shown here rather than silently swapping the choice. */}
      {selected?.unavailable && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-amber-400">
          <AlertTriangle size="0.875rem" className="mt-px shrink-0" aria-hidden />
          {reasonFor(selected)}
        </p>
      )}
      {selected?.unavailable === "needs_relinking" && (
        <button
          type="button"
          className="text-xs text-[var(--primary)] underline"
          onClick={() => useUIStore.getState().openConnectionDetail(selected.id)}
        >
          {t("connections.decision.relink")}
        </button>
      )}

      {selected?.slot && !selected.unavailable && (
        <LocalSlotControls
          entry={selected}
          slot={selected.slot}
          onThinking={(thinking) => setThinking.mutate({ slot: selected.slot!, thinking })}
          preGeneration={preGeneration.data?.enabled ?? false}
          onPreGeneration={(enabled) => setPreGeneration.mutate(enabled)}
        />
      )}

      {feedback && (
        <p role="status" className="text-xs">
          {feedback}
        </p>
      )}
    </div>
  );
}

/**
 * The settings that only make sense for a local slot: how its model may reach an
 * answer, what the last probe concluded, and whether a reasoning model may also gate
 * the agents that run before the reply.
 */
function LocalSlotControls({
  entry,
  slot,
  onThinking,
  preGeneration,
  onPreGeneration,
}: {
  entry: DecisionModelOption;
  slot: DecisionLocalSlot;
  onThinking: (thinking: DecisionThinkingMode) => void;
  preGeneration: boolean;
  onPreGeneration: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  // The same formula the backend defers on, so this checkbox only appears when
  // pre-generation gating is actually being skipped.
  const thinks = entry.thinking === "allowed" || (entry.thinking === "auto" && entry.answerStyle === "thinks");
  return (
    <div className="space-y-2 rounded-lg bg-[var(--secondary)]/40 p-2.5">
      <label htmlFor={`decision-thinking-${slot}`} className="block text-[0.6875rem] font-medium">
        {t("connections.decision.thinkingLabel")}
      </label>
      <select
        id={`decision-thinking-${slot}`}
        value={entry.thinking ?? "auto"}
        onChange={(event) => onThinking(event.target.value as DecisionThinkingMode)}
        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)]"
      >
        {DECISION_THINKING_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`connections.decision.thinking.${mode}`)}
          </option>
        ))}
      </select>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">{t("connections.decision.thinkingHelp")}</p>

      {entry.answerStyle !== "unknown" && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {t(
            entry.answerStyle === "direct"
              ? "connections.decision.answersDirectly"
              : "connections.decision.needsToThink",
          )}
        </p>
      )}

      {/* Reasoning takes seconds and a pre-generation gate sits in front of the reply,
          so this is opt-in and says what it costs. */}
      {thinks && (
        <label className="flex items-start gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={preGeneration}
            onChange={(event) => onPreGeneration(event.target.checked)}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>{t("connections.decision.gatePreGeneration")}</span>
        </label>
      )}

      {entry.uncalibrated && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">{t("connections.decision.uncalibrated")}</p>
      )}
    </div>
  );
}
