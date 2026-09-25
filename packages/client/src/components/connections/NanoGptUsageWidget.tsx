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
import { useNanoGptSubscriptionUsage, type NanoGptQuotaWindow } from "../../hooks/use-connections";

function formatTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

/** Convert the API's fraction to a clamped 0-100 display percentage. */
export function quotaPercentForDisplay(percentUsed: number | null | undefined): number | null {
  if (typeof percentUsed !== "number" || !Number.isFinite(percentUsed)) return null;
  return Math.min(100, Math.max(0, percentUsed * 100));
}

/** Which color the bar uses once usage is high. */
function barTone(percent: number): string {
  if (percent >= 90) return "bg-[var(--marinara-editor-accent)]";
  if (percent >= 70) return "bg-amber-400";
  return "bg-sky-400";
}

function QuotaBar({ label, window }: { label: string; window: NanoGptQuotaWindow }) {
  const { t: localizeUi } = useUiTranslation();
  const percent = quotaPercentForDisplay(window.percentUsed);

  // Unknown is not zero: a degraded lookup has no honest bar to draw.
  if (percent === null) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{label}</span>
          <span className="text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
            {localizeUi("ui.connections.connectioneditor.usageUnknown")}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]" />
        {window.degraded && (
          <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.connections.connectioneditor.usageLookupUnavailable")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{label}</span>
        <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
          {localizeUi("ui.connections.connectioneditor.usagePercentOf", {
            percent: String(Math.round(percent)),
            used: formatTokens(window.used),
          })}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div className={`h-full rounded-full transition-all ${barTone(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      {window.remaining !== null && (
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
  /** "editor" draws its own card; "inline" blends into a host that already has one. */
  variant = "editor",
}: {
  connectionId: string;
  variant?: "editor" | "inline";
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading, isFetching, error, refetch } = useNanoGptSubscriptionUsage(connectionId, true);
  const frame =
    variant === "editor"
      ? "space-y-2.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]"
      : "space-y-2.5 rounded-lg bg-foreground/5 px-3 py-2.5 ring-1 ring-foreground/10";

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[var(--secondary)] px-3 py-2.5">
        <Loader2 size="0.75rem" className="animate-spin text-sky-400" />
        <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.loadingSubscriptionUsage")}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]">
        <div className="flex items-start gap-2">
          <TriangleAlert size="0.75rem" className="mt-0.5 shrink-0 text-[var(--marinara-editor-accent)]" />
          <p className="min-w-0 flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {error instanceof Error ? error.message : localizeUi("ui.connections.connectioneditor.usageLoadFailed")}
          </p>
          <button
            onClick={() => void refetch()}
            className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-sky-400"
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

  return (
    <div className={frame}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--foreground)]">
          {localizeUi("ui.connections.connectioneditor.subscriptionUsage")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-sky-400">
            {data.credential === "management_token"
              ? localizeUi("ui.connections.connectioneditor.usageViaManagementToken")
              : localizeUi("ui.connections.connectioneditor.usageViaApiKey")}
          </span>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-sky-400 disabled:opacity-50"
            aria-label={localizeUi("ui.connections.connectioneditor.refreshUsage")}
          >
            <RefreshCw size="0.6875rem" className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {!data.active && (
        <p className="text-[0.625rem] text-[var(--marinara-editor-accent)]">
          {localizeUi("ui.connections.connectioneditor.subscriptionNotActive", { state: data.state })}
        </p>
      )}

      {weekly ? (
        <QuotaBar label={localizeUi("ui.connections.connectioneditor.weeklyInputTokens")} window={weekly} />
      ) : (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.weeklyQuotaNotConfigured")}
        </p>
      )}

      {daily && <QuotaBar label={localizeUi("ui.connections.connectioneditor.dailyInputTokens")} window={daily} />}

      {data.credential === "api_key" && (
        <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.usageManagementTokenRecommended")}
        </p>
      )}
    </div>
  );
}
