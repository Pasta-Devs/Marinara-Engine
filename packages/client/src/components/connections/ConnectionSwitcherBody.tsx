// ──────────────────────────────────────────────
// Connection Switcher Body — the quick switch shared by the desktop popover,
// the phone sheet and Professor Mari's composer. Left: search across saved
// Models and catalogs, Favourites, Recent, Connections, Local Model, Shuffle.
// Right (or a second step): the chosen Connection's catalog.
// ──────────────────────────────────────────────
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Cpu, Link, Search, Shuffle, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  parsePinnedModels,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import { connectionKeys, useConnections, useUpdateConnection } from "../../hooks/use-connections";
import { useChats, useUpdateChat } from "../../hooks/use-chats";
import { useCatalogSearch, useConnectionAccounts, usePickModel } from "../../hooks/use-connection-accounts";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  filterLanguageGenerationConnections,
  isConnectionFlagTrue,
  resolveUsageConnection,
} from "../../lib/connection-filters";
import { accountStateLabel, groupModelsByAccount, recentModels, subgroupByUpstream } from "../../lib/connection-groups";
import { cn } from "../../lib/utils";
import { ConnectionModelPicker } from "./ConnectionModelPicker";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";

type SwitcherRow = {
  id: string;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
  accountId?: string | null;
  credentialsFromConnectionId?: string | null;
  pinnedModels?: unknown;
  useForRandom?: boolean | string | null;
  isDefault?: boolean | string | null;
  showUsageWidget?: unknown;
  showUsageFiveHour?: unknown;
  showUsageWeekly?: unknown;
  profileImportReviewRequired?: unknown;
};

/** A Connection as the list shows it: an account with its chat Models, or a standalone Model on its own. */
type SwitcherGroup = { key: string; account: ConnectionAccountListItem | null; name: string; rows: SwitcherRow[] };

/** A pickable line: a saved Model, or a model id to find or create under a Connection. */
type Entry = {
  key: string;
  title: string;
  subtitle?: string;
  rowId?: string;
  accountId?: string;
  model?: string;
  /** The catalog name for a new Model; without it the server names it (maintainer decision 21). */
  name?: string;
};

/** A model id under a Connection: its saved Model when there is one, otherwise found or created on pick. */
function entryFor(group: SwitcherGroup, model: string, title?: string): Entry {
  const saved = group.rows.find((row) => row.model === model);
  return saved
    ? { key: saved.id, title: rowLabel(saved), subtitle: group.name, rowId: saved.id }
    : {
        key: `${group.key}:${model}`,
        title: title || model,
        subtitle: group.name,
        accountId: group.key,
        model,
        name: title,
      };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error ?? ""));
const rowLabel = (row: SwitcherRow) => row.name || row.model || row.id;

const ROW_CLASS =
  "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-wait max-md:min-h-11";

function AccentBar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--marinara-chat-chrome-accent)]"
    />
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-0.5 pt-2 text-[0.625rem] font-medium text-foreground/45">{children}</p>;
}

/**
 * The chat hosts' pick: point this chat at the Model, then offer to make it the default for new chats.
 * A pick never edits the shared Model row (maintainer decision 1).
 */
export function useChatModelPick(chatId: string | null) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const updateChat = useUpdateChat();
  const updateConnection = useUpdateConnection();
  return useCallback(
    async (connectionId: string) => {
      if (!chatId) return;
      await updateChat.mutateAsync({ id: chatId, connectionId });
      if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) return;
      // Read the cache now: a Model created by this pick is not in any earlier render's list.
      const row = (qc.getQueryData(connectionKeys.list()) as SwitcherRow[] | undefined)?.find(
        (candidate) => candidate.id === connectionId,
      );
      if (!row || isConnectionFlagTrue(row.isDefault)) return;
      const model = rowLabel(row);
      toast.success(t("connections.switcher.picked", { model }), {
        action: {
          label: t("connections.switcher.useForNewChats"),
          onClick: () =>
            updateConnection.mutate(
              { id: connectionId, isDefault: true },
              {
                onSuccess: () => toast.success(t("connections.switcher.madeDefault", { model })),
                onError: (error) =>
                  toast.error(t("connections.switcher.defaultFailed", { error: errorMessage(error) })),
              },
            ),
        },
      });
    },
    [chatId, qc, t, updateChat, updateConnection],
  );
}

