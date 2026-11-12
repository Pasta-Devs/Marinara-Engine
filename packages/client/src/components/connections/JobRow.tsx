// ──────────────────────────────────────────────
// JobRow — one job as one row. With a Model: the Model's own brand tile, the job as a small grey label,
// the Model's name with its provider (and "via" upstream) in grey, and a quiet "If it fails" line.
// Without one: the job tile, its name, and what still needs doing. The Defaults box and the Add
// window's "For a job" list both draw it, so the status text lives only here.
// ──────────────────────────────────────────────
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCachedCatalogFacts, useConnections } from "../../hooks/use-connections";
import { cn } from "../../lib/utils";
import type { DefaultsTile } from "./ConnectionDefaults";
import type { ConnectionRowData } from "./ConnectionRow";
import { viaName } from "../../lib/connection-groups";
import { ModelRow, ModelTile } from "./ModelRow";
import { JOB_HINT_INSET } from "./connection-row-layout";
import { JOB, type JobKey } from "../../lib/connection-jobs";

/** Jobs whose found line names what the models do, not their kind. */
const FOUND_KEY: Partial<Record<JobKey, string>> = { decision: "decision", embeddings: "embeddings" };

/** The amber warning chip. NeedsModelChip draws it too. */
export function WarningChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] text-amber-500",
        className,
      )}
    >
      <AlertTriangle size="0.625rem" aria-hidden className="shrink-0" />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

/** A job with no Model chosen, or whose engine is not set up: a dashed tile and a warning-tone line. */
export const isUnset = (tile: DefaultsTile, notSet: string) =>
  !!tile.setup || (tile.muted && !tile.source && tile.value === notSet);

