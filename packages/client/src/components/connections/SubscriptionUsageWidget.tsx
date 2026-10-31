// ──────────────────────────────────────────────
// Subscription Usage Widget (NanoGPT, Claude and ChatGPT plans)
// ──────────────────────────────────────────────
//
// A Claude or ChatGPT plan reports only a percentage and a reset time per
// window, for the whole account, so its bars carry no token counts.
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
import { useSubscriptionUsage, type NanoGptQuotaWindow } from "../../hooks/use-connections";
import { quotaPercentForDisplay, quotaTotalForDisplay } from "../../lib/nanogpt-quota";
import { formatRelativeUntil } from "../../lib/relative-time";

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
  limit,
  compact = false,
  labelInCompact = false,
}: {
  label: string;
  window: NanoGptQuotaWindow;
  limit: number | null;
  compact?: boolean;
  /** Name the window in the compact row, for a meter that draws more than one. */
  labelInCompact?: boolean;
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
  const total = quotaTotalForDisplay(window, limit);
  const roundedPercent = String(Math.round(percent));
  const resetsIn = window.resetAt !== null ? formatRelativeUntil(window.resetAt) : null;
  const resets = resetsIn ? localizeUi("ui.connections.connectioneditor.usageResets", { when: resetsIn }) : null;
  // The wider layouts state the percentage and the tokens together; the compact
  // one leaves the tokens to the header row above and states only the percentage.
  const reading =
    total !== null
      ? localizeUi("ui.connections.connectioneditor.usagePercentAndUsedOfLimit", {
          percent: roundedPercent,
          used,
          limit: formatTokens(total),
        })
      : window.used !== null
        ? localizeUi("ui.connections.connectioneditor.usagePercentOf", {
            percent: roundedPercent,
            used,
          })
        : resets
          ? localizeUi("ui.connections.connectioneditor.usagePercentAndResets", { percent: roundedPercent, resets })
          : localizeUi("ui.connections.connectioneditor.usagePercentUsed", { percent: roundedPercent });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {!compact
            ? label
            : labelInCompact
              ? localizeUi("ui.connections.connectioneditor.usageLabelPercentUsed", { label, percent: roundedPercent })
              : localizeUi("ui.connections.connectioneditor.usagePercentUsed", { percent: roundedPercent })}
        </span>
        {(!compact || resets) && (
          <span className="text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">
            {compact ? resets : reading}
          </span>
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
      {/* A window with counts states its reset under the bar; one without states it in the reading. */}
      {!compact && window.used !== null && (window.remaining !== null || resets) && (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
          {window.remaining === null
            ? resets
            : resets
              ? localizeUi("ui.connections.connectioneditor.usageRemainingAndResets", {
                  remaining: formatTokens(window.remaining),
                  resets,
                })
              : localizeUi("ui.connections.connectioneditor.usageRemaining", {
                  remaining: formatTokens(window.remaining),
                })}
        </p>
      )}
    </div>
  );
}

export function SubscriptionUsageWidget({
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
  const { data, isLoading, isFetching, error, refetch } = useSubscriptionUsage(connectionId, true);
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

  const refreshButton = (
    <button
      onClick={() => void refetch()}
      disabled={isFetching}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:text-[var(--marinara-chat-chrome-accent)] disabled:opacity-50"
      aria-label={localizeUi("ui.connections.connectioneditor.refreshUsage")}
    >
      <RefreshCw size="0.6875rem" className={isFetching ? "animate-spin" : ""} />
    </button>
  );

  if ("windows" in data) {
    const isClaude = data.provider === "claude_subscription";
    return (
      <div className={frame}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={
              compact
                ? "text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                : "text-xs font-semibold text-[var(--foreground)]"
            }
          >
            {localizeUi(
              isClaude
                ? "ui.connections.connectioneditor.claudePlanUsage"
                : "ui.connections.connectioneditor.chatgptPlanUsage",
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {!compact && data.plan && (
              <span className="rounded-md bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.5625rem] font-medium capitalize text-[var(--marinara-chat-chrome-accent)]">
                {data.plan}
              </span>
            )}
            {refreshButton}
          </div>
        </div>

        {data.windows.map((planWindow) => (
          <QuotaBar
            key={planWindow.id}
            label={localizeUi(
              planWindow.id === "five_hour"
                ? "ui.connections.connectioneditor.planFiveHourWindow"
                : "ui.connections.connectioneditor.planWeeklyWindow",
            )}
            window={planWindow}
            limit={null}
            compact={compact}
            labelInCompact
          />
        ))}

        {data.windows.length === 0 && (
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.connections.connectioneditor.planUsageNoWindows")}
          </p>
        )}

        {!compact && (
          <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi(
              isClaude
                ? "ui.connections.connectioneditor.claudePlanUsageAccountWide"
                : "ui.connections.connectioneditor.chatgptPlanUsageAccountWide",
            )}
          </p>
        )}
      </div>
    );
  }

  const weekly = data.weeklyInputTokens;
  const daily = data.dailyInputTokens;
  // "Weekly usage" reads shorter than "Subscription usage" where space is tight,
  // and only the weekly window is shown there anyway.
  const title = compact
    ? localizeUi("ui.connections.connectioneditor.weeklyUsage", { provider: providerName })
    : localizeUi("ui.connections.connectioneditor.subscriptionUsage", { provider: providerName });
  const weeklyPercent = weekly ? quotaPercentForDisplay(weekly.percentUsed) : null;
  const weeklyTotal = quotaTotalForDisplay(weekly, data.limits.weeklyInputTokens);
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
          {refreshButton}
        </div>
      </div>

      {!data.active && (
        <p className="text-[0.625rem] text-[var(--marinara-editor-accent)]">
          {localizeUi("ui.connections.connectioneditor.subscriptionNotActive", { state: data.state })}
        </p>
      )}

      {weekly && (
        <QuotaBar
          label={localizeUi("ui.connections.connectioneditor.weeklyInputTokens")}
          window={weekly}
          limit={data.limits.weeklyInputTokens}
          compact={compact}
        />
      )}

      {!weekly && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi(
            data.limits.weeklyInputTokens === null
              ? "ui.connections.connectioneditor.weeklyQuotaNotConfigured"
              : "ui.connections.connectioneditor.usageLookupUnavailable",
          )}
        </p>
      )}

      {daily && !compact && (
        <QuotaBar
          label={localizeUi("ui.connections.connectioneditor.dailyInputTokens")}
          window={daily}
          limit={data.limits.dailyInputTokens}
        />
      )}

      {!compact && data.credential === "api_key" && (
        <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.connectioneditor.usageManagementTokenRecommended")}
        </p>
      )}
    </div>
  );
}

