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

/** `value` / `onChange` carry this when "None" is chosen (needs `allowNone`). */
export const CONNECTION_SELECT_NONE = "none";

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

const label = (row: ConnectionModelRow) => row.name?.trim() || row.model?.trim() || row.id;

export function ConnectionSelect({
  value,
  onChange,
  kind = "chat",
  defaultLabel,
  allowNone = false,
  includeLocalSidecar = false,
  className,
  ...aria
}: {
  /** A Model id, `null` for "Default", or `CONNECTION_SELECT_NONE`. */
  value: string | null;
  onChange: (value: string | null) => void;
  kind?: ConnectionSelectKind;
  /** Text of the first option; without it the option names the Model the flags resolve to. */
  defaultLabel?: string;
  allowNone?: boolean;
  /** Add the on-device Local Model after the Connections. */
  includeLocalSidecar?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const { data: rawRows } = useConnections();
  const { data: accounts } = useConnectionAccounts();

  const view = useMemo(() => {
    const rows = ((rawRows ?? []) as ConnectionModelRow[]).filter((row) => matchesKind(row, kind));
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));
    const { groups, standalone } = groupModelsByAccount(rows, accounts ?? []);
    const resolved = rows.find((row) => isConnectionFlagTrue(row.isDefault)) ?? null;
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

  const known = value === LOCAL_SIDECAR_CONNECTION_ID || view.rows.some((row) => row.id === value);
  const missing = !!value && value !== CONNECTION_SELECT_NONE && !known;

  // An off Connection or one without a key cannot answer; the option stays visible but disabled.
  const option = (row: ConnectionModelRow) => {
    const account = row.accountId ? view.accountById.get(row.accountId) : undefined;
    const suffix = account && account.state !== "ok" ? t(`connections.select.${account.state}`) : "";
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
      className={cn("mari-chrome-field h-9 w-full min-w-0 truncate px-2 py-0 text-[0.6875rem]", className)}
    >
      <option value="">{defaultText}</option>
      {allowNone && <option value={CONNECTION_SELECT_NONE}>{t("connections.select.none")}</option>}
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
