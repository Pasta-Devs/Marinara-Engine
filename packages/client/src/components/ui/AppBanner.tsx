// ──────────────────────────────────────────────
// Shared app-wide banner (one at a time with a count of the rest, see AppBannerHost)
// ──────────────────────────────────────────────
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronDown, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

/** The banner's bottom edge in px; the toaster keeps top toasts below it (App.tsx). */
export const APP_BANNER_BOTTOM_VARIABLE = "--app-banner-bottom";

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
  more = 0,
  onDismiss,
}: AppBannerCandidate & { more?: number; onDismiss: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const critical = severity === "critical";
  const Icon = critical ? ShieldAlert : TriangleAlert;
  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const root = document.documentElement.style;
    const place = () =>
      root.setProperty(APP_BANNER_BOTTOM_VARIABLE, `${Math.round(card.getBoundingClientRect().bottom)}px`);
    const observer = new ResizeObserver(place);
    observer.observe(card);
    place();
    return () => {
      observer.disconnect();
      root.removeProperty(APP_BANNER_BOTTOM_VARIABLE);
    };
  }, []);

  return (
    // A card just below the 3rem top bar: it leaves the top bar's buttons and the chat composer free.
    <div
      ref={cardRef}
      className="fixed left-[max(0.5rem,var(--mari-safe-area-inset-left))] right-[max(0.5rem,var(--mari-safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+3.5rem)] z-[9999] max-h-[50dvh] overflow-y-auto rounded-xl bg-[var(--background)] text-[var(--foreground)] shadow-lg md:right-auto md:left-4 md:w-[28rem]"
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border py-2 pr-2 pl-4 text-sm",
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
            <p className="font-semibold">
              {title}
              {more > 0 && (
                <span className="ml-2 inline-block rounded-full bg-[var(--foreground)]/10 px-2 align-middle text-[0.625rem] font-semibold text-[var(--muted-foreground)]">
                  {localizeUi("ui.app.banner.more", { count: more })}
                </span>
              )}
            </p>
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
