// ──────────────────────────────────────────────
// Connection Model Picker — search, type, pin and pick a connection's
// model. Shared by the input-box Connections menu (desktop and phone) and
// Chat Settings → Connection. A pick is saved to the connection itself.
// ──────────────────────────────────────────────
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Loader2, RefreshCw, Search, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MODEL_LISTS, PROVIDERS, parsePinnedModels, type APIProvider } from "@marinara-engine/shared";
import {
  useConnectionModels,
  useRefreshConnectionModels,
  useSetConnectionModelPinned,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { useUpdateChat } from "../../hooks/use-chats";
import {
  connectionFieldsForModelPick,
  filterConnectionModelOptions,
  mergeConnectionModelOptions,
} from "../../lib/connection-model-selection";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { SubscriptionCostPill } from "./SubscriptionCostPill";
import { cn } from "../../lib/utils";

/** The connection row fields the picker reads. */
export type ModelPickerConnection = {
  id: string;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
  pinnedModels?: unknown;
  profileImportReviewRequired?: unknown;
  /**
   * NanoGPT: the connection's own "Show subscription usage" toggle. The cost
   * pills ride on it so a pay-as-you-go user is not shown subscription costs.
   * Stored as a "true"/"false" string, so it needs the shared flag helper.
   */
  showUsageWidget?: unknown;
};

/** Rows drawn at once in "All models"; searching narrows a longer list. */
const MAX_LISTED_MODELS = 300;

type PickerRow = {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
  isRemote?: boolean;
  subscriptionIncluded?: boolean;
  inputTokenMultiplier?: number;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error ?? ""));

