// ──────────────────────────────────────────────
// Shared app-wide banner (one at a time, see AppBannerHost)
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { ChevronDown, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export type AppBannerSeverity = "warning" | "critical";

export interface AppBannerCandidate {
  id: string;
  severity: AppBannerSeverity;
  tone?: "accent";
  title: ReactNode;
  body: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
}

export function AppBanner({
  severity,
  tone,
  title,
  body,
  details,
  actions,
  onDismiss,
}: AppBannerCandidate & { onDismiss: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const critical = severity === "critical";
  const Icon = critical ? ShieldAlert : TriangleAlert;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] max-h-[50dvh] overflow-y-auto bg-[var(--background)] text-[var(--foreground)] shadow-md">
      <div
        className={cn(
          "flex items-start gap-3 border-b pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-2 pl-[max(1rem,env(safe-area-inset-left))] text-sm",
          tone === "accent"
            ? "border-[var(--marinara-chat-chrome-accent)]/40 bg-[var(--marinara-chat-chrome-accent)]/15"
            : critical
              ? "border-[var(--destructive)]/40 bg-[var(--destructive)]/15"
              : "border-amber-500/40 bg-amber-500/15",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-3 h-4 w-4 shrink-0",
            tone === "accent"
              ? "text-[var(--marinara-chat-chrome-accent)]"
              : critical
                ? "text-[var(--destructive)]"
                : "text-amber-600",
          )}
        />
        <div className="min-w-0 flex-1 py-2">
          <div role={critical ? "alert" : "status"}>
            <p className="font-semibold">{title}</p>
            <div className="mt-1 leading-snug text-[var(--muted-foreground)]">{body}</div>
          </div>
          {(actions || details) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2">
              {actions}
              {details && (
                <details className="group w-full">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--ring)] [&::-webkit-details-marker]:hidden">
                    {localizeUi("ui.app.banner.details")}
                    <ChevronDown
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="pb-1 text-xs leading-snug text-[var(--muted-foreground)]">{details}</div>
                </details>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={localizeUi("ui.app.banner.dismiss")}
          title={localizeUi("ui.app.banner.dismiss")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--foreground)]/10 hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