export function ConnectionSwitcherBody({
  currentId,
  onApply,
  onDone,
  layout,
  showLocalModel,
  localModelHint,
  shuffle,
  listHeader,
  empty,
  autoFocusSearch = false,
  pickerFooter,
  onStepChange,
  className,
  listClassName,
  modelsClassName,
  backClassName,
}: {
  /** The Model in use ("random" while Shuffle is on). */
  currentId: string | null;
  /** Points the host (chat or Professor Mari) at a Model row. */
  onApply: (connectionId: string) => Promise<void>;
  /** Closes the host menu; every pick ends with it. */
  onDone: () => void;
  /** columns: both panes side by side. steps: one pane at a time. container: both rendered, host CSS decides. */
  layout: "columns" | "steps" | "container";
  showLocalModel: boolean;
  localModelHint?: string;
  /** The chat's random-pool mode; absent where there is none (Professor Mari). */
  shuffle?: { active: boolean; onToggle: () => void };
  listHeader?: ReactNode;
  /** Shown when there is nothing to pick. */
  empty?: ReactNode;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  pickerFooter?: string;
  onStepChange?: (step: "list" | "models") => void;
  className?: string;
  listClassName?: string;
  modelsClassName?: string;
  backClassName?: string;
}) {
  const { t } = useTranslation();
  const { data: connectionsRaw } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const { data: chats } = useChats();
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const updateConnection = useUpdateConnection();
  const pickModel = usePickModel();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [highlight, setHighlight] = useState(0);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [step, setStepState] = useState<"list" | "models">("list");
  const searchRef = useRef<HTMLInputElement>(null);

  const setStep = (next: "list" | "models") => {
    setStepState(next);
    onStepChange?.(next);
  };

  const rows = useMemo(
    () => filterLanguageGenerationConnections((connectionsRaw ?? []) as SwitcherRow[]),
    [connectionsRaw],
  );
  const groups = useMemo<SwitcherGroup[]>(() => {
    const { groups: byAccount, standalone } = groupModelsByAccount(rows, accounts ?? []);
    return [
      // Connections with only image or voice Models have nothing to pick here.
      ...byAccount
        .filter((group) => group.rows.length > 0)
        .map((group) => ({
          key: group.account.id,
          account: group.account,
          name: group.account.name,
          rows: group.rows,
        })),
      ...standalone.map((row) => ({ key: row.id, account: null, name: rowLabel(row), rows: [row] })),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, rows]);
  const groupOfRow = useMemo(() => {
    const map = new Map<string, SwitcherGroup>();
    for (const group of groups) for (const row of group.rows) map.set(row.id, group);
    return map;
  }, [groups]);
  const groupByAccount = useMemo(
    () => new Map(groups.filter((group) => group.account).map((group) => [group.account!.id, group])),
    [groups],
  );

  const currentRow = currentId ? rows.find((row) => row.id === currentId) : undefined;
  const currentGroup = currentRow ? groupOfRow.get(currentRow.id) : undefined;
  const shownGroup = groups.find((group) => group.key === shownKey) ?? currentGroup;

  useEffect(() => {
    if (!autoFocusSearch || !window.matchMedia?.("(pointer: fine)").matches) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusSearch]);

  const apply = async (entry: Entry) => {
    if (busy) return;
    setBusy(true);
    try {
      let rowId = entry.rowId;
      if (!rowId && entry.accountId && entry.model) {
        rowId = (await pickModel.mutateAsync({ accountId: entry.accountId, model: entry.model, name: entry.name }))
          .connectionId;
      }
      if (rowId && rowId !== currentId) await onApply(rowId);
      onDone();
    } catch (error) {
      toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  };

  // ★ Favourites: the pins of every Connection (pins are shared by all Models of an account).
  const favourites = useMemo(
    () =>
      groups.flatMap((group) => {
        if (!group.account) return [];
        const pins = new Set(group.rows.flatMap((row) => parsePinnedModels(row.pinnedModels)));
        return [...pins].map((model) => entryFor(group, model));
      }),
    [groups],
  );
  const recent = useMemo(() => {
    const shown = new Set(favourites.map((entry) => entry.rowId).filter(Boolean));
    return recentModels(chats ?? [], rows, 3, currentId)
      .filter((row) => !shown.has(row.id))
      .map((row): Entry => ({
        key: row.id,
        title: rowLabel(row),
        subtitle: groupOfRow.get(row.id)?.name,
        rowId: row.id,
      }));
  }, [chats, currentId, favourites, groupOfRow, rows]);

  // Search: saved Models first, then catalog models not saved yet, then the typed text as a model id.
  const catalog = useCatalogSearch(deferredQuery);
  const { saved: savedHits, extra: extraHits } = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    if (!q) return { saved: [] as Entry[], extra: [] as Entry[] };
    const saved = rows
      .filter((row) => `${row.name ?? ""}\n${row.model ?? ""}`.toLowerCase().includes(q))
      .map((row): Entry => ({
        key: row.id,
        title: rowLabel(row),
        subtitle: groupOfRow.get(row.id)?.name,
        rowId: row.id,
      }));
    const added = (catalog.data ?? []).flatMap((hit) => {
      const group = groupByAccount.get(hit.accountId);
      return group && !group.rows.some((row) => row.model === hit.model)
        ? [{ ...entryFor(group, hit.model, hit.name), subtitle: `${hit.model} · ${group.name}` }]
        : [];
    });
    // A pasted id goes to the Connection in use, or the one on show.
    const typed = deferredQuery;
    const target = [currentGroup, shownGroup].find((group) => group?.account);
    const known = rows.some((row) => row.model === typed) || added.some((entry) => entry.model === typed);
    if (target && !/\s/.test(typed) && !known) {
      added.push({
        key: `use:${typed}`,
        title: t("connections.switcher.useModelId", { model: typed }),
        subtitle: t("connections.switcher.useModelIdOn", { connection: target.name }),
        accountId: target.key,
        model: typed,
      });
    }
    return { saved, extra: added };
  }, [catalog.data, currentGroup, deferredQuery, groupByAccount, groupOfRow, rows, shownGroup, t]);
  const searchEntries = useMemo(() => [...savedHits, ...extraHits], [extraHits, savedHits]);
  const savedCount = savedHits.length;
  const hasCatalogHits = extraHits.some((entry) => !entry.key.startsWith("use:"));
  const searching = deferredQuery.length > 0;

  useEffect(() => setHighlight(0), [deferredQuery]);

  const showModels = (group: SwitcherGroup) => {
    setShownKey(group.key);
    setStep("models");
  };

  const renderEntry = (entry: Entry, index?: number) => {
    const current = !!entry.rowId && entry.rowId === currentId;
    const highlighted = index !== undefined && index === highlight;
    return (
      <button
        type="button"
        key={entry.key}
        data-switcher-entry={entry.rowId ?? entry.model}
        aria-current={current ? "true" : undefined}
        disabled={busy}
        onClick={() => void apply(entry)}
        onMouseEnter={index !== undefined ? () => setHighlight(index) : undefined}
        className={cn(ROW_CLASS, current && "bg-foreground/[0.07] font-semibold", highlighted && "bg-foreground/10")}
      >
        {current && <AccentBar />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{entry.title}</span>
          {entry.subtitle && (
            <span className="truncate text-[0.625rem] font-normal text-foreground/50">{entry.subtitle}</span>
          )}
        </span>
        {current && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
      </button>
    );
  };

  const renderGroup = (group: SwitcherGroup) => {
    const isCurrent = group === currentGroup;
    const isShown = layout !== "steps" && group === shownGroup;
    const state = group.account && group.account.state !== "ok" ? t(accountStateLabel(group.account)) : null;
    return (
      <div key={group.key}>
        <button
          type="button"
          data-connection-option={isCurrent && currentRow ? currentRow.id : group.rows[0]!.id}
          data-connection-group={group.key}
          aria-current={isCurrent ? "true" : undefined}
          // A standalone Model has no Connection to add a Model to, and editing it in place would change it for
          // every chat, so picking it only switches this chat to it.
          onClick={() =>
            group.account
              ? showModels(group)
              : void apply({ key: group.key, title: group.name, rowId: group.rows[0]!.id })
          }
          aria-label={group.account ? t("connections.modelPicker.showModels", { connection: group.name }) : undefined}
          className={cn(ROW_CLASS, isShown && "bg-foreground/[0.07]", isCurrent && "font-semibold")}
        >
          {isShown && <AccentBar />}
          <span
            aria-hidden
            className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          >
            <Link size="0.75rem" />
          </span>
          <span className="min-w-0 flex-1 truncate">{group.name}</span>
          {state && (
            <span className="mari-chrome-muted-badge shrink-0 px-1.5 py-px text-[0.625rem] font-normal leading-4">
              {state}
            </span>
          )}
          <ChevronRight size="0.875rem" className="shrink-0 text-foreground/40" aria-hidden />
        </button>
        {isCurrent && (
          <div className="pl-3" data-switcher-current-models>
            {subgroupByUpstream(group.rows).map((sub) => (
              <div key={sub.upstream ?? ""}>
                {sub.upstream && <SectionLabel>{sub.upstream}</SectionLabel>}
                {sub.rows.map((row) =>
                  renderEntry({ key: row.id, title: rowLabel(row), subtitle: row.model ?? undefined, rowId: row.id }),
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const localEntry: Entry = {
    key: LOCAL_SIDECAR_CONNECTION_ID,
    title: t("connections.switcher.localModel"),
    subtitle: localModelHint ?? t("connections.switcher.localModelHint"),
    rowId: LOCAL_SIDECAR_CONNECTION_ID,
  };

  const shuffleRow = shuffle && (
    <button
      type="button"
      data-switcher-shuffle
      onClick={shuffle.onToggle}
      aria-pressed={shuffle.active}
      title={t(
        shuffle.active
          ? "ui.chat.quickconnectionswitcher.randomPoolActiveClickToDisable"
          : "ui.chat.quickconnectionswitcher.useRandomConnectionFromPool",
      )}
      className={cn(ROW_CLASS, shuffle.active && "bg-foreground/[0.07] font-semibold")}
    >
      {shuffle.active && <AccentBar />}
      <Shuffle size="0.875rem" className="shrink-0 text-foreground/55" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t("connections.switcher.shuffle")}</span>
      {shuffle.active && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
    </button>
  );

  // Shuffle on: the list becomes the pool, as before.
  const poolList = (
    <>
      {shuffleRow}
      <div className="mx-2 my-1 h-px bg-foreground/10" />
      {[...rows]
        .sort((a, b) => rowLabel(a).localeCompare(rowLabel(b)))
        .map((row) => {
          const inPool = isConnectionFlagTrue(row.useForRandom);
          return (
            <button
              type="button"
              key={row.id}
              onClick={() => updateConnection.mutate({ id: row.id, useForRandom: !inPool })}
              aria-pressed={inPool}
              className={ROW_CLASS}
              title={t(
                inPool
                  ? "ui.chat.quickconnectionswitcher.inRandomPoolClickToRemove"
                  : "ui.chat.quickconnectionswitcher.clickToAddToRandomPool",
              )}
            >
              <span className="flex-1 truncate">{rowLabel(row)}</span>
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  inPool ? "border-foreground/35 bg-foreground/10 text-foreground/75" : "border-foreground/20",
                )}
              >
                {inPool && <Check size="0.625rem" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
    </>
  );

  const searchBox = (
    <label className="mx-1 mb-1 flex min-h-11 items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 text-foreground/55 focus-within:border-foreground/25 md:min-h-9">
      <Search size="0.875rem" className="shrink-0" aria-hidden />
      <span className="sr-only">{t("connections.switcher.searchLabel")}</span>
      <input
        ref={searchRef}
        data-switcher-search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Keys pressed while an input method is composing belong to the composition.
          if (event.nativeEvent.isComposing || event.keyCode === 229 || !searching) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setHighlight((index) => Math.min(Math.max(index + step, 0), searchEntries.length - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const entry = searchEntries[highlight];
            if (entry) void apply(entry);
          }
        }}
        placeholder={t("connections.switcher.searchPlaceholder")}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        enterKeyHint="go"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-foreground/40"
      />
    </label>
  );

  const nothing = groups.length === 0 && !showLocalModel;
  const list = (
    <div
      data-switcher-list
      className={cn(
        "flex min-h-0 flex-col",
        layout === "columns" && "w-[15.5rem] shrink-0 border-r border-foreground/10",
        layout === "steps" && "flex-1",
        layout === "steps" && step === "models" && "hidden",
        listClassName,
      )}
    >
      {listHeader}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        {shuffle?.active ? (
          poolList
        ) : nothing ? (
          (empty ?? (
            <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
              {t("ui.chat.quickconnectionswitcher.noConnectionsFound")}
            </div>
          ))
        ) : (
          <>
            {searchBox}
            {searching ? (
              <div data-switcher-results>
                {searchEntries.slice(0, savedCount).map((entry, index) => renderEntry(entry, index))}
                {hasCatalogHits && <SectionLabel>{t("connections.switcher.addFromCatalog")}</SectionLabel>}
                {searchEntries.slice(savedCount).map((entry, index) => renderEntry(entry, savedCount + index))}
                {searchEntries.length === 0 && (
                  <p className="px-3 py-3 text-[0.6875rem] text-foreground/50">
                    {t(catalog.isFetching ? "connections.switcher.searching" : "connections.switcher.noMatches")}
                  </p>
                )}
              </div>
            ) : (
              <>
                {favourites.length > 0 && (
                  <section data-switcher-section="favourites" aria-label={t("connections.switcher.favourites")}>
                    <SectionLabel>
                      <Star size="0.625rem" className="mr-1 inline align-[-1px]" fill="currentColor" aria-hidden />
                      {t("connections.switcher.favourites")}
                    </SectionLabel>
                    {favourites.map((entry) => renderEntry(entry))}
                  </section>
                )}
                {recent.length > 0 && (
                  <section data-switcher-section="recent" aria-label={t("connections.switcher.recent")}>
                    <SectionLabel>{t("connections.switcher.recent")}</SectionLabel>
                    {recent.map((entry) => renderEntry(entry))}
                  </section>
                )}
                <section data-switcher-section="connections" aria-label={t("connections.switcher.connections")}>
                  <SectionLabel>{t("connections.switcher.connections")}</SectionLabel>
                  {groups.map(renderGroup)}
                  {showLocalModel && (
                    <div className="mt-1 border-t border-foreground/10 pt-1">{renderEntry(localEntry)}</div>
                  )}
                </section>
                {shuffleRow && <div className="mt-1 border-t border-foreground/10 pt-1">{shuffleRow}</div>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  // The catalog shows the chosen Connection through one of its Models. A Model the chat does not use must not
  // look current there, so it is passed without its model id. A standalone Model gets no catalog: a pick there
  // would edit the shared row for every chat.
  const pickerRow = shownGroup ? (shownGroup === currentGroup ? currentRow : shownGroup.rows[0]) : undefined;
  const pickerConnection =
    pickerRow && shownGroup?.account
      ? pickerRow !== currentRow
        ? { ...pickerRow, model: null }
        : pickerRow
      : undefined;
  const usageRow = pickerRow ? resolveUsageConnection(rows, pickerRow.id) : null;

  const models = shuffle?.active ? null : (
    <div
      data-quick-connection-models
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        layout === "steps" && step === "list" && "hidden",
        modelsClassName,
      )}
    >
      {usageRow && (layout !== "steps" || step === "models") && (
        <div className="border-b border-foreground/10 px-3 pt-1">
          <SubscriptionUsageWidget connectionId={usageRow.id} variant="inline" />
        </div>
      )}
      {pickerConnection && (layout !== "steps" || step === "models") ? (
        <ConnectionModelPicker
          key={pickerConnection.id}
          connection={pickerConnection}
          applyPick={(connectionId) => (connectionId === currentId ? Promise.resolve() : onApply(connectionId))}
          accountName={shownGroup?.account?.name}
          footer={pickerFooter}
          onPicked={onDone}
          leading={
            layout !== "columns" ? (
              <button
                type="button"
                data-model-back
                onClick={() => setStep("list")}
                aria-label={t("connections.modelPicker.back")}
                title={t("connections.modelPicker.back")}
                className={
                  backClassName ??
                  "-my-2 -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground/85"
                }
              >
                <ChevronLeft size="1rem" aria-hidden />
              </button>
            ) : undefined
          }
        />
      ) : (
        <p className="px-4 py-4 text-[0.6875rem] text-foreground/50">
          {currentId === LOCAL_SIDECAR_CONNECTION_ID ? (
            <span className="flex items-center gap-1.5">
              <Cpu size="0.75rem" aria-hidden />
              {sidecarModelDisplayName || t("connections.modelPicker.localModel")}
            </span>
          ) : (
            t("connections.modelPicker.chooseConnection")
          )}
        </p>
      )}
    </div>
  );

  return (
    <div
      data-connection-switcher
      className={cn(layout === "columns" ? "flex min-h-0 min-w-0 flex-1" : "contents", className)}
    >
      {list}
      {models}
    </div>
  );
}
