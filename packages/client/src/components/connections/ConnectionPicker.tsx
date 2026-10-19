// ──────────────────────────────────────────────
// ConnectionPicker — a searchable window of saved Models, grouped by Connection, for any Model slot.
// It only reports the pick: it saves nothing, stars nothing and changes no chat or default.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AlertTriangle, Check, Cpu, House, Loader2, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { ProviderIcon } from "./ProviderIcon";
import { ConnectionIdentity } from "./ConnectionIdentity";
import { ConnectionModelList } from "./ConnectionModelList";
import { ModelRow } from "./ConnectionRow";
import {
  choiceLabel,
  useConnectionChoices,
  type ConnectionChoiceRow,
  type ConnectionSelectKind,
} from "./ConnectionSelect";
import { accountStateLabel } from "../../lib/connection-groups";
import { useCachedCatalogFacts, type CachedCatalogFacts } from "../../hooks/use-connections";
import { modelKindOf, modelSubtitle } from "../../lib/connection-identity";
import { cn } from "../../lib/utils";

const ROW_CLASS =
  "relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent md:min-h-9 [@media(pointer:coarse)]:min-h-11";
const BADGE_CLASS = "mari-connection-pill";
const ICON_BOX = "flex h-6 w-6 shrink-0 items-center justify-center text-foreground/55";
const OPTION = "[data-picker-option]:not(:disabled)";