export function ConnectionModelPicker({
  connection,
  chatId,
  chatConnectionId,
  leading,
  showConnectionName = false,
  autoFocusSearch = false,
  onPicked,
  className,
}: {
  connection: ModelPickerConnection;
  /** The chat to switch to this connection when a model is picked, if it uses another one. */
  chatId?: string | null;
  chatConnectionId?: string | null;
  /** Shown before the title, such as the phone menu's back control. */
  leading?: ReactNode;
  /** Name the connection beside its provider, where the connection list is out of sight. */
  showConnectionName?: boolean;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  onPicked?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const provider = (connection.provider ?? "") as APIProvider;
  const providerName = PROVIDERS[provider]?.name ?? connection.provider ?? "";
  const reviewRequired = isConnectionFlagTrue(connection.profileImportReviewRequired);
  // The cost pills are quoted against a subscription, so they follow the same
  // per-connection toggle as the usage meter itself.
  const showSubscriptionCost = isConnectionFlagTrue(connection.showUsageWidget);
  const currentModel = connection.model?.trim() ?? "";
  const pinnedIds = useMemo(() => parsePinnedModels(connection.pinnedModels), [connection.pinnedModels]);

  const modelList = useConnectionModels(connection.id, !reviewRequired);
  const refresh = useRefreshConnectionModels();
  const setPinned = useSetConnectionModelPinned();
  const updateConnection = useUpdateConnection();
  const updateChat = useUpdateChat();
  const saving = updateConnection.isPending || updateChat.isPending;

  useEffect(() => {
    // A new connection starts with an empty search.
    setSearch("");
  }, [connection.id]);

  useEffect(() => {
    if (!autoFocusSearch || !window.matchMedia?.("(pointer: fine)").matches) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusSearch, connection.id]);

  // Marinara's built-in models fill in only when the provider lists none or cannot be reached; next to a
  // provider's own list they are noise. A custom endpoint never gets them: its built-in list is the OpenAI
  // and Z.AI catalog, which says nothing about what that server runs.
  const remoteModels = modelList.data?.models;
  const options = useMemo(
    () =>
      mergeConnectionModelOptions(
        remoteModels ?? [],
        remoteModels?.length || modelList.isLoading || provider === "custom" ? [] : (MODEL_LISTS[provider] ?? []),
      ),
    [modelList.isLoading, provider, remoteModels],
  );
  const optionsById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  const { pinnedAll, othersAll } = useMemo(() => {
    const pinnedSet = new Set(pinnedIds);
    // The current model stays visible even when the provider does not list it (a typed ID).
    const others: PickerRow[] =
      currentModel && !pinnedSet.has(currentModel) && !optionsById.has(currentModel)
        ? [{ id: currentModel, name: currentModel }]
        : [];
    for (const option of options) if (!pinnedSet.has(option.id)) others.push(option);
    return { pinnedAll: pinnedIds.map((id): PickerRow => optionsById.get(id) ?? { id, name: id }), othersAll: others };
  }, [currentModel, options, optionsById, pinnedIds]);

  const { pinnedRows, otherRows, totalOther } = useMemo(() => {
    const filteredOthers = filterConnectionModelOptions(othersAll, deferredSearch);
    return {
      pinnedRows: filterConnectionModelOptions(pinnedAll, deferredSearch),
      otherRows: filteredOthers.slice(0, MAX_LISTED_MODELS),
      totalOther: filteredOthers.length,
    };
  }, [deferredSearch, othersAll, pinnedAll]);

  // What Enter does with the search text: an exact ID or name picks that model, a search with a single match
  // picks it, and only text that matches nothing is used as a model ID. Several matches wait for a choice.
  const typedId = search.trim();
  const { exactId, enterTarget, enterUsesTyped } = useMemo(() => {
    const typed = typedId.toLowerCase();
    if (!typed) return { exactId: null, enterTarget: null, enterUsesTyped: false };
    const rows = [...pinnedAll, ...othersAll];
    const byId = rows.find((row) => row.id.toLowerCase() === typed) ?? null;
    const byName = rows.filter((row) => row.name.toLowerCase() === typed);
    const matches = filterConnectionModelOptions(rows, typedId);
    const target: PickerRow | null =
      byId ??
      (byName.length === 1 ? byName[0]! : null) ??
      (matches.length === 1 ? matches[0]! : null) ??
      (matches.length === 0 ? { id: typedId, name: typedId } : null);
    return { exactId: byId, enterTarget: target, enterUsesTyped: matches.length === 0 };
  }, [othersAll, pinnedAll, typedId]);
  // The typed text can always be used as it is from its own row; Enter uses it only when nothing matches.
  const showTypedRow = !!typedId && !exactId;

  const pick = async (row: PickerRow) => {
    if (saving) return;
    try {
      if (row.id !== currentModel) {
        await updateConnection.mutateAsync({ id: connection.id, ...connectionFieldsForModelPick(provider, row) });
      }
      if (chatId && chatConnectionId !== connection.id) {
        await updateChat.mutateAsync({ id: chatId, connectionId: connection.id });
      }
      setSearch("");
      onPicked?.();
    } catch (error) {
      toast.error(t("connections.modelPicker.saveFailed", { error: errorMessage(error) }));
    }
  };

  const togglePin = (id: string, pinned: boolean) =>
    setPinned.mutate(
      { id: connection.id, model: id, pinned },
      { onError: (error) => toast.error(t("connections.modelPicker.pinFailed", { error: errorMessage(error) })) },
    );

  const focusOption = (from: HTMLElement | null, step: 1 | -1) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-model-option]") ?? [])];
    if (!from) return buttons[0]?.focus();
    const index = buttons.indexOf(from as HTMLButtonElement);
    const next = buttons[index + step];
    if (next) next.focus();
    else if (step === -1) searchRef.current?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-model-row]");
    const option = target?.querySelector<HTMLElement>("[data-model-option]") ?? null;
    if (!option) return;
    event.preventDefault();
    focusOption(option, event.key === "ArrowDown" ? 1 : -1);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keys pressed while an input method is composing belong to the composition.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(null, 1);
    } else if (event.key === "Enter" && typedId) {
      event.preventDefault();
      if (enterTarget) void pick(enterTarget);
    }
  };

  const renderRow = (row: PickerRow, pinned: boolean) => {
    const current = row.id === currentModel;
    const label = row.name || row.id;
    return (
      <div
        key={`${pinned ? "pinned" : "all"}:${row.id}`}
        data-model-row
        data-model-id={row.id}
        className={cn("relative flex rounded-lg", current && "bg-foreground/[0.07]")}
      >
        {current && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--marinara-chat-chrome-accent)]"
          />
        )}
        <button
          type="button"
          data-model-option
          aria-current={current ? "true" : undefined}
          disabled={saving}
          onClick={() => void pick(row)}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-3 pr-1 text-left outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-wait",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs font-medium text-foreground/90">{label}</span>
              {showSubscriptionCost && <SubscriptionCostPill model={row} />}
            </span>
            {label !== row.id && <span className="truncate text-[0.625rem] text-foreground/50">{row.id}</span>}
          </span>
          {current && (
            <Check
              size="0.875rem"
              className="shrink-0 text-foreground/80"
              aria-label={t("connections.modelPicker.current")}
            />
          )}
        </button>
        <button
          type="button"
          data-model-pin
          aria-pressed={pinned}
          // A toggle keeps one name; aria-pressed says whether it is pinned.
          aria-label={t("connections.modelPicker.pin", { model: label })}
          title={t(pinned ? "connections.modelPicker.unpin" : "connections.modelPicker.pin", { model: label })}
          onClick={() => togglePin(row.id, !pinned)}
          className={cn(
            "flex h-11 w-10 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25",
            pinned ? "text-[var(--marinara-chat-chrome-accent)]" : "text-foreground/35 hover:text-foreground/70",
          )}
        >
          <Star size="0.875rem" fill={pinned ? "currentColor" : "none"} />
        </button>
      </div>
    );
  };

  const sectionLabel = (label: string) => (
    <p className="px-3 pb-0.5 pt-2 text-[0.625rem] font-medium text-foreground/45">{label}</p>
  );

  return (
    <div data-connection-model-picker className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="flex min-w-0 items-center gap-2 px-3 pb-2 pt-2.5">
        {leading}
        <span className="shrink-0 text-xs font-semibold">{t("connections.modelPicker.title")}</span>
        {(providerName || showConnectionName) && (
          <span data-model-picker-provider className="min-w-0 truncate text-[0.6875rem] text-foreground/55">
            {showConnectionName && connection.name && connection.name !== providerName
              ? t("connections.modelPicker.connectionAndProvider", {
                  connection: connection.name,
                  provider: providerName,
                })
              : providerName}
          </span>
        )}
      </div>

      {reviewRequired ? (
        <p className="px-3 pb-3 text-[0.6875rem] text-foreground/60">{t("connections.modelPicker.reviewFirst")}</p>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-1.5 px-3 pb-1.5">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border sm:min-h-9 border-foreground/10 bg-foreground/[0.04] px-2.5 text-foreground/55 focus-within:border-foreground/25">
              <Search size="0.875rem" className="shrink-0" aria-hidden />
              <span className="sr-only">{t("connections.modelPicker.searchLabel")}</span>
              <input
                ref={searchRef}
                data-model-search
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t("connections.modelPicker.searchPlaceholder")}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                enterKeyHint="go"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-foreground/40"
              />
            </label>
            <button
              type="button"
              data-model-refresh
              onClick={() =>
                refresh.mutate(connection.id, {
                  onError: (error) =>
                    toast.error(t("connections.modelPicker.refreshFailed", { error: errorMessage(error) })),
                })
              }
              disabled={refresh.isPending || modelList.isFetching}
              aria-label={t("connections.modelPicker.refresh")}
              title={t("connections.modelPicker.refresh")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-foreground/10 sm:h-9 sm:w-9 text-foreground/55 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground/80 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:opacity-60"
            >
              <RefreshCw
                size="0.875rem"
                className={cn((refresh.isPending || modelList.isFetching) && "animate-spin")}
                aria-hidden
              />
            </button>
          </div>

          {modelList.isError && !refresh.isPending && (
            <div role="status" className="px-3 pb-1 text-[0.6875rem] leading-snug text-foreground/60">
              <p>{t("connections.modelPicker.loadFailed")}</p>
              <p className="mt-0.5 break-words text-[0.625rem] text-foreground/45">{errorMessage(modelList.error)}</p>
            </div>
          )}

          <div
            ref={listRef}
            data-model-list
            onKeyDown={onListKeyDown}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5"
          >
            {showTypedRow && (
              <div data-model-row className="flex">
                <button
                  type="button"
                  data-model-option
                  data-model-use-typed
                  disabled={saving}
                  onClick={() => void pick({ id: typedId, name: typedId })}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-3 py-1.5 text-left outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25"
                >
                  <span className="truncate text-xs font-medium text-foreground/90">
                    {t("connections.modelPicker.useTyped", { model: typedId })}
                  </span>
                  <span className="text-[0.625rem] text-foreground/50">
                    {t(
                      enterUsesTyped ? "connections.modelPicker.useTypedHint" : "connections.modelPicker.useTypedAsIs",
                    )}
                  </span>
                </button>
              </div>
            )}

            {pinnedRows.length > 0 && (
              <section aria-label={t("connections.modelPicker.pinned")} data-model-section="pinned">
                {sectionLabel(t("connections.modelPicker.pinned"))}
                {pinnedRows.map((row) => renderRow(row, true))}
              </section>
            )}

            {otherRows.length > 0 && (
              <section
                aria-label={t("connections.modelPicker.allModels")}
                data-model-section="all"
                className={cn(pinnedRows.length > 0 && "mt-1 border-t border-foreground/10")}
              >
                {sectionLabel(t("connections.modelPicker.allModels"))}
                {otherRows.map((row) => renderRow(row, false))}
              </section>
            )}

            {totalOther > otherRows.length && (
              <p className="px-3 py-2 text-[0.625rem] text-foreground/45">
                {t("connections.modelPicker.truncated", { shown: otherRows.length, total: totalOther })}
              </p>
            )}

            {modelList.isLoading && (
              <p className="flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-foreground/50">
                <Loader2 size="0.75rem" className="animate-spin" aria-hidden />
                {t("connections.modelPicker.loading")}
              </p>
            )}

            {!modelList.isLoading &&
              !modelList.isError &&
              !typedId &&
              pinnedRows.length === 0 &&
              otherRows.length === 0 && (
                <p className="px-3 py-3 text-[0.6875rem] text-foreground/50">{t("connections.modelPicker.empty")}</p>
              )}
          </div>

          <p className="border-t border-foreground/10 px-3 py-2 text-[0.625rem] text-foreground/50">
            {t("connections.modelPicker.footer")}
          </p>
        </>
      )}
    </div>
  );
}
