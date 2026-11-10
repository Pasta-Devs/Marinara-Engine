import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

export function PanelListSkeleton({
  rows = 3,
  rowClassName = "h-10 rounded-lg",
}: {
  rows?: number;
  rowClassName?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={localizeUi("ui.ui.panelstates.loading")}
      className="flex flex-col gap-2 px-2 py-4"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`shimmer ${rowClassName}`} />
      ))}
    </div>
  );
}

export function PanelErrorState({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--destructive)]/10">
        <AlertTriangle size="1.25rem" className="text-[var(--destructive)]" aria-hidden="true" />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mari-chrome-control mari-chrome-control--compact mt-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? <Loader2 size="0.75rem" className="animate-spin" aria-hidden="true" /> : null}
          {localizeUi(retrying ? "ui.ui.panelstates.retrying" : "ui.panels.connectionspanel.retry")}
        </button>
      )}
    </div>
  );
}
