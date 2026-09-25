// ──────────────────────────────────────────────
// NanoGPT Subscription Usage Widget
// ──────────────────────────────────────────────
//
// Quota semantics that this widget must respect (see NanoGPT's management API docs):
//   * `percentUsed` is a FRACTION (0.25 = 25%), and it MAY EXCEED 1.
//   * A null quota window means "not configured" — not zero usage.
//   * `degraded: true` with null counters means "unknown" — it must never render
//     as a full or empty allowance.
//   * `active: true` alone does not mean quota remains.

import { useTranslation as useUiTranslation } from "react-i18next";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import { useNanoGptSubscriptionUsage, type NanoGptQuotaWindow } from "../../hooks/use-connections";
import { quotaPercentForDisplay, quotaTotalForDisplay } from "../../lib/nanogpt-quota";

/**
 * The provider's display name, from the shared provider catalog rather than a
 * literal, so a second provider wiring up its own meter is labelled by its own
 * definition instead of this widget's name for it.
 */
function providerDisplayName(provider: string | null | undefined): string {
  const definition = provider ? PROVIDERS[provider as APIProvider] : undefined;
  return definition?.name ?? provider ?? "";
}

function formatTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

/**
 * Which color the bar uses. The app's own accent token is the default so the bar
 * follows the user's theme, including its gradient, exactly as the context bar
 * beside it does; the warning tones only take over as the quota runs out, where
 * a themed color would understate the problem.
 */
function barFill(percent: number, useAccentColor: boolean): string {
  if (percent >= 90) return "bg-[var(--marinara-editor-accent)]";
  if (percent >= 70 && !useAccentColor) return "bg-amber-400";
  return "bg-[var(--marinara-chat-chrome-accent)]";
}

