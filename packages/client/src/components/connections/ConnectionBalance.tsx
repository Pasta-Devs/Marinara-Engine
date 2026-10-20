// ──────────────────────────────────────────────
// ConnectionBalance — what is left on a Connection's account: the short word on the card header ("556.44 left"),
// and the "Usage and balance" section on the Connection page. The section has one row per source: the Connection
// itself, then each "via X" upstream it routes to (a linked Connection of X, or a usage-only key for X).
// ──────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import {
  supportsSubscriptionUsageWidget,
  takesBalanceToken,
  UPSTREAM_BALANCE_TARGETS,
  upstreamBalanceSource,
  type ConnectionAccountListItem,
  type ConnectionBalance,
} from "@marinara-engine/shared";
import {
  useConnectionAccounts,
  useConnectionBalance,
  useSetUsageKey,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useOutsideReads } from "../../hooks/use-connections";
import { knownPrefixName, subgroupByUpstream } from "../../lib/connection-groups";
import { formatRelativeContact } from "../../lib/relative-time";
import { cn } from "../../lib/utils";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { Modal } from "../ui/Modal";
import { formatMoney } from "./CostBadge";
import { SMALL_ACTION } from "./DeviceDetail";
import { BrandMark } from "./ProviderIcon";
import { CompactUsageMeter } from "./SubscriptionUsageWidget";

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

/** Own sources that name a service, not a proxy: their model-id prefixes are model makers, not upstreams. */
const SERVICE_SOURCES = new Set(["linkapi", "openrouter", "deepseek", "moonshot", "nanogpt"]);

/** The "via X" upstreams the Connection routes to, as its model wells show them. */
export function usageUpstreams(account: ConnectionAccountListItem, models: ReadonlyArray<{ model?: string | null }>) {
  if (account.balanceSource && SERVICE_SOURCES.has(account.balanceSource)) return [];
  return subgroupByUpstream(models).flatMap((group) => (group.upstream ? [group.upstream] : []));
}

type SheetTarget = { upstream: string | null };

function UsageRow({
  mark,
  title,
  subtitle,
  value,
  detail,
  action,
  children,
}: {
  mark: ReactNode;
  title: string;
  subtitle?: ReactNode;
  value?: string | null;
  detail?: string | null;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-start gap-3 px-3 py-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-[var(--card)] ring-1 ring-[var(--border)]"
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--foreground)]">{title}</p>
        {subtitle && <div className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{subtitle}</div>}
        {children}
      </div>
      {(value || detail) && (
        <div className="shrink-0 text-right">
          {value && <p className="text-xs font-semibold tabular-nums text-[var(--foreground)]">{value}</p>}
          {detail && <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">{detail}</p>}
        </div>
      )}
      {action && <div className="shrink-0 self-center">{action}</div>}
    </li>
  );
}

const NotAvailable = () => {
  const { t } = useTranslation();
  return <span className="mari-connection-pill">{t("connections.usage.notAvailable")}</span>;
};

/** A balance read and its words: the value, a "4.12 of 20" detail, and the line under the title. */
function useBalanceWords(accountId: string, enabled: boolean, upstream: string, refreshTick: number) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const { data, error, isLoading, refresh } = useConnectionBalance(accountId, enabled, upstream);
  const { mutate } = refresh;
  useEffect(() => {
    if (refreshTick && enabled) mutate();
  }, [refreshTick, enabled, mutate]);
  const balance = data?.balance ?? null;
  const failed = refresh.error ?? error;
  const money = (value: number) => (balance ? formatMoney(value, balance.unit, locale) : "");
  const detail =
    balance && balance.used !== undefined && balance.granted !== undefined
      ? t("connections.usage.usedOf", { used: money(balance.used), total: money(balance.granted) })
      : null;
  const status = !enabled
    ? null
    : isLoading || refresh.isPending
      ? t("connections.balance.loading")
      : failed
        ? t("connections.balance.failed", { error: failed instanceof Error ? failed.message : String(failed) })
        : balance
          ? [
              t(`connections.balance.scope.${balance.scope}`, {
                source: t(`connections.balance.source.${balance.source}`),
              }),
              t("connections.balance.checked", { age: formatRelativeContact(balance.checkedAt) ?? "" }),
            ].join(" · ")
          : null;
  return { value: balanceWord(balance, t, locale), detail, status, notice: data?.notice, empty: !!data && !balance };
}