/** A job's tile: dashed while it has no Model, a tinted well once it has one. The Add window draws it too. */
export function JobTile({ unset, className, children }: { unset: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      data-defaults-empty-tile={unset || undefined}
      className={cn(
        "flex h-[2.375rem] w-[2.375rem] shrink-0 items-center justify-center rounded-lg max-md:h-8 max-md:w-8 [&_svg]:size-[1.125rem] max-md:[&_svg]:size-4",
        unset
          ? "border border-dashed border-foreground/25 text-[var(--muted-foreground)]"
          : "mari-panel-gradient--connections bg-[var(--mari-connection-tint)] text-[var(--mari-connection-ink)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function JobRow({
  tile,
  hint,
  trailing,
  end,
  className,
  ...button
}: {
  tile: DefaultsTile;
  /** One plain line under the row that says what the job does. */
  hint?: string;
  /** The row's end mark, such as a chevron: drawn last, after the fix and `end`, and opens the row like the row itself. */
  trailing?: ReactNode;
  /** A control raised to the row's top end, left of the chevron, such as a settings gear. */
  end?: ReactNode;
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
  // A real Model of its own (not "Follows Main", not a device engine): the row shows that Model.
  const chosen = !unset && !tile.muted && !tile.device && source ? source : null;
  // "account · via X", the same after the name in the row and in its "If it fails" line.
  const noteOf = (account: string | undefined, model: ConnectionRowData | undefined) => {
    const via = model ? viaName(model.provider, model.model) : null;
    return [account, via && t("connections.accounts.section.via", { service: via })].filter(Boolean).join(" · ");
  };
  const provider = chosen ? noteOf(tile.hint, chosen) : "";
  // The model id under the name, with its badges (they describe the model, not the account); not twice when the name is the id.
  const modelId =
    chosen?.model && chosen.model.trim().toLowerCase() !== (tile.value ?? "").trim().toLowerCase()
      ? chosen.model
      : null;
  const fallbackNote = noteOf(tile.fallbackHint, tile.fallbackSource);
  // What the row is: the job, and the job it follows when it has no Model of its own.
  const label = [tile.title, tile.follows].filter(Boolean).join(" · ");
  const hintId = useId();
  // On the name's line under a label; a row without one centres them.
  const RAISED = chosen ? "top-[1.125rem] max-md:top-1" : "top-1/2 -translate-y-1/2";
  return (
    <>
      <ModelRow
        {...button}
        end={
          <>
            {tile.warning?.fix && (
              // The warning itself is the fix ("⚠ Turn on"), chip-sized so the name keeps its room; the padding is the tap area.
              <button
                type="button"
                onClick={tile.warning.fix.run}
                title={tile.warning.text}
                className="group -my-2 shrink-0 rounded-md py-2 outline-none focus-visible:[&>span]:ring-1 focus-visible:[&>span]:ring-[var(--ring)]"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.625rem] transition-colors",
                    tile.warning.quiet
                      ? "bg-foreground/[0.06] text-[var(--muted-foreground)] group-hover:bg-foreground/10 group-hover:text-[var(--foreground)]"
                      : "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20",
                  )}
                >
                  {!tile.warning.quiet && <AlertTriangle size="0.625rem" aria-hidden className="shrink-0" />}
                  {tile.warning.fix.label}
                </span>
              </button>
            )}
            {/* The settings and the chevron sit on the name's line, out of the flow, with the badges under them:
                they take no width from the badges' line, so every row's badges end at the row's end. */}
            {end && (
              <span className={cn("absolute right-7 flex [[dir=rtl]_&]:left-7 [[dir=rtl]_&]:right-auto", RAISED)}>
                {end}
              </span>
            )}
            {trailing && (
              // The row button stays the keyboard target.
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={button.onClick}
                className={cn(
                  "absolute right-0 -mt-px flex h-[2.125rem] w-7 items-center justify-center max-md:-right-[0.1875rem] max-md:h-[2.875rem]",
                  // Physical sides, flipped for right-to-left: logical insets break the client build (#8709).
                  "[[dir=rtl]_&]:left-0 [[dir=rtl]_&]:right-auto max-md:[[dir=rtl]_&]:-left-[0.1875rem]",
                  RAISED,
                )}
              >
                {trailing}
              </button>
            )}
          </>
        }
        aria-describedby={hint ? hintId : undefined}
        // A warning chip stays in the flow, so it keeps clear of the chevron and the settings beside it.
        rowProps={{
          className: cn(
            "mari-connection-defaults-job pe-0",
            tile.warning && trailing && (end ? "pe-14 max-md:pe-[4.5rem]" : "pe-7"),
            className,
          ),
        }}
        className={cn(
          "min-h-[3.75rem] gap-2 py-2 pe-2 ps-2 max-md:pe-1 max-md:ps-1",
          // The name keeps clear of the chevron and the settings beside it.
          end
            ? "[&_[data-model-title]]:pe-12 max-md:[&_[data-model-title]]:pe-[4.25rem]"
            : trailing && "[&_[data-model-title]]:pe-5 max-md:[&_[data-model-title]]:pe-6",
        )}
        tile={chosen ? <ModelTile row={chosen} model={chosen.model} /> : <JobTile unset={!!unset}>{tile.icon}</JobTile>}
        label={chosen ? label : undefined}
        title={chosen ? tile.value : tile.title}
        titleNote={modelId}
        badgesWithNote
        tooltip={chosen ? `${label}: ${tile.value}` : undefined}
        wrapTitle
        details={
          chosen ? (
            <span className="flex min-w-0 flex-col gap-0.5">
              {/* The account (and "via" upstream) on its own line. */}
              {provider && (
                <span className="min-w-0 truncate text-[0.6875rem] text-[var(--muted-foreground)]">{provider}</span>
              )}
              {tile.fallback ? (
                <span className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                  <span className="whitespace-nowrap">{t("connections.defaults.ifItFailsLabel")}</span>
                  {tile.fallbackSource && (
                    <ModelTile row={tile.fallbackSource} model={tile.fallbackSource.model} size="xs" />
                  )}
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{tile.fallback}</span>
                    {fallbackNote && <> {fallbackNote}</>}
                  </span>
                </span>
              ) : (
                tile.warning?.quiet && (
                  <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {tile.warning.short ?? tile.warning.text}
                  </span>
                )
              )}
            </span>
          ) : (
            // The state line stays grey; only a warning chip at the row end is amber.
            <span className="min-w-0 line-clamp-2 text-xs text-[var(--muted-foreground)]">
              {tile.setup?.text ??
                (tile.find &&
                  (tile.find.count
                    ? [
                        t(`connections.defaults.found.${FOUND_KEY[tile.key] ?? JOB[tile.key].kind}`, {
                          count: tile.find.count,
                        }),
                        t("connections.defaults.foundIn", { accounts: tile.find.accounts.join(", ") }),
                      ].join(" · ")
                    : t(tile.find.unknown ? "connections.defaults.chooseModel" : "connections.defaults.noneFound"))) ??
                (unset
                  ? t(tile.warning ? "connections.defaults.chooseModel" : "connections.defaults.notSetUp")
                  : [tile.value, tile.hint].filter(Boolean).join(" · "))}
            </span>
          )
        }
        facts={facts}
        showPaid={catalog?.showPaid}
        trailing={
          tile.warning && !tile.warning.fix && <WarningChip>{tile.warning.short ?? tile.warning.text}</WarningChip>
        }
      />
      {hint && (
        <p id={hintId} className={cn("mb-1 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]", JOB_HINT_INSET)}>
          {hint}
        </p>
      )}
    </>
  );
}
