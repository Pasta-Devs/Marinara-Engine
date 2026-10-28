// ──────────────────────────────────────────────
// ConnectionSelect — picks a Model, grouped by Connection: a field (or a Settings label/value row) that opens
// the searchable ConnectionPicker, or a native <select> where a caller asks for one.
// ──────────────────────────────────────────────
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID, type ConnectionPickerKind } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount, type ConnectionModelRow } from "../../lib/connection-groups";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { FLAG_JOBS, matchesKind } from "../../lib/connection-jobs";
import { cn } from "../../lib/utils";

// The window loads on first open, so a screen of compact fields does not pull it into startup.
const ModelPicker = lazy(() => import("./ModelPicker").then((m) => ({ default: m.ModelPicker })));

export type ConnectionSelectKind = ConnectionPickerKind;

export type ConnectionChoiceRow = ConnectionModelRow & { profileImportReviewRequired?: unknown };
export type ConnectionChoiceFilter = (row: ConnectionModelRow) => boolean;

export const choiceLabel = (row: ConnectionModelRow) => row.name?.trim() || row.model?.trim() || row.id;

/** What an empty choice falls back to: Main, the agents' default, or one Connection (`null` = Main). */
export type InheritsFrom = "main" | "agents" | { connectionId: string | null };

export function resolveInherited<R extends { id: string }>(
  inherits: InheritsFrom,
  rows: readonly R[],
  allRows: readonly R[] | undefined,
  main: R | null,
): R | null {
  if (inherits === "main") return main;
  if (inherits === "agents")
    return rows.find((row) => isConnectionFlagTrue((row as Record<string, unknown>).defaultForAgents)) ?? main;
  const id = inherits.connectionId;
  return id === null ? main : (rows.find((row) => row.id === id) ?? allRows?.find((row) => row.id === id) ?? null);
}

/** "Same as chat" plus the Model it resolves to: "Same as chat (→ Claude Sonnet)". */
export const inheritLabel = (
  label: string,
  model: string,
  t: (key: string, values: Record<string, string>) => string,
) => t("connections.select.inheritWith", { label, model });

/**
 * The Models one slot offers, grouped by Connection, with their states and the texts of "Default" and the
 * current value. ConnectionSelect and ConnectionPicker share it.
 */