function OwnRow({
  account,
  usageAnchorId,
  refreshTick,
  onKey,
}: {
  account: ConnectionAccountListItem;
  usageAnchorId: string | null;
  refreshTick: number;
  onKey: () => void;
}) {
  const { t } = useTranslation();
  const source = account.balanceSource;
  const words = useBalanceWords(account.id, !!source && account.state === "ok", "", refreshTick);
  const plan = supportsSubscriptionUsageWidget(account.provider);
  // NanoGPT's usage-only management key and LinkAPI's dashboard token belong to the Connection itself.
  const takesKey = account.provider === "nanogpt" || takesBalanceToken(account);
  return (
    <UsageRow
      mark={<BrandMark of={account.provider === "custom" ? source : account.provider} className="h-4 w-4" />}
      title={t("connections.usage.thisKey", { name: account.name })}
      subtitle={
        <>
          {source ? words.status : !plan && t("connections.usage.noOwnBalance")}
          {words.notice && <p role="note">{t(`connections.balance.notice.${words.notice}`)}</p>}
          {takesKey && (
            <button type="button" onClick={onKey} className="mt-1 block font-semibold text-[var(--primary)]">
              {account.hasManagementToken ? t("connections.usage.changeUsageKey") : t("connections.usage.addUsageKey")}
            </button>
          )}
        </>
      }
      value={words.value}
      detail={words.detail}
      action={!source && !plan ? <NotAvailable /> : undefined}
    >
      {plan && usageAnchorId && <CompactUsageMeter connectionId={usageAnchorId} className="mt-1.5" />}
    </UsageRow>
  );
}

function UpstreamRow({
  account,
  upstream,
  accounts,
  refreshTick,
  onKey,
}: {
  account: ConnectionAccountListItem;
  upstream: string;
  accounts: ConnectionAccountListItem[];
  refreshTick: number;
  onKey: () => void;
}) {
  const { t } = useTranslation();
  const setUsageKey = useSetUsageKey();
  const source = upstreamBalanceSource(upstream);
  const service = knownPrefixName(upstream) ?? upstream;
  const entry = account.usageKeys[upstream];
  // A linked Connection that was deleted (or changed service) goes back to "Add key".
  const linked = entry?.accountId
    ? accounts.find((other) => other.id === entry.accountId && other.balanceSource === source)
    : undefined;
  const set = !!linked || !!entry?.hasKey;
  const words = useBalanceWords(account.id, !!source && set, upstream, refreshTick);
  const candidates = accounts.filter((other) => other.id !== account.id && !!source && other.balanceSource === source);
  const title = t("connections.accounts.section.via", { service });
  const mark = <BrandMark of={upstream} className="h-4 w-4" />;

  if (!source) {
    return (
      <UsageRow
        mark={mark}
        title={title}
        subtitle={t("connections.usage.noBalanceApi", { service })}
        action={<NotAvailable />}
      />
    );
  }
  if (set) {
    return (
      <UsageRow
        mark={mark}
        title={title}
        subtitle={
          <>
            <p>
              {linked ? t("connections.usage.usesConnection", { name: linked.name }) : t("connections.usage.usageKey")}
            </p>
            {words.status && <p>{words.status}</p>}
          </>
        }
        value={words.value}
        detail={words.detail}
        action={
          <button type="button" onClick={onKey} className={SMALL_ACTION}>
            {t("connections.usage.change")}
          </button>
        }
      />
    );
  }
  const useIt = candidates.length === 1;
  return (
    <UsageRow
      mark={mark}
      title={title}
      subtitle={
        candidates.length
          ? t("connections.usage.youHave", { service })
          : t("connections.usage.proxyCannot", { proxy: account.name, service })
      }
      action={
        <button
          type="button"
          disabled={setUsageKey.isPending}
          onClick={() =>
            useIt
              ? setUsageKey.mutate(
                  { id: account.id, upstream, value: { accountId: candidates[0]!.id } },
                  { onError: (error) => toast.error(error.message) },
                )
              : onKey()
          }
          className={SMALL_ACTION}
        >
          {useIt ? t("connections.usage.useIt") : t("connections.usage.addKey")}
        </button>
      }
    />
  );
}

