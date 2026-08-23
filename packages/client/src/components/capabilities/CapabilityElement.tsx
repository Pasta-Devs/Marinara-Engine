import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import type { CapabilityLocalizationContext } from "@marinara-engine/shared";
import { retryCapabilityClientModule, useCapabilityClientModuleState } from "../../hooks/use-capability-packages";
import { cn } from "../../lib/utils";

type CapabilityElementNode = HTMLElement & {
  capabilityProps?: Record<string, unknown>;
  capabilityRuntimeError?: string | null;
};

interface CapabilityElementProps {
  packageId: string;
  view:
    | "surface"
    | "setup"
    | "setup-apply"
    | "settings"
    | "toolbar"
    | "detail"
    | "workspace"
    | "runtime"
    | "world-map"
    | "browser"
    | "tracker";
  capabilityProps?: Record<string, unknown>;
  className?: string;
  onHostError?: (message: string) => void;
}

function capabilityTag(packageId: string) {
  return `marinara-capability-${packageId}`;
}

function capabilityName(packageId: string, manifestName?: string | null): string {
  if (manifestName?.trim()) return manifestName.trim();
  return packageId
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function capabilityStyle(capabilityProps?: Record<string, unknown>): CSSProperties | undefined {
  const style = capabilityProps?.style;
  return style && typeof style === "object" && !Array.isArray(style) ? (style as CSSProperties) : undefined;
}

function CapabilityLoadingState({
  packageId,
  view,
  className,
  style,
  name,
  onClose,
}: Pick<CapabilityElementProps, "packageId" | "view" | "className"> & {
  style?: CSSProperties;
  name?: string | null;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const displayName = capabilityName(packageId, name);
  const statusCopy = t("capabilities.loading", { name: displayName });
  if (view === "surface") {
    return (
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
        data-capability-client-state="loading"
        data-capability-package-id={packageId}
      >
        {statusCopy}
      </span>
    );
  }
  if (view === "toolbar") {
    return (
      <span
        role="status"
        aria-label={statusCopy}
        className={cn(
          className === "contents" ? undefined : className,
          "inline-flex h-9 w-9 animate-pulse rounded-lg bg-[var(--muted)]/70",
        )}
        data-capability-client-state="loading"
        data-capability-package-id={packageId}
      />
    );
  }
  if (view === "browser") {
    return (
      <div
        className={cn(
          className === "contents" ? undefined : className,
          "flex min-h-64 items-center justify-center px-5",
        )}
        style={style}
        data-capability-client-state="loading"
        data-capability-package-id={packageId}
      >
        <div className="w-full max-w-sm space-y-3" role="status" aria-live="polite">
          <span className="sr-only">{statusCopy}</span>
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--muted)]/70" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--muted)]/70" />
        </div>
      </div>
    );
  }
  if (view === "workspace" || view === "setup") {
    return (
      <div
        data-chat-floating-panel
        className="fixed inset-0 z-[10020] flex min-h-0 items-center justify-center bg-[var(--background)] px-5"
        data-capability-client-state="loading"
        data-capability-package-id={packageId}
      >
        <div className="w-full max-w-sm space-y-3">
          <span role="status" aria-live="polite" className="sr-only">
            {statusCopy}
          </span>
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--muted)]/70" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--muted)]/70" />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            >
              <X size="0.75rem" /> {t("capabilities.actions.close")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (view === "detail") {
    return (
      <div
        className={cn(
          className === "contents" ? undefined : className,
          "flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-5",
        )}
        data-capability-client-state="loading"
        data-capability-package-id={packageId}
      >
        <div className="mx-auto w-full max-w-3xl space-y-4" role="status" aria-live="polite">
          <span className="sr-only">{statusCopy}</span>
          <div className="h-5 w-48 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--muted)]/70" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--muted)]/70" />
          <div className="h-32 animate-pulse rounded-xl bg-[var(--muted)]/45" />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            >
              <X size="0.75rem" /> {t("capabilities.actions.backToAgents")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={statusCopy}
      style={style}
      className={cn(
        className === "contents" ? undefined : className,
        view === "world-map" ? "min-h-32 h-full" : "h-14",
        "w-full animate-pulse rounded-lg bg-[var(--muted)]/55",
      )}
      data-capability-client-state="loading"
      data-capability-package-id={packageId}
    />
  );
}

function CapabilityFailureState({
  packageId,
  view,
  className,
  style,
  kind,
  onRetry,
  onClose,
  name,
}: Pick<CapabilityElementProps, "packageId" | "view" | "className"> & {
  style?: CSSProperties;
  kind: "load" | "runtime";
  onRetry: () => void;
  onClose?: () => void;
  name?: string | null;
}) {
  const { t } = useTranslation();
  const displayName = capabilityName(packageId, name);
  const title = t(kind === "load" ? "capabilities.failure.load.title" : "capabilities.failure.runtime.title", {
    name: displayName,
  });
  const description =
    kind === "load" ? t("capabilities.failure.load.description") : t("capabilities.failure.runtime.description");
  if (view === "toolbar") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          className === "contents" ? undefined : className,
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60",
        )}
        aria-label={
          kind === "load"
            ? t("capabilities.failure.load.retryLabel", { name: displayName })
            : t("capabilities.actions.tryAgain")
        }
        title={title}
        data-capability-client-state="error"
        data-capability-package-id={packageId}
      >
        <AlertTriangle size="0.875rem" />
      </button>
    );
  }
  const failure = (
    <div
      role="alert"
      style={style}
      className={cn(
        className === "contents" ? undefined : className,
        "flex w-full items-start gap-3 rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 p-3 text-left",
      )}
      data-capability-client-state="error"
      data-capability-package-id={packageId}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)]">
        <AlertTriangle size="0.875rem" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 max-w-[65ch] text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {description}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
          >
            <RefreshCw size="0.75rem" /> {t("capabilities.actions.tryAgain")}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            >
              <X size="0.75rem" /> {t("capabilities.actions.close")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
  if (view === "detail") {
    return (
      <div className={cn(className === "contents" ? undefined : className, "flex min-h-0 flex-1 items-center px-5")}>
        <div className="mx-auto w-full max-w-3xl">{failure}</div>
      </div>
    );
  }
  if (view === "browser") {
    return (
      <div className="flex min-h-64 items-center px-5">
        <div className="mx-auto w-full max-w-lg">{failure}</div>
      </div>
    );
  }
  if (view !== "workspace" && view !== "setup") return failure;
  return (
    <div
      data-chat-floating-panel
      className="fixed inset-0 z-[10020] flex min-h-0 items-center justify-center bg-[var(--background)] px-5"
    >
      <div className="w-full max-w-lg">{failure}</div>
    </div>
  );
}

