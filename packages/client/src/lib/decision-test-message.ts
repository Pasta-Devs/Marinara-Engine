import type { TFunction } from "i18next";
import { DECISION_TIMEOUT_MS, type ConnectionTestResult } from "@marinara-engine/shared";

const formatSeconds = (ms: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(ms / 1000);

/**
 * A Decision connection's Test result, with the real answer time next to the limit
 * chats use. The Test waits well past that limit, so an answer that would arrive too
 * late during a chat is reported as slow rather than looking like a dead endpoint.
 */
export function decisionConnectionTestMessage(t: TFunction, result: ConnectionTestResult) {
  const limit = result.timeLimitMs ?? DECISION_TIMEOUT_MS.systemOne;
  if (result.success) {
    const tooSlow = result.latencyMs > limit;
    return {
      ok: !tooSlow,
      message: t(tooSlow ? "connections.decision.testTooSlow" : "connections.decision.testSuccess", {
        probability: result.decisionProbability?.toFixed(3),
        seconds: formatSeconds(result.latencyMs),
        limit: formatSeconds(limit),
      }),
    };
  }
  const reason =
    result.errorCode === "timeout" && result.testTimeoutMs
      ? t("connections.decision.errors.testTimeout", { seconds: formatSeconds(result.testTimeoutMs) })
      : t(`connections.decision.errors.${result.errorCode ?? "network"}`, {
          defaultValue: t("connections.decision.errors.network"),
        });
  return { ok: false, message: t("connections.decision.testFailed", { reason }) };
}