export function ConnectionPicker({
  open,
  onClose,
  value,
  onChange,
  kind = "chat",
  defaultLabel,
  includeDefault = true,
  includeLocalSidecar = false,
  extraOptions = [],
  title,
  restoreFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** A Model id, or `null` for "Default". */
  value: string | null;
  /** Every pick, the current value included; `onClose` follows. */
  onChange: (value: string | null) => void;
  kind?: ConnectionSelectKind;
  defaultLabel?: string;
  /** Offer `null` ("Default") first. */
  includeDefault?: boolean;
  /** Offer the on-device Local Model (chat kind only). */
  includeLocalSidecar?: boolean;
  extraOptions?: ReadonlyArray<{ value: string; label: string }>;
  title?: string;
  /** Where focus goes back on close; the opener by default. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const choices = useConnectionChoices({
    kind,
    value,
    defaultLabel: defaultLabel ?? t("connections.select.default"),
    includeLocalSidecar,
    extraOptions,
  });
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // A touch keyboard would cover half the list, so only a fine pointer gets the search focused.
  const finePointer = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

  // Each opening starts with an empty search.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  // The list mounts with each opening; the current choice scrolls into view once.
  const setList = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    node?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (open && !choices.loading)
      listRef.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
  }, [open, choices.loading, value]);

  const pick = (next: string | null) => {
    onChange(next);
    onClose();
  };

  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const hit = (...texts: Array<string | null | undefined>) => {
    const haystack = texts.filter(Boolean).join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  };

  const option = (
    key: string,
    {
      selected,
      disabled = false,
      onPick,
      icon,
      label,
      hint,
      badge,
    }: {
      selected: boolean;
      disabled?: boolean;
      onPick: () => void;
      icon: ReactNode;
      label: string;
      hint?: string | null;
      badge?: string;
    },
  ) => (
    <button
      key={key}
      type="button"
      data-picker-option
      data-picker-value={key}
      disabled={disabled}
      aria-current={selected || undefined}
      onClick={onPick}
      className={cn(ROW_CLASS, selected && "bg-foreground/[0.07] font-semibold")}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {hint && (
          <span className="truncate text-[0.625rem] font-normal text-foreground/50" title={hint}>
            {hint}
          </span>
        )}
      </span>
      {badge && <span className={BADGE_CLASS}>{badge}</span>}
      {selected && <Check size="0.75rem" className="shrink-0 text-[var(--mari-connection-ink)]" aria-hidden />}
    </button>
  );

  const modelOption = (row: ConnectionChoiceRow, upstream: string | null = null, catalog?: CachedCatalogFacts) => {
    const { account, suffix } = choices.stateOf(row);
    const facts = catalog?.of(row.model);
    const label = choiceLabel(row);
    const selected = row.id === value;
    return (
      <ModelRow
        key={row.id}
        data-picker-option
        data-picker-value={row.id}
        // A broken Model is never picked; the current one may be re-confirmed, which changes nothing.
        disabled={!!suffix && !selected}
        aria-current={selected || undefined}
        onClick={() => pick(row.id)}
        tile={
          <ProviderIcon
            provider={row.provider ?? account?.provider ?? "custom"}
            model={row.model}
            baseUrl={account?.baseUrl}
            name={account?.name}
            icon={row.icon}
            imagePath={row.imagePath}
            size="row"
            dim={!!suffix}
          />
        }
        title={label}
        subtitle={modelSubtitle(row, upstream)}
        // A picker for one capability does not repeat it on every row.
        kind={kind === "all" ? modelKindOf(row.provider) : null}
        status={suffix ? { label: suffix, state: account?.state } : null}
        cost={facts?.cost}
        showPaid={catalog?.showPaid}
        retiring={facts}
        current={selected}
        dim={!!suffix}
        className="rounded-lg"
        trailing={
          selected && <Check size="0.875rem" className="shrink-0 text-[var(--mari-connection-ink)]" aria-hidden />
        }
      />
    );
  };
  const matches = (row: ConnectionChoiceRow) => {
    const account = choices.accountOf(row);
    return hit(choiceLabel(row), row.model, row.provider, account?.name, account?.provider);
  };

  const top = [
    includeDefault &&
      hit(choices.defaultText) &&
      option("default", {
        selected: !value,
        onPick: () => pick(null),
        icon: (
          <span className={ICON_BOX}>
            <House size="0.875rem" aria-hidden />
          </span>
        ),
        label: choices.defaultText,
      }),
    ...extraOptions
      .filter((extra) => hit(extra.label))
      .map((extra) =>
        option(`extra:${extra.value}`, {
          selected: extra.value === value,
          onPick: () => pick(extra.value),
          icon: <span className={ICON_BOX} aria-hidden />,
          label: extra.label,
        }),
      ),
    choices.missing &&
      !choices.loading &&
      option("missing", {
        selected: true,
        onPick: () => pick(value),
        icon: (
          <span className={ICON_BOX}>
            <AlertTriangle size="0.875rem" aria-hidden />
          </span>
        ),
        label: t("connections.select.missing", { id: value }),
      }),
  ].filter(Boolean);

  const groups = (choices.accountsKnown ? choices.groups : [])
    .map((group) => ({ group, rows: group.rows.filter(matches) }))
    .filter(({ rows }) => rows.length > 0);
  // Cost badges from the catalogs already cached for each Connection; nothing is fetched for them.
  const catalogs = useCachedCatalogFacts(groups.map(({ group }) => group.rows.map((row) => row.id)));
  const standalone = choices.accountsKnown ? choices.standalone.filter(matches) : [];
  const localShown = choices.local && hit(t("connections.select.localModel"));
  const nothingShown = top.length === 0 && groups.length === 0 && standalone.length === 0 && !localShown;

  const header = (icon: ReactNode, name: string, badge?: string) => (
    <div className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5">
      {icon}
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground/85">{name}</span>
      {badge && <span className={BADGE_CLASS}>{badge}</span>}
    </div>
  );

  // Arrows walk the options; Up from the first one goes back to the search.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(OPTION) ?? []);
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) searchRef.current?.focus();
    else options[Math.min(next, options.length - 1)]?.focus();
  };
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const first = listRef.current?.querySelector<HTMLButtonElement>(OPTION);
    if (event.key === "ArrowDown" && first) {
      event.preventDefault();
      first.focus();
    } else if (event.key === "Enter" && words.length > 0 && first) {
      event.preventDefault();
      first.click();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t("connections.switcher.chooseModel")}
      width="max-w-md"
      opaque
      panelClassName="connection-picker-dialog mari-connection-scope"
      closeButtonClassName="!min-h-11 !min-w-11"
      initialFocusRef={finePointer ? searchRef : undefined}
      restoreFocusRef={restoreFocusRef}
      contentClassName="flex flex-col !overflow-hidden !p-0"
    >
      <div className="shrink-0 px-3 pb-1 pt-3">
        <label className="mari-chrome-field flex min-h-11 items-center gap-2 px-2.5 text-foreground/55 focus-within:ring-1 focus-within:ring-[var(--ring)] md:min-h-9 [@media(pointer:coarse)]:min-h-11">
          <Search size="0.875rem" className="shrink-0" aria-hidden />
          <span className="sr-only">{t("connections.picker.searchLabel")}</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("connections.picker.searchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-foreground outline-none placeholder:text-foreground/40 md:text-xs"
          />
        </label>
      </div>
      <div
        ref={setList}
        onKeyDown={onListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
        aria-busy={choices.loading || undefined}
      >
        {top}
        {groups.map(({ group, rows }, index) => (
          <section key={group.account.id} className="mari-connection-group mt-1" aria-label={group.account.name}>
            <ConnectionIdentity
              account={group.account}
              rows={group.rows}
              count={t("connections.list.models", { count: rows.length })}
              state={group.account.state}
              stateLabel={t(accountStateLabel(group.account))}
              size="sm"
              className="py-1.5 ps-3 pe-2"
            />
            <ConnectionModelList
              provider={group.account.provider}
              rows={rows}
              getKey={(row) => row.id}
              renderRow={(row, upstream) => modelOption(row, upstream, catalogs[index])}
              autoFold={words.length === 0}
            />
          </section>
        ))}
        {standalone.length > 0 && (
          <section className="mari-connection-group mt-1" aria-label={t("connections.select.standalone")}>
            {header(<ProviderIcon provider="custom" size="sm" />, t("connections.select.standalone"))}
            {standalone.map((row) => modelOption(row))}
          </section>
        )}
        {localShown && (
          <div className="mt-1 border-t border-foreground/10 pt-1">
            {option("local", {
              selected: value === LOCAL_SIDECAR_CONNECTION_ID,
              onPick: () => pick(LOCAL_SIDECAR_CONNECTION_ID),
              icon: (
                <span className={ICON_BOX}>
                  <Cpu size="0.875rem" aria-hidden />
                </span>
              ),
              label: t("connections.select.localModel"),
            })}
          </div>
        )}

        {choices.loading ? (
          <p className="flex items-center justify-center gap-2 px-3 py-4 text-[0.6875rem] text-foreground/50">
            <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
            {t("connections.picker.loading")}
          </p>
        ) : choices.error ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-3 py-4 text-center text-[0.6875rem]">
            <span className="text-foreground/60">{t("connections.picker.error")}</span>
            <button type="button" onClick={choices.retry} className="mari-connection-btn">
              <RefreshCw size="0.75rem" aria-hidden />
              {t("connections.picker.retry")}
            </button>
          </div>
        ) : words.length > 0 && nothingShown ? (
          <p className="px-3 py-4 text-center text-[0.6875rem] text-foreground/50">
            {t("connections.switcher.noMatches")}
          </p>
        ) : choices.rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-[0.6875rem] text-foreground/50">{t("connections.picker.empty")}</p>
        ) : null}
      </div>
    </Modal>
  );
}
