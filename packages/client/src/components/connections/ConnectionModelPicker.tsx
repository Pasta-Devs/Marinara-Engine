// ──────────────────────────────────────────────
// Connection Model Picker — search, type, star and pick a connection's
// model. Shared by the input-box Connections menu (desktop and phone),
// Chat Settings → Connection (a pick applies to the chat only), the panel's
// Add model and the setup flow (a pick saves a Model).
// ──────────────────────────────────────────────
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Loader2, Plus, RefreshCw, Search, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  MODEL_LISTS,
  PROVIDERS,
  parsePinnedModels,
  type APIProvider,
  type ChatModelChoice,
  type ConnectionModelCost,
  type ModelCatalogPricing,
  type ModelParameterCapabilities,
} from "@marinara-engine/shared";
import {
  useConnectionModels,
  useRefreshConnectionModels,
  useSetConnectionModelPinned,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { usePickModel } from "../../hooks/use-connection-accounts";
import { useModelStar } from "../../hooks/use-model-star";
import {
  connectionFieldsForModelPick,
  filterConnectionModelOptions,
  mergeConnectionModelOptions,
} from "../../lib/connection-model-selection";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { formatCompactTokenCount } from "../../lib/professor-mari-context-budget";
import { knownPrefixName, subgroupByUpstream, upstreamOf } from "../../lib/connection-groups";
import { BrandMark, ProviderIcon } from "./ProviderIcon";
import { ModelRow } from "./ConnectionRow";
import { cn } from "../../lib/utils";
import { formatRelativeContact } from "../../lib/relative-time";
import { useUIStore } from "../../stores/ui.store";

/** The connection row fields the picker reads. */
export type ModelPickerConnection = {
  id: string;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
  pinnedModels?: unknown;
  /** The Connection this Model belongs to; `applyPick` and saving a starred model need it. */
  accountId?: string | null;
  profileImportReviewRequired?: unknown;
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
  capabilities?: ModelParameterCapabilities;
  cost?: ConnectionModelCost;
  pricing?: ModelCatalogPricing;
  deprecated?: boolean;
  retiresAt?: string;
};

type CostFilter = "free" | "included" | "paid";
type ModelSort = "list" | "price" | "context";

/** The cost chip a row falls under; a multiplier is still in the plan. */
const costKind = (row: PickerRow): CostFilter | null =>
  row.cost === "free" || row.cost === "paid"
    ? row.cost
    : row.cost === "included" || row.cost?.startsWith("multiplier:")
      ? "included"
      : null;

/** Cheapest first: free, in the plan (by multiplier), then listed prices; no price last. */
function priceKey(row: PickerRow): [number, number] {
  if (row.cost === "free") return [0, 0];
  if (row.cost === "included") return [1, 1];
  if (row.cost?.startsWith("multiplier:")) return [1, Number(row.cost.slice("multiplier:".length)) || 1];
  const price = (row.pricing?.prompt ?? 0) + (row.pricing?.completion ?? 0);
  return price > 0 ? [2, price] : [3, 0];
}

function sortRows(rows: readonly PickerRow[], sort: ModelSort): readonly PickerRow[] {
  if (sort === "context") return [...rows].sort((a, b) => (b.context ?? 0) - (a.context ?? 0));
  if (sort === "price")
    return [...rows].sort((a, b) => {
      const [ra, pa] = priceKey(a);
      const [rb, pb] = priceKey(b);
      return ra - rb || pa - pb;
    });
  return rows;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error ?? ""));

