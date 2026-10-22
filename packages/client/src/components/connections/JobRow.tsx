// ──────────────────────────────────────────────
// JobRow — one job as one row: a job tile, its name, and on line 2 the Model it uses
// ("model · connection"), its fallback, or what still needs doing. The Defaults box and the
// Add window's "For a job" list both draw it, so the status text lives only here.
// ──────────────────────────────────────────────
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCachedCatalogFacts, useConnections } from "../../hooks/use-connections";
import { cn } from "../../lib/utils";
import type { DefaultsTile } from "./ConnectionDefaults";
import type { ConnectionRowData } from "./ConnectionRow";
import { ModelRow } from "./ModelRow";

/** A job with no Model chosen, or whose engine is not set up: a dashed tile and a warning-tone line. */
export const isUnset = (tile: DefaultsTile, notSet: string) =>
  !!tile.setup || (tile.muted && !tile.source && tile.value === notSet);

export function JobRow({
  tile,
  hint,
  trailing,
  className,
  ...button
}: {
  tile: DefaultsTile;
  /** One plain line under the row that says what the job does. */
  hint?: string;
  /** Shown at the row end inside the row button, such as a chevron: non-interactive content only. */
  trailing?: ReactNode;
  /** Goes on the row's outer element, such as an open state. */
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "className"> & {
    [key: `data-${string}`]: string | undefined;
  }) {
  const { t } = useTranslation();
  const connections = (useConnections().data ?? []) as ConnectionRowData[];
  const source = tile.source;
  // A Model in an account can come from any of that account's Connections' catalogs.
  const [catalog] = useCachedCatalogFacts([
    !source
      ? []
      : source.accountId
        ? connections.filter((row) => row.accountId === source.accountId).map((row) => row.id)
        : [source.id],
  ]);
  const facts = catalog?.of(source?.model);
  const unset = isUnset(tile, t("connections.defaults.notSet"));
  const hintId = useId();
  return (
    <>
      <ModelRow
        {...button}
        aria-describedby={hint ? hintId : undefined}
        rowProps={{ className: cn("mari-connection-defaults-job pe-0", className) }}
        className="min-h-12 gap-2 py-1.5 pe-2 ps-2"
        tile={
          <span
            aria-hidden
            data-defaults-empty-tile={unset || undefined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
              unset
                ? "border border-dashed border-foreground/25 text-[var(--muted-foreground)]"
                : "mari-panel-gradient--connections bg-[var(--mari-connection-tint)] text-[var(--mari-connection-ink)]",
            )}
          >
            {tile.icon}
          </span>
        }
        title={tile.title}
        wrapTitle
        details={
          <span
            className={cn(
              "min-w-0 truncate text-xs",
              unset ? "font-medium text-[var(--warning)]" : "text-[var(--muted-foreground)]",
              tile.muted && !unset && "italic",
            )}
          >
            {tile.setup?.text ??
              (unset ? t("connections.defaults.chooseModel") : [tile.value, tile.hint].filter(Boolean).join(" · "))}
          </span>
        }
        facts={facts}
        showPaid={catalog?.showPaid}
        trailing={
          <>
            {tile.warning && <AlertTriangle size="0.75rem" aria-hidden className="shrink-0 text-amber-500" />}
            {trailing}
          </>
        }
      />
      {hint && (
        <p id={hintId} className="mb-1 ml-12 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </>
  );
}