function QuotaBar({
  label,
  window,
  compact = false,
  onRefresh,
  isRefreshing = false,
}: {
  label: string;
  window: NanoGptQuotaWindow;
  compact?: boolean;
  /** Compact only: the refresh control sits at the end of this row. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const percent = quotaPercentForDisplay(window.percentUsed);

  // Unknown is not zero: a degraded lookup has no honest bar to draw.
  if (percent === null) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">{label}</span>
          <span className="text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">
            {localizeUi("ui.connections.connectioneditor.usageUnknown")}
          </span>
        </div>
        <div
          className={
            compact
              ? "mt-1 h-1 overflow-hidden rounded-full bg-[var(--muted)]/55"
              : "mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
          }
        />
        {window.degraded && !compact && (
          <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.connections.connectioneditor.usageLookupUnavailable")}
          </p>
        )}
      </div>
    );
  }

  const used = formatTokens(window.used);
  const total = quotaTotalForDisplay(window);
  const roundedPercent = String(Math.round(percent));
  // The wider layouts state the percentage and the tokens together; the compact
  // one leaves the tokens to the header row above and states only the percentage.
  const reading =
    total !== null
      ? localizeUi("ui.connections.connectioneditor.usagePercentAndUsedOfLimit", {
          percent: roundedPercent,
          used,
          limit: formatTokens(total),
        })
      : localizeUi("ui.connections.connectioneditor.usagePercentOf", {
          percent: roundedPercent,
          used,
        });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {compact
            ? localizeUi("ui.connections.connectioneditor.usagePercentUsed", { percent: roundedPercent })
            : label}
        </span>
        {compact ? (
          onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="-mb-0.5 rounded-md p-0.5 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:text-[var(--marinara-chat-chrome-accent)] disabled:opacity-50"
              aria-label={localizeUi("ui.connections.connectioneditor.refreshUsage")}
            >
              <RefreshCw size="0.6875rem" className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )
        ) : (
          <span className="text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">{reading}</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={localizeUi("ui.connections.connectioneditor.usageAria", {
          label,
          percent: String(Math.round(percent)),
        })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className={
          compact
            ? "mt-1 h-1 overflow-hidden rounded-full bg-[var(--muted)]/55"
            : "mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
        }
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${barFill(
            percent,
            compact,
          )}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!compact && window.remaining !== null && (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.usageRemaining", {
            remaining: formatTokens(window.remaining),
          })}
        </p>
      )}
    </div>
  );
}

export function NanoGptUsageWidget({
  connectionId,
  /**
   * Which surface this is drawn on.
   *   "card"   — the connection editor: a bordered card carrying every detail.
   *   "inline" — under a chat picker's context bar, which it mirrors in size,
   *              spacing and color, with the optional hints dropped.
   *   "panel"  — a chat settings section: sized like the context bar, but
   *              bordered like the editor cards around it in that drawer.
   */
  variant = "card",
}: {
  connectionId: string;
  variant?: "card" | "inline" | "panel";
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading, isFetching, error, refetch } = useNanoGptSubscriptionUsage(connectionId, true);
  const compact = variant === "inline";
  // The same surface recipe for the settled, loading and failed states, so a
  // failure is drawn on the host's own surface rather than a stray card.
  const surface =
    variant === "card"
      ? "rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]"
      : variant === "panel"
        ? "rounded-xl bg-foreground/5 px-3 py-2.5 ring-1 ring-foreground/10"
        : "mb-2 px-0.5";
  const frame =
    variant === "card"
      ? "space-y-2.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]"
      : variant === "panel"
        ? "space-y-2 rounded-xl bg-foreground/5 px-3 py-2.5 ring-1 ring-foreground/10"
        : "mb-2 space-y-1 px-0.5";
  const providerName = providerDisplayName(data?.provider);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${surface}`}>
        <Loader2 size="0.75rem" className="animate-spin text-[var(--marinara-chat-chrome-accent)]" />
        <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.loadingSubscriptionUsage")}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={surface}>
        <div className="flex items-start gap-2">
          <TriangleAlert size="0.75rem" className="mt-0.5 shrink-0 text-[var(--marinara-editor-accent)]" />
          <p className="min-w-0 flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {error instanceof Error ? error.message : localizeUi("ui.connections.connectioneditor.usageLoadFailed")}
          </p>
          <button
            onClick={() => void refetch()}
            className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--marinara-chat-chrome-accent)]"
            aria-label={localizeUi("ui.connections.connectioneditor.retryUsageLookup")}
          >
            <RefreshCw size="0.6875rem" />
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const weekly = data.weeklyInputTokens;
  const daily = data.dailyInputTokens;
  // "Weekly usage" reads shorter than "Subscription usage" where space is tight,
  // and only the weekly window is shown there anyway.
  const title = compact
    ? localizeUi("ui.connections.connectioneditor.weeklyUsage", { provider: providerName })
    : localizeUi("ui.connections.connectioneditor.subscriptionUsage", { provider: providerName });
  const weeklyPercent = weekly ? quotaPercentForDisplay(weekly.percentUsed) : null;
  const weeklyTotal = quotaTotalForDisplay(weekly);
  // The percent/used fallback covers a window that reports no remaining count.
  // Compact splits the figure across two rows, exactly as the context bar above
  // splits its own: the counts here, the percentage and the bar beneath. Keeping
  // the percentage out of this row is what stops it reading twice.
  const compactReading =
    weekly && weeklyPercent !== null
      ? weeklyTotal !== null
        ? localizeUi("ui.connections.connectioneditor.usageUsedOfLimit", {
            used: formatTokens(weekly.used),
            limit: formatTokens(weeklyTotal),
          })
        : localizeUi("ui.connections.connectioneditor.usageUsedOnly", { used: formatTokens(weekly.used) })
      : null;

  return (
    <div className={frame}>
      <div className={compact ? "flex items-center justify-between gap-3" : "flex items-center justify-between gap-2"}>
        <span
          className={
            compact
              ? "text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]"
              : "text-xs font-semibold text-[var(--foreground)]"
          }
        >
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {!compact && (
            <span className="rounded-md bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--marinara-chat-chrome-accent)]">
              {data.credential === "management_token"
                ? localizeUi("ui.connections.connectioneditor.usageViaManagementToken")
                : localizeUi("ui.connections.connectioneditor.usageViaApiKey")}
            </span>
          )}
          {compact && compactReading && (
            <span className="text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">
              {compactReading}
            </span>
          )}
          {!compact && (
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="rounded-md p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:text-[var(--marinara-chat-chrome-accent)] disabled:opacity-50"
              aria-label={localizeUi("ui.connections.connectioneditor.refreshUsage")}
            >
              <RefreshCw size="0.6875rem" className={isFetching ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {!compact && !data.active && (
        <p className="text-[0.625rem] text-[var(--marinara-editor-accent)]">
          {localizeUi("ui.connections.connectioneditor.subscriptionNotActive", { state: data.state })}
        </p>
      )}

      {weekly && (
        <QuotaBar
          label={compact ? "" : localizeUi("ui.connections.connectioneditor.weeklyInputTokens")}
          window={weekly}
          compact={compact}
          onRefresh={() => void refetch()}
          isRefreshing={isFetching}
        />
      )}

      {!compact && !weekly && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.weeklyQuotaNotConfigured")}
        </p>
      )}

      {daily && !compact && (
        <QuotaBar label={localizeUi("ui.connections.connectioneditor.dailyInputTokens")} window={daily} />
      )}

      {!compact && data.credential === "api_key" && (
        <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.usageManagementTokenRecommended")}
        </p>
      )}
    </div>
  );
}
