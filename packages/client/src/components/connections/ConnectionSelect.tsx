// ──────────────────────────────────────────────
// ConnectionSelect — picks a Model, grouped by Connection: a field (or a Settings label/value row) that opens
// the searchable ConnectionPicker, or a native <select> where a caller asks for one.
// ──────────────────────────────────────────────
import { lazy, Suspense, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID, isChatProvider, type ConnectionPickerKind } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount, type ConnectionModelRow } from "../../lib/connection-groups";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";

// The window loads on first open, so a screen of compact fields does not pull it into startup.
const ConnectionPicker = lazy(() => import("./ConnectionPicker").then((m) => ({ default: m.ConnectionPicker })));

export type ConnectionSelectKind = ConnectionPickerKind;

const KIND_PROVIDER: Record<Exclude<ConnectionSelectKind, "chat" | "all">, string> = {
  image: "image_generation",
  video: "video_generation",
  audio: "audio",
  decision: "decision",
};

function matchesKind(row: ConnectionModelRow, kind: ConnectionSelectKind) {
  if (kind === "all") return true;
  return kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind];
}

export type ConnectionChoiceRow = ConnectionModelRow & { profileImportReviewRequired?: unknown };

export const choiceLabel = (row: ConnectionModelRow) => row.name?.trim() || row.model?.trim() || row.id;

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
}: {
  kind: ConnectionSelectKind;
  value: string | null;
  defaultLabel?: string;
  includeLocalSidecar: boolean;
  extraOptions: ReadonlyArray<{ value: string; label: string }>;
  /** Hides Models this slot cannot use; the current value stays listed. */
  rowFilter?: (row: ConnectionModelRow) => boolean;
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
    // Image, video and audio Models default through the agents flag, not the chat one.
    const defaultFlag = kind === "image" || kind === "video" || kind === "audio" ? "defaultForAgents" : "isDefault";
    const resolved = rows.find((row) => isConnectionFlagTrue(row[defaultFlag])) ?? null;
    const resolvedAccount = resolved ? accountOf(resolved) : undefined;
    return { rows, groups, standalone, resolved, resolvedAccount, accountOf };
  }, [accounts, kind, rawRows, rowFilter, value]);

  const defaultText =
    defaultLabel ??
    (view.resolved
      ? t("connections.select.defaultResolved", {
          model: view.resolved.model || choiceLabel(view.resolved),
          connection: view.resolvedAccount?.name ?? view.resolved.name ?? "",
        })
      : t("connections.select.default"));

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
  variant = "picker",
  label: rowLabel,
  title,
  className,
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
  rowFilter?: (row: ConnectionModelRow) => boolean;
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
  id?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const valueId = useId();
  const choices = useConnectionChoices({ kind, value, defaultLabel, includeLocalSidecar, extraOptions, rowFilter });

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
        onChange={(event) => onChange(event.target.value || null)}
        className={cn(
          "mari-chrome-field h-9 w-full max-md:min-h-11 [@media(pointer:coarse)]:min-h-11 min-w-0 truncate px-2 py-0 text-[0.6875rem]",
          className,
        )}
      >
        <option value="">{choices.defaultText}</option>
        {extraOptions.map((extra) => (
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
  const trigger = {
    ref: triggerRef,
    type: "button" as const,
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
          </span>
          <ChevronDown size="0.75rem" className="shrink-0 opacity-60" aria-hidden />
        </button>
      )}
      {opened && (
        <Suspense fallback={null}>
          <ConnectionPicker
            open={open}
            onClose={() => setOpen(false)}
            value={value}
            // Re-picking the current value stores nothing.
            onChange={(next) => next !== (value || null) && onChange(next)}
            kind={kind}
            defaultLabel={choices.defaultText}
            includeLocalSidecar={includeLocalSidecar}
            extraOptions={extraOptions}
            rowFilter={rowFilter}
            title={title}
            restoreFocusRef={triggerRef}
          />
        </Suspense>
      )}
    </>
  );
}