export function useConnectionChoices({
  kind,
  value,
  defaultLabel,
  includeLocalSidecar,
  extraOptions,
  rowFilter,
  inherits,
}: {
  kind: ConnectionSelectKind;
  value: string | null;
  defaultLabel?: string;
  includeLocalSidecar: boolean;
  extraOptions: ReadonlyArray<{ value: string; label: string }>;
  /** Hides Models this slot cannot use; the current value stays listed. */
  rowFilter?: ConnectionChoiceFilter;
  /** Connection the empty choice falls back to (`null` = Main); its Model is named after `defaultLabel`. */
  inherits?: InheritsFrom;
}) {
  const { t } = useTranslation();
  const connections = useConnections();
  const accountsQuery = useConnectionAccounts();
  const rawRows = connections.data;
  const accounts = accountsQuery.data;

  const view = useMemo(() => {
    const allRows = (rawRows ?? []) as ConnectionChoiceRow[];
    const offered = (row: ConnectionChoiceRow) =>
      matchesKind(row, kind) && (!rowFilter || row.id === value || rowFilter(row));
    const rows = allRows.filter(offered);
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));
    const rowById = new Map(allRows.map((row) => [row.id, row]));
    // A Model that borrows credentials (a decision row) belongs to, and is only as usable as, its lender's
    // Connection; the lender may be another kind, so grouping and lookups use every row.
    const accountOf = (row: ConnectionChoiceRow) => {
      const lender = row.credentialsFromConnectionId ? rowById.get(row.credentialsFromConnectionId) : undefined;
      const accountId = lender ? lender.accountId : row.accountId;
      return accountId ? accountById.get(accountId) : undefined;
    };
    const all = groupModelsByAccount(allRows, accounts ?? []);
    const groups = all.groups.map((group) => ({ ...group, rows: group.rows.filter(offered) }));
    const standalone = all.standalone.filter(offered);
    // Each kind defaults through its job's flag: Main for chat, the agents flag for media.
    const defaultFlag = FLAG_JOBS.find((job) => job.kind === kind)?.flag ?? "isDefault";
    const resolved = rows.find((row) => isConnectionFlagTrue(row[defaultFlag])) ?? null;
    const resolvedAccount = resolved ? accountOf(resolved) : undefined;
    return { rows, groups, standalone, resolved, resolvedAccount, accountOf };
  }, [accounts, kind, rawRows, rowFilter, value]);

  const inheritedRow =
    inherits === undefined
      ? undefined
      : resolveInherited(inherits, view.rows, rawRows as ConnectionChoiceRow[] | undefined, view.resolved);
  const defaultText =
    defaultLabel !== undefined && inheritedRow
      ? inheritLabel(defaultLabel, choiceLabel(inheritedRow), t)
      : (defaultLabel ??
        (view.resolved
          ? t("connections.select.defaultResolved", {
              model: view.resolved.model || choiceLabel(view.resolved),
              connection: view.resolvedAccount?.name ?? view.resolved.name ?? "",
            })
          : t("connections.select.default")));

  // The on-device Local Model answers chat-shaped helper calls only.
  const local = includeLocalSidecar && kind === "chat";
  const loading = connections.isLoading || accountsQuery.isLoading;
  const accountsKnown = accounts !== undefined;

  // An off Connection, one without a key, or an import awaiting review cannot answer;
  // the option stays visible but cannot be picked.
  const stateOf = (row: ConnectionChoiceRow) => {
    const account = view.accountOf(row);
    const suffix = !accountsKnown
      ? t(accountsQuery.isError ? "connections.select.unavailable" : "connections.select.checking")
      : isConnectionFlagTrue(row.profileImportReviewRequired)
        ? t("connections.select.review")
        : account && account.state !== "ok"
          ? t(`connections.select.${account.state}`)
          : "";
    return { account, suffix };
  };

  const extra = extraOptions.find((option) => option.value === value);
  const row = value ? view.rows.find((candidate) => candidate.id === value) : undefined;
  const isLocal = local && value === LOCAL_SIDECAR_CONNECTION_ID;
  const missing = !!value && !isLocal && !extra && !row;
  const rowState = row ? stateOf(row) : undefined;
  const current = !value
    ? { label: defaultText, hint: "" }
    : isLocal
      ? { label: t("connections.select.localModel"), hint: "" }
      : extra
        ? { label: extra.label, hint: "" }
        : row
          ? {
              label: choiceLabel(row),
              hint: [rowState?.account?.name ?? t("connections.select.standalone"), rowState?.suffix]
                .filter(Boolean)
                .join(" · "),
            }
          : // Until the lists arrive an unknown id is not "missing" yet.
            { label: loading ? value : t("connections.select.missing", { id: value }), hint: "" };

  return {
    ...view,
    defaultText,
    local,
    missing,
    current,
    stateOf,
    loading,
    accountsKnown,
    error: connections.isError || accountsQuery.isError,
    retry: () => {
      void connections.refetch();
      void accountsQuery.refetch();
    },
  };
}

