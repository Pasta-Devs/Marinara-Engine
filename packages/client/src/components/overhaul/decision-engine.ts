// The built-in decision model as an "On this device" entry, beside the built-in model and voice engines.
import { useTranslation } from "react-i18next";
import { useDecisionOptions } from "../../hooks/use-decision-model";

export const DECISION_DEVICE_ID = "device:decision";

export type DecisionEngineRow = { name: string; state: string; tone: "ok" | "off" | "warn" };

/** Null where this machine cannot run it at all; the Add window still explains that. */
export function useDecisionEngine(): DecisionEngineRow | null {
  const { t } = useTranslation();
  const { data } = useDecisionOptions();
  const option = data?.options.find((entry) => entry.slot === "decision_sidecar");
  if (!option || option.unavailable === "unsupported_platform") return null;
  const name = t("ui.panels.sidecarcard.decisionSidecar");
  if (!option.unavailable) return { name, state: t("connections.accounts.state.ok"), tone: "ok" };
  if (option.unavailable === "not_enabled") return { name, state: t("connections.defaults.off"), tone: "off" };
  return {
    name,
    state: t(`connections.decision.unavailable.${option.unavailable}`, {
      detail: option.detail ?? "",
      defaultValue: t("connections.defaults.warning.unavailableShort"),
    }),
    tone: "warn",
  };
}
