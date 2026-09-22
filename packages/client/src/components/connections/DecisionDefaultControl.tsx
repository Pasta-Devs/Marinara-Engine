import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTestConnection, useUpdateConnection } from "../../hooks/use-connections";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { useUIStore } from "../../stores/ui.store";

export interface DecisionConnectionOption {
  id: string;
  name: string;
  provider: string;
  defaultForAgents?: unknown;
  credentialsFromConnectionId?: string | null;
  profileImportReviewRequired?: unknown;
}

export function DecisionDefaultControl({ connections }: { connections: DecisionConnectionOption[] }) {
  const { t } = useTranslation();
  const update = useUpdateConnection();
  const test = useTestConnection();
  const [feedback, setFeedback] = useState("");
  const choices = connections.filter((connection) => connection.provider === "decision");
  const selected = choices.find((connection) => isConnectionFlagTrue(connection.defaultForAgents));
  const unavailable = (connection: DecisionConnectionOption) =>
    isConnectionFlagTrue(connection.profileImportReviewRequired) ||
    !!(
      connection.credentialsFromConnectionId &&
      !connections.some(
        (other) =>
          other.id === connection.credentialsFromConnectionId &&
          !isConnectionFlagTrue(other.profileImportReviewRequired),
      )
    );
  const change = async (id: string) => {
    setFeedback("");
    test.reset();
    try {
      if (id) await update.mutateAsync({ id, defaultForAgents: true });
      else if (selected) await update.mutateAsync({ id: selected.id, defaultForAgents: false });
    } catch {
      setFeedback(t("connections.decision.saveFailed"));
    }
  };
  return (
    <div className="space-y-2 py-3">
      <label htmlFor="decision-default" className="block text-xs font-medium">
        {t("connections.decision.defaultLabel")}
      </label>
      <div className="flex gap-2">
        <select
          id="decision-default"
          value={selected?.id ?? ""}
          disabled={update.isPending || test.isPending}
          onChange={(event) => void change(event.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)]"
        >
          <option value="">{t("connections.decision.none")}</option>
          {choices.map((connection) => (
            <option key={connection.id} value={connection.id} disabled={unavailable(connection)}>
              {connection.name}
              {unavailable(connection) ? t("connections.decision.unavailableSuffix") : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected || test.isPending || update.isPending}
          onClick={() => {
            if (!selected) return;
            setFeedback("");
            test.mutate(selected.id, {
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
          }}
          className="rounded-lg px-3 py-2 text-xs ring-1 ring-[var(--border)] disabled:opacity-50"
        >
          {t(test.isPending ? "connections.decision.testing" : "connections.decision.test")}
        </button>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.decision.defaultHelp")}</p>
      {selected && unavailable(selected) && (
        <button
          type="button"
          className="text-xs text-[var(--primary)] underline"
          onClick={() => useUIStore.getState().openConnectionDetail(selected.id)}
        >
          {t("connections.decision.relink")}
        </button>
      )}
      {feedback && (
        <p role="status" className="text-xs">
          {feedback}
        </p>
      )}
    </div>
  );
}