/** The sheet behind "Add key": link a Connection of the upstream first, paste a usage-only key second. */
function UsageKeySheet({
  account,
  upstream,
  accounts,
  onClose,
}: {
  account: ConnectionAccountListItem;
  /** Null: the Connection's own usage-only key (NanoGPT management key, LinkAPI dashboard token). */
  upstream: string | null;
  accounts: ConnectionAccountListItem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const setUsageKey = useSetUsageKey();
  const update = useUpdateConnectionAccount();
  const source = upstream ? upstreamBalanceSource(upstream) : null;
  const service = upstream ? (knownPrefixName(upstream) ?? upstream) : account.name;
  const candidates = upstream
    ? accounts.filter((other) => other.id !== account.id && !!source && other.balanceSource === source)
    : [];
  const entry = upstream ? account.usageKeys[upstream] : undefined;
  const [choice, setChoice] = useState<string>(
    (entry?.accountId && candidates.some((other) => other.id === entry.accountId) ? entry.accountId : null) ??
      candidates[0]?.id ??
      "paste",
  );
  const [key, setKey] = useState("");
  const [userId, setUserId] = useState(account.balanceUserId);
  const linkApiSelf = !upstream && takesBalanceToken(account);
  const host = upstream ? UPSTREAM_BALANCE_TARGETS[upstream]?.host : null;
  const busy = setUsageKey.isPending || update.isPending;
  const saved = upstream ? !!entry : account.hasManagementToken;
  const canSave = choice !== "paste" || !!key.trim() || (linkApiSelf && userId !== account.balanceUserId);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.accounts.editor.saveFailed"));
    }
  };
  const save = () =>
    run(() =>
      upstream
        ? setUsageKey.mutateAsync({
            id: account.id,
            upstream,
            value: choice === "paste" ? { key: key.trim() } : { accountId: choice },
          })
        : update.mutateAsync({
            id: account.id,
            ...(key.trim() ? { managementToken: key.trim() } : {}),
            ...(linkApiSelf ? { balanceUserId: userId.trim() } : {}),
          }),
    );
  const remove = () =>
    run(() =>
      upstream
        ? setUsageKey.mutateAsync({ id: account.id, upstream, value: null })
        : update.mutateAsync({ id: account.id, managementToken: "" }),
    );

  const option = (id: string, label: string, help: string, extra?: ReactNode) => (
    <label
      key={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1",
        choice === id
          ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] ring-[var(--primary)]"
          : "ring-[var(--border)]",
      )}
    >
      <input
        type="radio"
        name="usage-key-choice"
        checked={choice === id}
        onChange={() => setChoice(id)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block text-[0.6875rem] text-[var(--muted-foreground)]">{help}</span>
        {extra}
      </span>
    </label>
  );
  const keyField = (
    <input
      type="password"
      autoComplete="off"
      value={key}
      onChange={(event) => {
        setKey(event.target.value);
        setChoice("paste");
      }}
      placeholder={t("connections.usage.keyPlaceholder")}
      aria-label={t("connections.usage.pasteKey")}
      className="mari-chrome-field mt-2 h-11 w-full px-3 font-mono text-xs md:h-9"
    />
  );

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={busy}
      title={upstream ? t("connections.usage.sheetTitle", { service }) : t("connections.usage.selfSheetTitle")}
      opaque
      width="max-w-md"
      panelClassName="mari-connection-scope"
    >
      <div data-usage-key-sheet className="flex flex-col gap-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {upstream
            ? t("connections.usage.sheetIntro", { proxy: account.name, service })
            : linkApiSelf
              ? t("connections.balance.linkapiTokenHelp")
              : t("connections.accounts.editor.managementTokenHelp")}
        </p>
        {upstream ? (
          <div
            role="radiogroup"
            aria-label={t("connections.usage.sheetTitle", { service })}
            className="flex flex-col gap-2"
          >
            {candidates.map((other) =>
              option(
                other.id,
                t("connections.usage.useConnection", { service }),
                t("connections.usage.useConnectionHelp", { name: other.name }),
              ),
            )}
            {option(
              "paste",
              t("connections.usage.pasteKey"),
              t(`connections.usage.keyHelp.${upstream}`),
              choice === "paste" && keyField,
            )}
          </div>
        ) : (
          <>
            {keyField}
            {linkApiSelf && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
                  {t("connections.balance.linkapiUserId")}
                </span>
                <input
                  value={userId}
                  onChange={(event) => setUserId(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={20}
                  className="mari-chrome-field h-11 w-full px-3 text-xs md:h-9"
                />
                <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("connections.balance.linkapiUserIdHelp")}
                </span>
              </label>
            )}
          </>
        )}
        <p className="flex items-start gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
          <Lock size="0.75rem" className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {host
              ? t("connections.usage.sentOnlyTo", { host, proxy: account.name, service })
              : t("connections.usage.keysNote")}
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
          {saved && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="me-auto min-h-11 text-xs font-semibold text-[var(--marinara-app-accent-static)] hover:underline md:min-h-9"
            >
              {t("connections.usage.remove")}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={busy} className="mari-connection-btn">
            {t("connections.accounts.editor.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !canSave}
            className="mari-connection-btn mari-connection-btn--primary"
          >
            {t("connections.usage.showUsage")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * "Usage and balance" on the Connection page. Hidden where nothing can be read (a local server, a service without a
 * balance and without readable upstreams). Until the user allows outside reads it offers to turn them on.
 */
export function ConnectionUsageSection({
  account,
  models,
  usageAnchorId,
  showOnCard,
  onShowOnCard,
}: {
  account: ConnectionAccountListItem;
  models: ReadonlyArray<{ model?: string | null }>;
  /** The Model the plan meter reads (the card's anchor). */
  usageAnchorId: string | null;
  showOnCard: boolean;
  onShowOnCard: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const outsideReads = useOutsideReads();
  const { data: accounts = [] } = useConnectionAccounts();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const upstreams = usageUpstreams(account, models);
  const plan = supportsSubscriptionUsageWidget(account.provider);
  const readable = !!account.balanceSource || plan || upstreams.some((upstream) => !!upstreamBalanceSource(upstream));
  if (account.treatAsLocalEndpoint || !readable) return null;
  const allowed = outsideReads.value === "on";

  return (
    <section data-connection-usage className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="flex items-baseline gap-1.5 text-xs font-semibold text-[var(--foreground)]">
          {t("connections.usage.title")}
          <span className="font-normal text-[var(--muted-foreground)]">
            {t("connections.usage.sources", { count: upstreams.length + 1 })}
          </span>
        </h3>
        {allowed && (
          <button
            type="button"
            onClick={() => setRefreshTick((tick) => tick + 1)}
            className={cn(SMALL_ACTION, "inline-flex items-center gap-1.5")}
          >
            <RefreshCw size="0.875rem" aria-hidden />
            {t("connections.balance.refresh")}
          </button>
        )}
      </div>
      {!allowed ? (
        <div className="mari-connection-model-well flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
          <p className="min-w-0 flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.usage.consentNeeded")}
          </p>
          <button type="button" onClick={() => void outsideReads.ask()} className={SMALL_ACTION}>
            {t("connections.usage.turnOn")}
          </button>
        </div>
      ) : (
        <ul className="mari-connection-model-well divide-y divide-[var(--border)]/60">
          <OwnRow
            account={account}
            usageAnchorId={usageAnchorId}
            refreshTick={refreshTick}
            onKey={() => setSheet({ upstream: null })}
          />
          {upstreams.map((upstream) => (
            <UpstreamRow
              key={upstream}
              account={account}
              upstream={upstream}
              accounts={accounts}
              refreshTick={refreshTick}
              onKey={() => setSheet({ upstream })}
            />
          ))}
        </ul>
      )}
      {plan && (
        <div className="-mx-1.5">
          <ToggleSetting label={t("connections.usage.showOnCard")} checked={showOnCard} onChange={onShowOnCard} />
        </div>
      )}
      {upstreams.length > 0 && (
        <p className="flex items-start gap-2 px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <Lock size="0.75rem" className="mt-0.5 shrink-0" aria-hidden />
          <span>{t("connections.usage.keysNote")}</span>
        </p>
      )}
      {sheet && (
        <UsageKeySheet account={account} upstream={sheet.upstream} accounts={accounts} onClose={() => setSheet(null)} />
      )}
    </section>
  );
}
