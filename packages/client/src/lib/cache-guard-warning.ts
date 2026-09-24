/**
 * Data for the pre-send prompt cache warning ("Warn before a low-cache send", per chat, off unless turned on in
 * Chat settings > Advanced Parameters). The server stops a send before any model call when the prompt it built
 * would mostly have to be cached again; the player decides whether to send anyway.
 */
import { translate } from "../localization/i18n";

export interface CacheGuardWarning {
  mode?: "anthropic-ttl" | "openai-prefix";
  requestKind?: "narrator" | "tool-round";
  percent: number;
  reason: "expired" | "changed";
  uncachedChars: number;
  totalChars: number;
  minutesSinceLastSend: number;
  firstChange: { index: number; label: string } | null;
  thresholdPercent: number;
}

export function isCacheGuardWarning(value: unknown): value is CacheGuardWarning {
  if (!value || typeof value !== "object") return false;
  const warning = value as Record<string, unknown>;
  return typeof warning.percent === "number" && (warning.reason === "expired" || warning.reason === "changed");
}

/** Rough token count from characters, matching the usual four characters per token for English prose. */
function approximateTokens(chars: number): string {
  const tokens = Math.round(chars / 4);
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens);
}

export function cacheGuardWarningMessage(warning: CacheGuardWarning): string {
  const prefixEstimate = warning.mode === "openai-prefix";
  const lines = [
    prefixEstimate
      ? translate("ui.cacheGuardWarning.prefixSummary", {
          percent: warning.percent,
          threshold: warning.thresholdPercent,
        })
      : translate("ui.cacheGuardWarning.anthropicSummary", {
          percent: warning.percent,
          threshold: warning.thresholdPercent,
        }),
  ];
  if (warning.reason === "expired" && !prefixEstimate) {
    lines.push(
      translate("ui.cacheGuardWarning.anthropicExpired", {
        minutes: warning.minutesSinceLastSend,
        tokens: approximateTokens(warning.uncachedChars),
      }),
    );
  } else {
    lines.push(
      prefixEstimate
        ? translate("ui.cacheGuardWarning.prefixChanged", { tokens: approximateTokens(warning.uncachedChars) })
        : translate("ui.cacheGuardWarning.anthropicChanged", { tokens: approximateTokens(warning.uncachedChars) }),
    );
    if (warning.firstChange?.label) {
      lines.push(translate("ui.cacheGuardWarning.firstChange", { label: warning.firstChange.label }));
    }
  }
  lines.push(translate("ui.cacheGuardWarning.savedMessage"));
  return lines.join("\n\n");
}