/** "14:20" today, "Mon 14:20" later: when a window resets, as a clock time. */
function resetClock(resetAt: number, locale: string | undefined): string {
  const date = new Date(resetAt);
  const today = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(locale, {
    ...(today ? {} : { weekday: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MeterWindow = { key: string; short: string; long: string; window: NanoGptQuotaWindow; limit: number | null };

/**
 * One compact line under a connection's header: "42% of 5-hour limit used" and "18% of weekly limit used", each with its own
 * small bar. Amber above 80%, red at the limit, where the text becomes the problem ("5-hour limit reached · resets
 * 14:20"). Exact figures sit in the tooltip. It reads the same query as the full widget, so it adds no request.
 */
export function CompactUsageMeter({
  connectionId,
  showFiveHour = true,
  showWeekly = true,
  className,
}: {
  connectionId: string;
  showFiveHour?: boolean;
  showWeekly?: boolean;
  className?: string;
}) {
  const { t, i18n } = useUiTranslation();
  const { data } = useSubscriptionUsage(connectionId, true);
  if (!data) return null;

  const windows: MeterWindow[] =
    "windows" in data
      ? data.windows
          .filter((entry) => (entry.id === "five_hour" ? showFiveHour : showWeekly))
          .map((entry) => ({
            key: entry.id,
            short: t(entry.id === "five_hour" ? "connections.usage.fiveHourShort" : "connections.usage.weekShort"),
            long: t(
              entry.id === "five_hour"
                ? "ui.connections.connectioneditor.planFiveHourWindow"
                : "ui.connections.connectioneditor.planWeeklyWindow",
            ),
            window: entry,
            limit: null,
          }))
      : [
          data.dailyInputTokens && {
            key: "day",
            short: t("connections.usage.dayShort"),
            long: t("ui.connections.connectioneditor.dailyInputTokens"),
            window: data.dailyInputTokens,
            limit: data.limits.dailyInputTokens,
          },
          data.weeklyInputTokens && {
            key: "week",
            short: t("connections.usage.weekShort"),
            long: t("ui.connections.connectioneditor.weeklyInputTokens"),
            window: data.weeklyInputTokens,
            limit: data.limits.weeklyInputTokens,
          },
        ].filter((entry): entry is MeterWindow => !!entry);

  const readings = windows.flatMap((entry) => {
    const percent = quotaPercentForDisplay(entry.window.percentUsed);
    if (percent === null) return [];
    const atLimit = (entry.window.percentUsed ?? 0) >= 1;
    const resets = entry.window.resetAt !== null ? resetClock(entry.window.resetAt, i18n.resolvedLanguage) : null;
    const rounded = String(Math.round(percent));
    const total = quotaTotalForDisplay(entry.window, entry.limit);
    const figures =
      total !== null && entry.window.used !== null
        ? t("connections.usage.tooltipTokens", {
            label: entry.long,
            used: formatTokens(entry.window.used),
            limit: formatTokens(total),
            percent: rounded,
          })
        : t("connections.usage.tooltipPercent", { label: entry.long, percent: rounded });
    return [
      {
        ...entry,
        percent,
        atLimit,
        text: atLimit
          ? resets
            ? t("connections.usage.limitResets", { label: entry.short, time: resets })
            : t("connections.usage.limit", { label: entry.short })
          : t("connections.usage.reading", { label: entry.short, percent: rounded }),
        tooltip: resets ? t("connections.usage.tooltipResets", { reading: figures, time: resets }) : figures,
      },
    ];
  });
  if (readings.length === 0) return null;
  const tooltip = readings.map((reading) => reading.tooltip).join("\n");

  return (
    <p
      data-connection-usage-meter
      title={tooltip}
      className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)] ${className ?? ""}`}
    >
      <span className="sr-only">{tooltip}</span>
      {readings.map((reading) => (
        <span
          key={reading.key}
          aria-hidden
          data-usage-window={reading.key}
          data-usage-level={reading.atLimit ? "limit" : reading.percent > 80 ? "high" : "ok"}
          // The text wraps under a narrow card instead of running past its edge ("limit reached · resets …").
          className={`inline-flex min-w-0 items-center gap-1.5 ${
            reading.atLimit
              ? "font-medium text-red-500"
              : reading.percent > 80
                ? "text-[color-mix(in_srgb,var(--color-amber-500)_78%,var(--foreground)_22%)]"
                : ""
          }`}
        >
          <span className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-foreground/15">
            <span
              className={`block h-full rounded-full ${
                reading.atLimit ? "bg-red-500" : reading.percent > 80 ? "bg-amber-400" : "bg-foreground/35"
              }`}
              style={{ width: `${reading.percent}%` }}
            />
          </span>
          <span className="min-w-0">{reading.text}</span>
        </span>
      ))}
    </p>
  );
}