export function ConnectionModelPicker({
  connection,
  showConnectionName = false,
  autoFocusSearch = false,
  onPicked,
  applyPick,
  onChoose,
  accountName,
  footer,
  className,
  recommended,
  addMode = false,
  onUnstar,
  addedIds,
  mainModelId,
}: {
  connection: ModelPickerConnection;
  /** Name the connection beside its provider, where the connection list is out of sight. */
  showConnectionName?: boolean;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  onPicked?: (modelId: string) => void;
  /**
   * Add model: a pick finds or saves the Model for that id under the Connection, then hands its id here.
   * Without it (and without `onChoose`) a pick edits `connection` in place.
   */
  applyPick?: (connectionId: string, modelId: string) => Promise<void>;
  /** Per-chat pick (decision 26): hands the model with its catalog limits to the host; nothing is saved. */
  onChoose?: (choice: ChatModelChoice) => Promise<void>;
  /** The Connection's name, shown in the header with `applyPick` or `onChoose`. */
  accountName?: string | null;
  /** Replaces the footer line, for hosts where a pick does not touch a chat; null hides it (the host shows one). */
  footer?: string | null;
  className?: string;
  /** Good first picks shown above Favorites (Add connection, vendors with a known list). */
  recommended?: readonly PickerRow[];
  /**
   * The big Add model screen (decision 30/32): a pick also stars the model and a star adds it; rows show their
   * context size and group by upstream; the host's heading replaces the title row.
   */
  addMode?: boolean;
  /** Add mode: a star was taken off, so the host can stop counting it. The star hook removes the Model. */
  onUnstar?: (modelId: string) => void;
  /** Models already added in this session; they get the same check as the current model. */
  addedIds?: readonly string[];
  /** The model that became the Main model, marked with a badge. */
  mainModelId?: string | null;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [upstream, setUpstream] = useState<string | null>(null);
  const [costFilter, setCostFilter] = useState<CostFilter | null>(null);
  const [sort, setSort] = useState<ModelSort>("list");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const provider = (connection.provider ?? "") as APIProvider;
  const providerName = PROVIDERS[provider]?.name ?? connection.provider ?? "";
  const reviewRequired = isConnectionFlagTrue(connection.profileImportReviewRequired);
  const currentModel = connection.model?.trim() ?? "";
  const pinnedIds = useMemo(() => parsePinnedModels(connection.pinnedModels), [connection.pinnedModels]);

  const modelList = useConnectionModels(connection.id, !reviewRequired);
  const refresh = useRefreshConnectionModels();
  const setPinned = useSetConnectionModelPinned();
  const updateConnection = useUpdateConnection();
  const pickModel = usePickModel();
  const modelStar = useModelStar();
  const saving = updateConnection.isPending || pickModel.isPending;

  useEffect(() => {
    // A new connection starts with an empty search.
    setSearch("");
    setUpstream(null);
    setCostFilter(null);
    setSort("list");
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
  const fetchedAt = modelList.data?.fetchedAt;
  const updated = fetchedAt ? formatRelativeContact(fetchedAt) : null;
  const options = useMemo(
    () =>
      mergeConnectionModelOptions(
        remoteModels ?? [],
        remoteModels?.length || modelList.isLoading || provider === "custom" ? [] : (MODEL_LISTS[provider] ?? []),
      ),
    [modelList.isLoading, provider, remoteModels],
  );
  // "Paid" only says something where the catalog also has models in the plan (NanoGPT).
  const showCostBadges = useUIStore((s) => s.showCostBadges);
  const showPaid = useMemo(
    () => options.some((option) => option.cost === "included" || option.cost?.startsWith("multiplier:")),
    [options],
  );
  // Add mode explains the cost words its catalog uses, so a badge never needs a hover to read.
  const costLegend = showCostBadges
    ? (["included", "multiplier", "free", "paid"] as const)
        .filter((kind) =>
          options.some((option) =>
            kind === "multiplier"
              ? option.cost?.startsWith("multiplier:")
              : option.cost === kind && (kind !== "paid" || showPaid),
          ),
        )
        .map((kind) => t(`connections.cost.legend.${kind}`))
        .join(" · ")
    : "";
  const optionsById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const upstreams = useMemo(
    () =>
      subgroupByUpstream(options.map((row) => ({ model: row.id }))).flatMap((group) =>
        group.upstream ? [group.upstream] : [],
      ),
    [options],
  );
  useEffect(() => {
    if (upstream && !upstreams.includes(upstream)) setUpstream(null);
  }, [upstream, upstreams]);
  // Cost chips only where the list has more than one kind of cost to tell apart.
  const costKinds = useMemo(() => {
    const kinds = new Set(options.map(costKind));
    return (["free", "included", "paid"] as const).filter(
      (kind) => kinds.has(kind) && (kind !== "paid" || showPaid || kinds.has("free")),
    );
  }, [options, showPaid]);
  useEffect(() => {
    if (costFilter && !costKinds.includes(costFilter)) setCostFilter(null);
  }, [costFilter, costKinds]);
  const inFilter = (row: PickerRow) =>
    (!upstream || upstreamOf(row.id) === upstream) && (!costFilter || costKind(row) === costFilter);
  const filtering = !!upstream || !!costFilter;

  const { pinnedAll, othersAll, recommendedAll } = useMemo(() => {
    const pinnedSet = new Set(pinnedIds);
    const recommendedRows = (recommended ?? [])
      .filter((row) => !pinnedSet.has(row.id))
      .map((row) => optionsById.get(row.id) ?? row);
    const recommendedSet = new Set(recommendedRows.map((row) => row.id));
    // The current model stays visible even when the provider does not list it (a typed ID).
    const others: PickerRow[] =
      currentModel && !pinnedSet.has(currentModel) && !optionsById.has(currentModel)
        ? [{ id: currentModel, name: currentModel }]
        : [];
    for (const option of options) if (!pinnedSet.has(option.id) && !recommendedSet.has(option.id)) others.push(option);
    return {
      pinnedAll: pinnedIds.map((id): PickerRow => optionsById.get(id) ?? { id, name: id }),
      othersAll: others,
      recommendedAll: recommendedRows,
    };
  }, [currentModel, options, optionsById, pinnedIds, recommended]);

  const { recommendedRows, pinnedRows, otherRows, totalOther } = useMemo(() => {
    const filteredOthers = sortRows(filterConnectionModelOptions(othersAll.filter(inFilter), deferredSearch), sort);
    return {
      recommendedRows: filterConnectionModelOptions(recommendedAll.filter(inFilter), deferredSearch),
      pinnedRows: filterConnectionModelOptions(pinnedAll.filter(inFilter), deferredSearch),
      otherRows: filteredOthers.slice(0, MAX_LISTED_MODELS),
      totalOther: filteredOthers.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inFilter reads only upstream and costFilter
  }, [costFilter, deferredSearch, othersAll, pinnedAll, recommendedAll, sort, upstream]);

  // What Enter does with the search text: an exact ID or name picks that model, a search with a single match
  // picks it, and only text that matches nothing is used as a model ID. Several matches wait for a choice.
  const typedId = search.trim();
  const { exactId, enterTarget, enterUsesTyped } = useMemo(() => {
    const typed = typedId.toLowerCase();
    if (!typed) return { exactId: null, enterTarget: null, enterUsesTyped: false };
    const allRows = [...recommendedAll, ...pinnedAll, ...othersAll];
    const rows = allRows.filter(inFilter);
    const byId = allRows.find((row) => row.id.toLowerCase() === typed) ?? null;
    const byName = rows.filter((row) => row.name.toLowerCase() === typed);
    const matches = filterConnectionModelOptions(rows, typedId);
    const target: PickerRow | null =
      (byId && inFilter(byId) ? byId : null) ??
      (byName.length === 1 ? byName[0]! : null) ??
      (matches.length === 1 ? matches[0]! : null) ??
      (matches.length === 0 && !filtering ? { id: typedId, name: typedId } : null);
    return { exactId: byId, enterTarget: target, enterUsesTyped: matches.length === 0 && !filtering };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inFilter reads only upstream and costFilter
  }, [costFilter, othersAll, pinnedAll, recommendedAll, typedId, upstream]);
  // The typed text can always be used as it is from its own row; Enter uses it only when nothing matches.
  const showTypedRow = !!typedId && (!exactId || (filtering && !inFilter(exactId)));

  // Add mode: what is picked is starred, so it stays in the Connection (decision 30).
  const starPicked = (row: PickerRow) => {
    if (!addMode || pinnedIds.includes(row.id)) return;
    setPinned.mutate(
      { id: connection.id, model: row.id, pinned: true },
      { onError: (error) => toast.error(t("connections.favorite.failed", { error: errorMessage(error) })) },
    );
  };

  const pick = async (row: PickerRow, viaStar = false) => {
    if (saving) return;
    try {
      // In add mode a star adds the model even where a tap only chooses it for the chat.
      if (onChoose && !viaStar) {
        const fields = connectionFieldsForModelPick(provider, row);
        await onChoose({
          connectionId: connection.id,
          ...fields,
          ...(row.name && row.name !== row.id ? { name: row.name } : {}),
        });
        setSearch("");
        onPicked?.(row.id);
        return;
      }
      if (applyPick && connection.accountId) {
        // A new Model takes the listed context size and output limit, as an in-place pick does.
        const { connectionId } = await pickModel.mutateAsync({
          accountId: connection.accountId,
          ...connectionFieldsForModelPick(provider, row),
          name: row.name || undefined,
        });
        await applyPick(connectionId, row.id);
        starPicked(row);
        setSearch("");
        onPicked?.(row.id);
        return;
      }
      if (row.id !== currentModel) {
        await updateConnection.mutateAsync({
          id: connection.id,
          ...connectionFieldsForModelPick(provider, row),
          // A new account's empty placeholder is named for its service; the first Model takes its catalog name.
          ...(addMode && !currentModel ? { name: row.name || row.id } : {}),
        });
      }
      if (applyPick) await applyPick(connection.id, row.id);
      starPicked(row);
      setSearch("");
      onPicked?.(row.id);
    } catch (error) {
      toast.error(t("connections.modelPicker.saveFailed", { error: errorMessage(error) }));
    }
  };

  // The star (decision 30): a star saves the model; taking it off removes the saved Model unless something keeps it.
  const toggleStar = (row: PickerRow, starred: boolean) => {
    // Add mode: a star is a pick, so the host counts it (and the first one can become Main).
    if (addMode && starred) return void pick(row, true);
    if (addMode) onUnstar?.(row.id);
    if (!connection.accountId) {
      setPinned.mutate(
        { id: connection.id, model: row.id, pinned: starred },
        { onError: (error) => toast.error(t("connections.favorite.failed", { error: errorMessage(error) })) },
      );
      return;
    }
    const target = {
      accountId: connection.accountId,
      ...connectionFieldsForModelPick(provider, row),
      ...(row.name && row.name !== row.id ? { name: row.name } : {}),
      anchorId: connection.id,
    };
    void (starred ? modelStar.star(target) : modelStar.unstar(target));
  };

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

  const renderRow = (row: PickerRow, pinned: boolean, section = pinned ? "favorites" : "all") => {
    const current = row.id === currentModel || !!addedIds?.includes(row.id);
    // Adding: a model added here shows a filled star, even before its favorite is saved.
    const starred = pinned || (addMode && !onChoose && !!addedIds?.includes(row.id));
    const label = row.name || row.id;
    const reasoning = row.capabilities?.adaptiveThinking || !!row.capabilities?.effortLevels?.length;
    const meta = [
      row.context ? t("connections.add.context", { size: formatCompactTokenCount(row.context) }) : null,
      row.maxOutput ? t("connections.modelPicker.maxOutput", { size: formatCompactTokenCount(row.maxOutput) }) : null,
      reasoning ? t("connections.modelPicker.reasoning") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    // Adding: the end button says "Added" (a check), never ★ or "favorite"; one word for one thing.
    const adding = addMode && !!connection.accountId;
    // A badge on a narrow row leaves the id no room: the facts move to the tooltip there.
    const badged = showCostBadges && !!row.cost && (row.cost !== "paid" || showPaid);
    // The one model row; its end holds the 44px star beside the row button, never inside it.
    return (
      <ModelRow
        key={`${section}:${row.id}`}
        rowProps={{ "data-model-row": true, "data-model-id": row.id, className: "rounded-lg" }}
        data-model-option
        aria-current={current ? "true" : undefined}
        disabled={saving}
        onClick={() => void pick(row)}
        className="rounded-lg disabled:cursor-wait"
        tile={
          <ProviderIcon provider={provider || "custom"} model={row.id} name={connection.name ?? undefined} size="row" />
        }
        title={label}
        tooltip={[label, row.id, meta].filter(Boolean).join("\n")}
        subtitle={row.id}
        roles={row.id === mainModelId ? [t("connections.add.mainBadge")] : []}
        details={
          meta && (
            <span data-model-metadata className={cn("min-w-0 shrink truncate", badged && "max-sm:hidden")}>
              {meta}
            </span>
          )
        }
        cost={row.cost}
        showPaid={showPaid}
        retiring={row.deprecated || row.retiresAt ? row : null}
        current={current}
        trailing={
          // Adding: the filled star is the one sign that a model is in the connection.
          current &&
          !(addMode && !onChoose) && (
            <Check
              size="0.875rem"
              className="mari-panel-gradient--connections shrink-0 text-[var(--mari-connection-ink)]"
              aria-label={t("connections.modelPicker.current")}
            />
          )
        }
        end={
          <>
            {/* A Model outside a Connection has nowhere to save a favorite; an old star there can still be removed. */}
            {adding ? (
              <button
                type="button"
                data-model-star
                aria-pressed={starred}
                aria-label={t("connections.modelPicker.addToggle", { model: label })}
                title={t(starred ? "connections.modelPicker.removeAdded" : "connections.modelPicker.addToggle", {
                  model: label,
                })}
                onClick={() => toggleStar(row, !starred)}
                className={cn(
                  "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[0.6875rem] font-medium outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25",
                  starred
                    ? "mari-panel-gradient--connections text-[var(--mari-connection-ink)]"
                    : "text-foreground/45 hover:text-foreground/80",
                )}
              >
                {starred ? <Check size="0.875rem" aria-hidden /> : <Plus size="0.875rem" aria-hidden />}
                {starred && <span>{t("connections.modelPicker.added")}</span>}
              </button>
            ) : (
              (connection.accountId || starred) && (
                <button
                  type="button"
                  data-model-star
                  aria-pressed={starred}
                  // A toggle keeps one name; aria-pressed says whether it is a favorite.
                  aria-label={t("connections.favorite.toggle", { model: label })}
                  title={t(starred ? "connections.favorite.remove" : "connections.favorite.add", { model: label })}
                  onClick={() => toggleStar(row, !starred)}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25",
                    starred
                      ? "mari-panel-gradient--connections text-[var(--mari-connection-ink)]"
                      : "text-foreground/35 hover:text-foreground/70",
                  )}
                >
                  <Star size="0.875rem" fill={starred ? "currentColor" : "none"} />
                </button>
              )
            )}
          </>
        }
      />
    );
  };

  const sectionLabel = (label: string) => (
    <p className="px-3 pb-0.5 pt-2 text-[0.625rem] font-medium text-foreground/45">{label}</p>
  );

  return (
    <div data-connection-model-picker className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className={cn("flex min-w-0 items-center gap-2 px-3 pb-2 pt-2.5", addMode && "hidden")}>
        <span className="shrink-0 text-xs font-semibold">{t("connections.modelPicker.title")}</span>
        {(applyPick || onChoose) && accountName ? (
          <span data-model-picker-provider className="min-w-0 truncate text-[0.6875rem] text-foreground/55">
            {accountName}
          </span>
        ) : (
          (providerName || showConnectionName) && (
            <span data-model-picker-provider className="min-w-0 truncate text-[0.6875rem] text-foreground/55">
              {showConnectionName && connection.name && connection.name !== providerName
                ? t("connections.modelPicker.connectionAndProvider", {
                    connection: connection.name,
                    provider: providerName,
                  })
                : providerName}
            </span>
          )
        )}
      </div>

      {reviewRequired ? (
        <p className="px-3 pb-3 text-[0.6875rem] text-foreground/60">{t("connections.modelPicker.reviewFirst")}</p>
      ) : (
        <>
          {/* The Add window's step title sits at its header edge (px-5, px-4 on phones); the search lines up with it. */}
          <div className={cn("flex min-w-0 items-center gap-1.5 pb-1.5", addMode ? "px-5 max-md:px-4" : "px-3")}>
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border sm:min-h-9 border-foreground/10 bg-foreground/[0.04] px-2.5 text-foreground/55 focus-within:border-foreground/25 [@media(pointer:coarse)]:min-h-11">
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
              className="mari-connection-btn mari-connection-btn--icon"
            >
              <RefreshCw
                size="0.875rem"
                className={cn((refresh.isPending || modelList.isFetching) && "animate-spin")}
                aria-hidden
              />
            </button>
          </div>

          {addMode && updated && (
            <p data-model-updated className="px-5 pb-1.5 text-[0.625rem] text-foreground/50 max-md:px-4">
              {t("connections.modelPicker.updated", { when: updated })}
            </p>
          )}
          {addMode && costLegend && (
            <p data-model-cost-legend className="px-5 pb-1.5 text-[0.625rem] text-foreground/50 max-md:px-4">
              {costLegend}
            </p>
          )}

          {upstreams.length > 1 && (
            <div
              role="group"
              aria-label={t("connections.modelPicker.filterUpstream")}
              className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2"
            >
              {[null, ...upstreams].map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  data-model-upstream-filter={value ?? "all"}
                  aria-pressed={upstream === value}
                  onClick={() => setUpstream(value)}
                  className="mari-connection-chip mari-panel-gradient--connections gap-1"
                >
                  {value && <BrandMark of={value} className="h-3 w-3" />}
                  {value ? (knownPrefixName(value) ?? value) : t("connections.modelPicker.allUpstreams")}
                </button>
              ))}
            </div>
          )}

          {addMode && options.length > 1 && (
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-3 pb-2">
              {costKinds.length > 1 && (
                <div role="group" aria-label={t("connections.modelPicker.filterCost")} className="flex gap-1">
                  {costKinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      data-model-cost-filter={kind}
                      aria-pressed={costFilter === kind}
                      onClick={() => setCostFilter(costFilter === kind ? null : kind)}
                      className="mari-connection-chip mari-panel-gradient--connections"
                    >
                      {t(`connections.cost.${kind}`)}
                    </button>
                  ))}
                </div>
              )}
              <select
                data-model-sort
                aria-label={t("connections.modelPicker.sort")}
                value={sort}
                onChange={(event) => setSort(event.target.value as ModelSort)}
                className="ml-auto h-7 shrink-0 rounded-md bg-foreground/5 px-1.5 text-[0.6875rem] text-foreground/70 outline-none focus-visible:ring-1 focus-visible:ring-foreground/25"
              >
                <option value="list">{t("connections.modelPicker.sortList")}</option>
                <option value="price">{t("connections.modelPicker.sortPrice")}</option>
                <option value="context">{t("connections.modelPicker.sortContext")}</option>
              </select>
            </div>
          )}

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
                  onClick={() => void pick(exactId ?? { id: typedId, name: typedId })}
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

            {recommendedRows.length > 0 && (
              <section aria-label={t("connections.add.recommended")} data-model-section="recommended">
                {sectionLabel(t("connections.add.recommended"))}
                {recommendedRows.map((row) => renderRow(row, false, "recommended"))}
              </section>
            )}

            {pinnedRows.length > 0 && (
              <section
                aria-label={t(addMode ? "connections.modelPicker.added" : "connections.switcher.favourites")}
                data-model-section="favorites"
                className={cn(recommendedRows.length > 0 && "mt-2")}
              >
                {sectionLabel(t(addMode ? "connections.modelPicker.added" : "connections.switcher.favourites"))}
                {pinnedRows.map((row) => renderRow(row, true))}
              </section>
            )}

            {otherRows.length > 0 && (
              <section
                aria-label={t("connections.modelPicker.allModels")}
                data-model-section="all"
                className={cn((pinnedRows.length > 0 || recommendedRows.length > 0) && "mt-2")}
              >
                {sectionLabel(t("connections.modelPicker.allModels"))}
                {/* A sorted list stays in one run; maker groups would break the order. */}
                {(sort === "list"
                  ? subgroupByUpstream(otherRows.map((row) => ({ ...row, model: row.id })))
                  : [{ upstream: null, rows: otherRows }]
                ).map((group) => (
                  <div key={group.upstream ?? ""} data-model-upstream={group.upstream ?? undefined}>
                    {group.upstream && (
                      <p className="flex items-center gap-1.5 px-3 pb-0.5 pt-1.5 text-[0.625rem] text-foreground/40">
                        <BrandMark of={group.upstream} className="h-3 w-3" />
                        {knownPrefixName(group.upstream) ?? group.upstream}
                      </p>
                    )}
                    {group.rows.map((row) => renderRow(row, false))}
                  </div>
                ))}
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
              recommendedRows.length === 0 &&
              pinnedRows.length === 0 &&
              otherRows.length === 0 && (
                <p className="px-3 py-3 text-[0.6875rem] text-foreground/50">{t("connections.modelPicker.empty")}</p>
              )}
          </div>

          {footer !== null && (
            <p className="border-t border-foreground/10 px-3 py-2 text-[0.625rem] text-foreground/50">
              {footer ??
                t(
                  onChoose
                    ? "connections.switcher.appliesToChat"
                    : applyPick
                      ? "connections.accounts.addModelFooter"
                      : "connections.modelPicker.footer",
                )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