function CapabilityRefreshState({
  packageId,
  view,
  className,
  style,
  onClose,
  name,
}: Pick<CapabilityElementProps, "packageId" | "view" | "className"> & {
  style?: CSSProperties;
  onClose?: () => void;
  name?: string | null;
}) {
  const { t } = useTranslation();
  const displayName = capabilityName(packageId, name);
  const title = t("capabilities.refresh.title", { name: displayName });
  const refresh = () => window.location.reload();
  if (view === "toolbar") {
    return (
      <button
        type="button"
        onClick={refresh}
        className={cn(
          className === "contents" ? undefined : className,
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60",
        )}
        aria-label={t("capabilities.refresh.actionLabel", { name: displayName })}
        title={title}
        data-capability-client-state="refresh-required"
        data-capability-package-id={packageId}
      >
        <RefreshCw size="0.875rem" />
      </button>
    );
  }
  const notice = (
    <div
      role="status"
      style={style}
      className={cn(
        className === "contents" ? undefined : className,
        "flex w-full items-start gap-3 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 p-3 text-left",
      )}
      data-capability-client-state="refresh-required"
      data-capability-package-id={packageId}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
        <RefreshCw size="0.875rem" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 max-w-[65ch] text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {t("capabilities.refresh.description")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
          >
            <RefreshCw size="0.75rem" /> {t("capabilities.actions.refreshNow")}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            >
              <X size="0.75rem" /> {t("capabilities.actions.close")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
  if (view === "detail") {
    return (
      <div className={cn(className === "contents" ? undefined : className, "flex min-h-0 flex-1 items-center px-5")}>
        <div className="mx-auto w-full max-w-3xl">{notice}</div>
      </div>
    );
  }
  if (view === "browser") {
    return (
      <div className="flex min-h-64 items-center px-5">
        <div className="mx-auto w-full max-w-lg">{notice}</div>
      </div>
    );
  }
  if (view !== "workspace" && view !== "setup") return notice;
  return (
    <div
      data-chat-floating-panel
      className="fixed inset-0 z-[10020] flex min-h-0 items-center justify-center bg-[var(--background)] px-5"
    >
      <div className="w-full max-w-lg">{notice}</div>
    </div>
  );
}

export function CapabilityElement({
  packageId,
  view,
  capabilityProps,
  className,
  onHostError,
}: CapabilityElementProps) {
  const { i18n: localization } = useTranslation();
  const ref = useRef<CapabilityElementNode | null>(null);
  const clientModule = useCapabilityClientModuleState(packageId);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const tag = capabilityTag(packageId);
  const registered = typeof customElements !== "undefined" && Boolean(customElements.get(tag));
  const close = capabilityProps?.onClose;
  const onClose = typeof close === "function" ? (close as () => void) : undefined;
  const locale = localization.resolvedLanguage ?? localization.language;
  const direction = localization.dir(locale);
  const localizedCapabilityProps = useMemo(
    () => ({
      ...(capabilityProps ?? {}),
      // Package identity, so a bundle can build version-pinned asset URLs
      // (`/api/capability-packages/<id>/assets/<path>?v=<version>` → immutable
      // caching) without re-fetching /installed or scraping import.meta.url.
      packageId,
      packageVersion: clientModule.version ?? null,
      localization: {
        locale,
        direction,
      } satisfies CapabilityLocalizationContext,
    }),
    [capabilityProps, clientModule.version, direction, locale, packageId],
  );

  useEffect(() => {
    setRuntimeError(null);
  }, [clientModule.version, packageId]);

  useEffect(() => {
    const message = runtimeError ?? (clientModule.status === "error" ? clientModule.error : null);
    if (message) onHostError?.(message);
  }, [clientModule.error, clientModule.status, onHostError, runtimeError]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const onRuntimeError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown }>).detail;
      setRuntimeError(typeof detail?.message === "string" ? detail.message : "Capability client runtime failed");
    };
    node.addEventListener("marinara-capability-runtime-error", onRuntimeError);
    if (node.capabilityRuntimeError) setRuntimeError(node.capabilityRuntimeError);
    node.capabilityProps = localizedCapabilityProps;
    node.dispatchEvent(new CustomEvent("marinara-capability-props"));
    return () => node.removeEventListener("marinara-capability-runtime-error", onRuntimeError);
  }, [clientModule.attempt, clientModule.status, localizedCapabilityProps, runtimeError, tag]);

  if (clientModule.status === "error") {
    return (
      <CapabilityFailureState
        packageId={packageId}
        view={view}
        className={className}
        style={capabilityStyle(capabilityProps)}
        name={clientModule.name}
        kind="load"
        onRetry={() => retryCapabilityClientModule(packageId)}
        onClose={onClose}
      />
    );
  }
  if (clientModule.status === "refresh-required") {
    return (
      <CapabilityRefreshState
        packageId={packageId}
        view={view}
        className={className}
        style={capabilityStyle(capabilityProps)}
        name={clientModule.name}
        onClose={onClose}
      />
    );
  }
  if (runtimeError) {
    return (
      <CapabilityFailureState
        packageId={packageId}
        view={view}
        className={className}
        style={capabilityStyle(capabilityProps)}
        name={clientModule.name}
        kind="runtime"
        onRetry={() => setRuntimeError(null)}
        onClose={onClose}
      />
    );
  }
  if (clientModule.status !== "ready" && !registered) {
    return (
      <CapabilityLoadingState
        packageId={packageId}
        view={view}
        className={className}
        style={capabilityStyle(capabilityProps)}
        name={clientModule.name}
        onClose={onClose}
      />
    );
  }

  return createElement(tag, {
    ref,
    view,
    lang: locale,
    dir: direction,
    class: className,
    key: `${packageId}:${clientModule.version ?? "registered"}:${clientModule.attempt}:${runtimeError ?? "ready"}`,
  });
}
