// ──────────────────────────────────────────────
// ConnectionSelect — native <select> that picks a Model, grouped by Connection.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID, isChatProvider } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount, type ConnectionModelRow } from "../../lib/connection-groups";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";

export type ConnectionSelectKind = "chat" | "image" | "video" | "audio" | "decision";

const KIND_PROVIDER: Record<Exclude<ConnectionSelectKind, "chat">, string> = {
  image: "image_generation",
  video: "video_generation",
  audio: "audio",
  decision: "decision",
};

function matchesKind(row: ConnectionModelRow, kind: ConnectionSelectKind) {
  return kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind];
}

type Row = ConnectionModelRow & { profileImportReviewRequired?: unknown };

const label = (row: ConnectionModelRow) => row.name?.trim() || row.model?.trim() || row.id;

export function ConnectionSelect({
  value,
  onChange,
  kind = "chat",
  defaultLabel,
  includeLocalSidecar = false,
  extraOptions = [],
  className,
  ...aria
}: {
  /** A Model id, or `null` for "Default". */
  value: string | null;
  onChange: (value: string | null) => void;
  kind?: ConnectionSelectKind;
  /** Text of the first option; without it the option names the Model the flags resolve to. */
  defaultLabel?: string;
  /** Add the on-device Local Model after the Connections. */
  includeLocalSidecar?: boolean;
  /** Values that are not Models but valid for this slot, such as "random"; listed after the first option. */
  extraOptions?: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const { data: rawRows } = useConnections();
  const { data: accounts } = useConnectionAccounts();

  const view = useMemo(() => {
    const rows = ((rawRows ?? []) as Row[]).filter((row) => matchesKind(row, kind));
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));
    const { groups, standalone } = groupModelsByAccount(rows, accounts ?? []);
    // Image, video and audio Models default through the agents flag, not the chat one.
    const defaultFlag = kind === "image" || kind === "video" || kind === "audio" ? "defaultForAgents" : "isDefault";
    const resolved = rows.find((row) => isConnectionFlagTrue(row[defaultFlag])) ?? null;
    const resolvedAccount = resolved?.accountId ? accountById.get(resolved.accountId) : undefined;
    return { rows, groups, standalone, resolved, resolvedAccount, accountById };
  }, [accounts, kind, rawRows]);

  const defaultText =
    defaultLabel ??
    (view.resolved
      ? t("connections.select.defaultResolved", {
          model: view.resolved.model || label(view.resolved),
          connection: view.resolvedAccount?.name ?? view.resolved.name ?? "",
        })
      : t("connections.select.default"));

  const known =
    (includeLocalSidecar && value === LOCAL_SIDECAR_CONNECTION_ID) ||
    extraOptions.some((extra) => extra.value === value) ||
    view.rows.some((row) => row.id === value);
  const missing = !!value && !known;

  // An off Connection, one without a key, or an import awaiting review cannot answer;
  // the option stays visible but disabled.
  const option = (row: Row) => {
    const account = row.accountId ? view.accountById.get(row.accountId) : undefined;
    const suffix = isConnectionFlagTrue(row.profileImportReviewRequired)
      ? t("connections.select.review")
      : account && account.state !== "ok"
        ? t(`connections.select.${account.state}`)
        : "";
    return (
      <option key={row.id} value={row.id} disabled={!!suffix && row.id !== value}>
        {[label(row), suffix && `(${suffix})`].filter(Boolean).join(" ")}
      </option>
    );
  };

  return (
    <select
      {...aria}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        "mari-chrome-field h-9 w-full max-md:min-h-11 min-w-0 truncate px-2 py-0 text-[0.6875rem]",
        className,
      )}
    >
      <option value="">{defaultText}</option>
      {extraOptions.map((extra) => (
        <option key={extra.value} value={extra.value}>
          {extra.label}
        </option>
      ))}
      {missing && <option value={value!}>{t("connections.select.missing", { id: value })}</option>}
      {view.groups
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <optgroup key={group.account.id} label={group.account.name}>
            {group.rows.map(option)}
          </optgroup>
        ))}
      {view.standalone.length > 0 && (
        <optgroup label={t("connections.select.standalone")}>{view.standalone.map(option)}</optgroup>
      )}
      {includeLocalSidecar && <option value={LOCAL_SIDECAR_CONNECTION_ID}>{t("connections.select.localModel")}</option>}
    </select>
  );
}
