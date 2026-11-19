// The built-in decision model as an "On this device" entry, beside the built-in model and voice engines.
import { useTranslation } from "react-i18next";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { useDecisionInstallProgress, useDecisionSidecar } from "../../hooks/use-decision-sidecar";

export const DECISION_DEVICE_ID = "device:decision";
/** The built-in embedding model's entry (its page is BuiltinEmbeddingDetail). */
export const EMBEDDING_DEVICE_ID = "device:embeddings";

/** `detail` is the installed model's name, like the other entries on this device show theirs. */
export type DecisionEngineRow = { name: string; state: string; tone: "ok" | "off" | "warn"; detail: string };

/** Null where this machine cannot run it at all; the Add window still explains that. */
export function useDecisionEngine(): DecisionEngineRow | null {
  const { t } = useTranslation();
  const { data } = useDecisionOptions();
  const { data: sidecar } = useDecisionSidecar(true);
  const progress = useDecisionInstallProgress(false).data?.progress ?? null;
  const option = data?.options.find((entry) => entry.slot === "decision_sidecar");
  if (!option || option.unavailable === "unsupported_platform") return null;
  const name = t("ui.panels.sidecarcard.decisionSidecar");
  const settings = sidecar?.settings;
  const detail =
    settings?.customModel?.label ??
    sidecar?.models.find((model) => model.id === settings?.modelId)?.label ??
    settings?.modelId ??
    "";
  // A download in progress, as the other built-in models show theirs, rather than "Not installed".
  if (progress)
    return {
      name,
      detail: progress.label,
      state: t("connections.builtinEmbedding.downloadingPercent", {
        percent:
          progress.phase === "model" && progress.total > 0
            ? Math.floor((progress.downloaded / progress.total) * 100)
            : 0,
      }),
      tone: "off",
    };
  if (!option.unavailable) return { name, detail, state: t("connections.accounts.state.ok"), tone: "ok" };
  if (option.unavailable === "not_enabled") return { name, detail, state: t("connections.defaults.off"), tone: "off" };
  return {
    name,
    detail,
    state: t(`connections.decision.unavailable.${option.unavailable}`, {
      detail: option.detail ?? "",
      defaultValue: t("connections.defaults.warning.unavailableShort"),
    }),
    tone: "warn",
  };
}
