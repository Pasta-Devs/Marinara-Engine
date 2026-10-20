// ──────────────────────────────────────────────
// ConnectionBalance — what is left on a Connection's account: the short word on the card header ("556.44 left")
// and the full block on the Connection page (left, used, source, last check, Refresh).
// ──────────────────────────────────────────────
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { ConnectionBalance } from "@marinara-engine/shared";
import { useConnectionBalance } from "../../hooks/use-connection-accounts";
import { formatRelativeContact } from "../../lib/relative-time";
import { cn } from "../../lib/utils";
import { formatMoney } from "./CostBadge";
import { SMALL_ACTION } from "./DeviceDetail";

/** The card header word: what is left, or this month's use where the key has no cap. */
export function balanceWord(balance: ConnectionBalance | null | undefined, t: TFunction, locale?: string) {
  if (!balance) return null;
  const money = (value: number) => formatMoney(value, balance.unit, locale);
  if (balance.left !== null) return t("connections.balance.left", { amount: money(balance.left) });
  if (balance.used === undefined) return null;
  return balance.scope === "month"
    ? t("connections.balance.thisMonth", { amount: money(balance.used) })
    : t("connections.balance.used", { amount: money(balance.used) });
}

/** The Connection page block. Services without a balance endpoint say so quietly; that is not an error. */
export function ConnectionBalanceBlock({ accountId, className }: { accountId: string; className?: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const { data, error, isLoading, refresh } = useConnectionBalance(accountId);
  const balance = data?.balance ?? null;
  const failed = refresh.error ?? error;
  const money = (value: number) => (balance ? formatMoney(value, balance.unit, locale) : "");
  const rows: Array<[string, string]> = balance
    ? [
        ...(balance.left !== null
          ? [[t("connections.balance.leftLabel"), money(balance.left)] as [string, string]]
          : []),
        ...(balance.used !== undefined
          ? [
              [
                balance.scope === "month"
                  ? t("connections.balance.thisMonthLabel")
                  : t("connections.balance.usedLabel"),
                money(balance.used),
              ] as [string, string],
            ]
          : []),
        ...(balance.granted !== undefined
          ? [[t("connections.balance.grantedLabel"), money(balance.granted)] as [string, string]]
          : []),
        ...(balance.parts ?? []).map(
          (part) => [t(`connections.balance.parts.${part.id}`), money(part.amount)] as [string, string],
        ),
        ...(balance.requests !== undefined
          ? [[t("connections.balance.requestsLabel"), balance.requests.toLocaleString(locale)] as [string, string]]
          : []),
      ]
    : [];

  return (
    <section data-connection-balance className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{t("connections.balance.title")}</h3>
        {balance && (
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className={cn(SMALL_ACTION, "inline-flex items-center gap-1.5 disabled:opacity-60")}
          >
            <RefreshCw
              size="0.875rem"
              className={cn(refresh.isPending && "animate-spin motion-reduce:animate-none")}
              aria-hidden
            />
            {t("connections.balance.refresh")}
          </button>
        )}
      </div>
      {isLoading ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t("connections.balance.loading")}</p>
      ) : failed ? (
        <p role="status" className="text-xs text-[var(--muted-foreground)]">
          {t("connections.balance.failed", { error: failed instanceof Error ? failed.message : String(failed) })}
        </p>
      ) : !balance ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t("connections.balance.none")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[var(--muted-foreground)]">{label}</dt>
                <dd className="text-right tabular-nums text-[var(--foreground)]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t(`connections.balance.scope.${balance.scope}`, {
              source: t(`connections.balance.source.${balance.source}`),
            })}
            {" · "}
            {t("connections.balance.checked", { age: formatRelativeContact(balance.checkedAt) ?? "" })}
          </p>
        </>
      )}
      {data?.notice && (
        <p
          role="note"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-amber-500)_10%,transparent)] px-3 py-2 text-xs text-[var(--foreground)]"
        >
          {t(`connections.balance.notice.${data.notice}`)}
        </p>
      )}
    </section>
  );
}