export function ConnectionSelect({
  value,
  onChange,
  kind = "chat",
  defaultLabel,
  includeLocalSidecar = false,
  extraOptions = [],
  rowFilter,
  inherits,
  variant = "picker",
  label: rowLabel,
  title,
  className,
  scope,
  disabled,
  ...aria
}: {
  /** A Model id, or `null` for "Default". */
  value: string | null;
  onChange: (value: string | null) => void;
  kind?: ConnectionSelectKind;
  /** Text of the first option; without it the option names the Model the flags resolve to. */
  defaultLabel?: string;
  /** Add the on-device Local Model after the Connections (chat kind only). */
  includeLocalSidecar?: boolean;
  /** Values that are not Models but valid for this slot, such as "random"; listed after the first option. */
  extraOptions?: ReadonlyArray<{ value: string; label: string }>;
  /** Hides Models this slot cannot use; the current value stays listed. */
  rowFilter?: ConnectionChoiceFilter;
  /** Connection the empty choice falls back to (`null` = Main); its Model is named after `defaultLabel`. */
  inherits?: InheritsFrom;
  /**
   * `picker` (default): a field that opens the searchable picker. `menu`: a Settings-style label/value row that
   * opens the same picker. `native`: a native select, for callers that need one.
   */
  variant?: "picker" | "native" | "menu";
  /** Left side of the `menu` row (icon and role name). */
  label?: ReactNode;
  /** The picker window's title. */
  title?: string;
  className?: string;
  /** Where a picked Model is set, so the field can say so ("Set for this chat"). */
  scope?: "chat" | "agent";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const valueId = useId();
  const jobName = String(rowLabel ?? aria["aria-label"] ?? title ?? "").replace(/\s+model$/i, "");
  const choices = useConnectionChoices({
    kind,
    value,
    defaultLabel,
    includeLocalSidecar,
    extraOptions,
    rowFilter,
    inherits,
  });
  // "Add a model for this…" sets the new Model through the latest onChange, and its Undo through the one after it.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  if (variant === "native") {
    const option = (row: ConnectionChoiceRow) => {
      const { suffix } = choices.stateOf(row);
      return (
        <option key={row.id} value={row.id} disabled={!!suffix && row.id !== value}>
          {[choiceLabel(row), suffix && `(${suffix})`].filter(Boolean).join(" ")}
        </option>
      );
    };
    return (
      <select
        {...aria}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className={cn(
          "mari-chrome-field h-9 w-full max-md:min-h-11 [@media(pointer:coarse)]:min-h-11 min-w-0 truncate px-2 py-0 text-[0.6875rem]",
          className,
        )}
      >
        {!extraOptions.some((extra) => extra.value === "") && <option value="">{choices.defaultText}</option>}
        {extraOptions
          .filter((extra) => extra.value !== "")
          .map((extra) => (
            <option key={extra.value} value={extra.value}>
              {extra.label}
            </option>
          ))}
        {choices.missing && (
          <option value={value!}>{choices.loading ? value : t("connections.select.missing", { id: value })}</option>
        )}
        {choices.groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <optgroup key={group.account.id} label={group.account.name}>
              {group.rows.map(option)}
            </optgroup>
          ))}
        {choices.standalone.length > 0 && (
          <optgroup label={t("connections.select.standalone")}>{choices.standalone.map(option)}</optgroup>
        )}
        {choices.local && <option value={LOCAL_SIDECAR_CONNECTION_ID}>{t("connections.select.localModel")}</option>}
      </select>
    );
  }

  const { current } = choices;
  // Empty with no custom first-option text means "follow the job's default": say whose.
  const jobKey = FLAG_JOBS.find((job) => job.kind === kind)?.key;
  const source = value
    ? scope && t(`connections.select.scope.${scope}`)
    : !defaultLabel && choices.resolved && jobKey
      ? t("connections.select.fromDefaults", { job: t(`connections.defaults.role.${jobKey}`) })
      : null;
  const trigger = {
    ref: triggerRef,
    type: "button" as const,
    disabled,
    id: aria.id,
    // A <label for> names the button; the value then reaches assistive tech as its description.
    "aria-label": aria["aria-label"]
      ? t("connections.select.labelWithValue", { label: aria["aria-label"], value: current.label })
      : undefined,
    "aria-describedby": aria["aria-label"] ? undefined : valueId,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    "data-connection-value": value ?? "",
    onClick: () => {
      setOpened(true);
      setOpen(true);
    },
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          {...trigger}
          className={cn(
            "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-[var(--sidebar-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] md:min-h-9 [@media(pointer:coarse)]:min-h-11",
            className,
          )}
        >
          {rowLabel && <span className="flex shrink-0 items-center gap-2 text-[var(--foreground)]">{rowLabel}</span>}
          <span className="min-w-0 flex-1 text-right">
            <span id={valueId} className="block break-words text-[var(--foreground)]">
              {current.label}
            </span>
            {current.hint && (
              <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{current.hint}</span>
            )}
          </span>
          <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        </button>
      ) : (
        <button
          {...trigger}
          className={cn(
            "mari-chrome-field flex h-9 w-full min-w-0 items-center gap-1.5 px-2 py-0 text-left text-[0.6875rem] max-md:min-h-11 [@media(pointer:coarse)]:min-h-11",
            className,
          )}
        >
          <span id={valueId} className="min-w-0 flex-1 truncate">
            {current.label}
            {source && <span className="text-[0.625rem] text-[var(--muted-foreground)]"> · {source}</span>}
          </span>
          <ChevronDown size="0.75rem" className="shrink-0 opacity-60" aria-hidden />
        </button>
      )}
      {opened && (
        <Suspense fallback={null}>
          <ModelPicker
            open={open}
            onClose={() => setOpen(false)}
            title={t("connections.picker.modelFor", { job: jobName })}
            jobName={jobName}
            kind={kind}
            value={value}
            onChange={(next) => next !== (value || null) && onChange(next)}
            defaultText={choices.defaultText}
            includeDefault
            includeLocalSidecar={includeLocalSidecar}
            extraOptions={extraOptions}
            rowFilter={rowFilter}
            restoreFocusRef={triggerRef}
          />
        </Suspense>
      )}
    </>
  );
}
