// ──────────────────────────────────────────────
// Connection Switcher Body — the one model chooser shared by the chat's
// composer chip, the phone menu, Chat Settings, Professor Mari's composer and
// every job's Model picker. Now strip and search on top, then two panes:
// Starred and each account on the left, the selected one's models on the
// right. A narrow host shows one pane at a time. A pick applies to the host
// only; the star saves a model, and removing it can remove the saved Model
// (decision 30). Starred also lists this device's recent picks; an account's
// long list folds behind Browse and narrows by model family.
// ──────────────────────────────────────────────
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Dices,
  House,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  PROVIDERS,
  isChatProvider,
  type APIProvider,
  rankModelMatch,
  readChatModelOverride,
  readChatRecentModels,
  type ChatModelChoice,
  type ConnectionPickerKind,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import {
  connectionKeys,
  usageAtLimit,
  useCachedCatalogFacts,
  useConnections,
  useConnectionModels,
  useCountConnectionModels,
  useRefreshConnectionModels,
  useUpdateConnection,
  type CachedModelFacts,
  type SubscriptionUsage,
} from "../../hooks/use-connections";
import { catalogMatchesKind, matchesKind } from "../../lib/connection-jobs";
import { useChat, useSetChatModel } from "../../hooks/use-chats";
import {
  useCatalogSearch,
  useConnectionAccounts,
  usePickModel,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { useConnectionFolders } from "../../hooks/use-connection-folders";
import {
  filterLanguageGenerationConnections,
  isConnectionFlagTrue,
  resolveUsageConnection,
} from "../../lib/connection-filters";
import {
  accountStateLabel,
  groupModelsByAccount,
  orderAccountGroups,
  roleBadges,
  viaName,
} from "../../lib/connection-groups";
import { cn } from "../../lib/utils";
import { modelBrand, ProviderIcon } from "./ProviderIcon";
import { ServiceRow } from "./ServiceRow";
import { PanelVirtualList } from "../panels/PanelVirtualList";
import { sortPanelFolders } from "../../lib/panel-sort";
import type { ConnectionModelRow } from "../../lib/connection-groups";
import { modelRoleLabels } from "./ModelRow";
import { ListFrame, ListHeading, ListStatus } from "./ListFrame";
import { SearchInput } from "../ui/SearchInput";
import { ModelRow, ModelTile } from "./ModelRow";
import { openAddConnection } from "../../lib/add-connection";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import { ModelFamilyChips } from "./ModelFamilyChips";
import { familyChipsFor, modelFamilyOf, type ModelFamily } from "../../lib/model-families";
import { reorderStars, starAnchorOf, starsOfRows, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";
import { useVoiceRowId } from "../../hooks/use-tts";

type SwitcherRow = {
  id: string;
  folderId?: string | null;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
  accountId?: string | null;
  credentialsFromConnectionId?: string | null;
  pinnedModels?: unknown;
  createdAt?: string | null;
  sortOrder?: number;
  useForRandom?: boolean | string | null;
  isDefault?: boolean | string | null;
  defaultForAgents?: unknown;
  fallbackForMain?: unknown;
  fallbackForAgents?: unknown;
  /** The Model has settings of its own (context size, sampling…), so it stays when unstarred. */
  ownSettings?: boolean;
  showUsageWidget?: unknown;
  showUsageFiveHour?: unknown;
  showUsageWeekly?: unknown;
  profileImportReviewRequired?: unknown;
  icon?: string | null;
  imagePath?: string | null;
};

/** A Connection as the list shows it: an account with its chat Models, or a standalone Model on its own. */
type SwitcherGroup = { key: string; account: ConnectionAccountListItem | null; name: string; rows: SwitcherRow[] };

/**
 * A pickable line: a saved Model, or a catalog model run on one of the Connection's Models (decision 26).
 * `group` and `model` give the line its maker icon, star and state; `row` (a saved Model) its role badges.
 */
type Entry = {
  key: string;
  title: string;
  subtitle?: string;
  choice: ChatModelChoice;
  group?: SwitcherGroup;
  model?: string;
  row?: SwitcherRow;
};

/** A long run of model lines draws only the rows in view; a short one renders in full. */
const VIRTUAL_MIN = 60;
/** An account's other models fold behind Browse from this many on, when the pane has models of yours above them. */
const BROWSE_MIN = 20;
/** How many recent picks the Starred pane lists. */
const RECENT_SHOWN = 5;
function EntryRows({
  listKey,
  entries,
  render,
  scrollToIndex,
}: {
  listKey: string;
  entries: readonly Entry[];
  render: (entry: Entry) => ReactNode;
  scrollToIndex?: number;
}) {
  if (entries.length < VIRTUAL_MIN) return <>{entries.map(render)}</>;
  return (
    <PanelVirtualList
      asList={false}
      listKey={`connection-switcher:${listKey}`}
      count={entries.length}
      getItemKey={(index) => entries[index]!.key}
      renderRow={(index) => render(entries[index]!)}
      estimateSize={window.matchMedia?.("(min-width: 768px)").matches ? 64 : 47}
      scrollToIndex={scrollToIndex}
    />
  );
}

/** A model id under a Connection: its saved Model when there is one, otherwise a per-chat pick on `anchor`. */
function entryFor(group: SwitcherGroup, anchor: SwitcherRow, model: string, title?: string): Entry {
  const saved = group.rows.find((row) => row.model === model);
  return saved
    ? {
        key: saved.id,
        title: rowLabel(saved),
        subtitle: model,
        choice: { connectionId: saved.id },
        group,
        model,
        row: saved,
      }
    : {
        key: `${group.key}:${model}`,
        title: title || model,
        subtitle: model,
        choice: { connectionId: anchor.id, model, ...(title && title !== model ? { name: title } : {}) },
        group,
        model,
      };
}

/** A saved Model's line; a catalog pick on it (`choice.model`) is a different model, so it gets no role badges. */
function entryOfRow(row: SwitcherRow, group: SwitcherGroup | undefined, choice?: ChatModelChoice): Entry {
  const model = choice?.model ?? row.model ?? undefined;
  return {
    key: `${row.id}:${choice?.model ?? ""}`,
    title: choice?.model ? (choice.name ?? choice.model) : rowLabel(row),
    subtitle: group?.account ? group.name : (row.model ?? undefined),
    choice: choice ?? { connectionId: row.id },
    group,
    model,
    row: choice?.model ? undefined : row,
  };
}

const unavailableOf = (group: SwitcherGroup | undefined) =>
  group?.account && group.account.state !== "ok" ? group.account.state : null;

/** A Model's own address on its Connection's server, if it has one (its model list is that path's). */
const ownAddressOf = (row: SwitcherRow) => !!(row as { modelBaseUrl?: string | null }).modelBaseUrl?.trim();

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error ?? ""));
const rowLabel = (row: SwitcherRow) => row.name || row.model || row.id;
const sameChoice = (a: ChatModelChoice | null | undefined, b: ChatModelChoice | null | undefined) =>
  !!a && !!b && a.connectionId === b.connectionId && (a.model ?? "") === (b.model ?? "");
/** The account and model id a choice runs, so a saved Model and the same catalog pick count as one. */
const runsKey = (choice: ChatModelChoice, rows: readonly SwitcherRow[]) => {
  const row = rows.find((candidate) => candidate.id === choice.connectionId);
  return `${row?.accountId ?? choice.connectionId}\n${choice.model ?? row?.model ?? ""}`;
};

export const ROW_CLASS =
  "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-wait max-md:min-h-11 [@media(pointer:coarse)]:min-h-11";

/** The accent bar at the left edge of the selected pane and the current model. */
const ACCENT_BAR =
  "before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--marinara-chat-chrome-accent)] before:content-['']";

/**
 * The chat hosts' pick (decision 26): a saved Model or a catalog model for this chat only. The pick never edits a
 * saved Model; the toast offers Undo and "Make it my Main model", which saves a catalog pick to the library first.
 */
export function useChatModelPick(chatId: string | null) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: chat } = useChat(chatId);
  const setChatModel = useSetChatModel();
  const updateConnection = useUpdateConnection();
  const pickModel = usePickModel();
  const current = useMemo<ChatModelChoice | null>(
    () => (chat?.connectionId ? (readChatModelOverride(chat) ?? { connectionId: chat.connectionId }) : null),
    [chat],
  );
  const recent = useMemo(() => (chat ? readChatRecentModels(chat) : []), [chat]);
  const apply = useCallback(
    async (choice: ChatModelChoice) => {
      if (!chatId) return;
      const previous = current;
      const updated = await setChatModel.mutateAsync({ chatId, ...choice });
      if (!updated?.connectionId || updated.connectionId === LOCAL_SIDECAR_CONNECTION_ID) return;
      // The server may have mapped a catalog pick to a saved Model, so read what the chat uses now.
      const applied: ChatModelChoice = readChatModelOverride(updated) ?? { connectionId: updated.connectionId };
      // Read the cache now: a Model saved a moment ago is not in any earlier render's list.
      const rows = (qc.getQueryData(connectionKeys.list()) as SwitcherRow[] | undefined) ?? [];
      const row = rows.find((candidate) => candidate.id === applied.connectionId);
      // Starring the chat's pick saves it and keeps the same model: no toast.
      if (!row || (previous && runsKey(previous, rows) === runsKey(applied, rows))) return;
      const model = applied.model ? (applied.name ?? applied.model) : rowLabel(row);
      const makeMain = async () => {
        let id = row.id;
        if (applied.model) {
          if (!row.accountId) return;
          id = (
            await pickModel.mutateAsync({
              accountId: row.accountId,
              model: applied.model,
              name: applied.name,
              maxContext: applied.maxContext,
              maxTokensOverride: applied.maxTokensOverride,
            })
          ).connectionId;
          await setChatModel.mutateAsync({ chatId, connectionId: id });
        }
        await updateConnection.mutateAsync({ id, isDefault: true });
        toast.success(t("connections.switcher.madeDefault", { model }));
      };
      const canMakeMain = applied.model ? !!row.accountId : !isConnectionFlagTrue(row.isDefault);
      toast.success(t("connections.switcher.picked", { model }), {
        ...(previous
          ? {
              cancel: {
                label: t("connections.switcher.undo"),
                onClick: () =>
                  void setChatModel
                    .mutateAsync({ chatId, ...previous })
                    .catch((error) =>
                      toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) })),
                    ),
              },
            }
          : {}),
        ...(canMakeMain
          ? {
              action: {
                label: t("connections.switcher.makeMain"),
                onClick: () =>
                  void makeMain().catch((error) =>
                    toast.error(t("connections.switcher.defaultFailed", { error: errorMessage(error) })),
                  ),
              },
            }
          : {}),
      });
    },
    [chatId, current, pickModel, qc, setChatModel, t, updateConnection],
  );
  // "Use default" (decision 27): the chat drops its own pick and follows the Main model again.
  const followsMain = !!chat && !chat.connectionId;
  const useDefault = useCallback(async () => {
    if (!chatId) return;
    const previous = current;
    // A failure throws to the caller, which reports it and keeps its menu open.
    await setChatModel.mutateAsync({ chatId, connectionId: null });
    toast.success(t("connections.switcher.followingDefault"), {
      ...(previous
        ? {
            cancel: {
              label: t("connections.switcher.undo"),
              onClick: () =>
                void setChatModel
                  .mutateAsync({ chatId, ...previous })
                  .catch((error) => toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) }))),
            },
          }
        : {}),
    });
  }, [chatId, current, setChatModel, t]);
  return { current, recent, apply, followsMain, useDefault };
}

/** What a chat runs now, for the composer chip and the Chat Settings field: its pick, or the Main model it follows. */
export type EffectiveChatModel = {
  kind: "model" | "random" | "local" | "none";
  title: string;
  model?: string | null;
  provider?: string | null;
  baseUrl?: string | null;
  /** The Connection the model runs on. */
  connectionName?: string;
  followsMain: boolean;
  /** The Connection needs a key or is off: the chat cannot run this model until it is fixed. */
  unavailable: ConnectionAccountListItem["state"] | null;
  /** The saved Model's picture (none for a chat's own model override). */
  icon?: string | null;
  imagePath?: string | null;
};

export function useEffectiveChatModel(chatId: string | null): EffectiveChatModel | null {
  const { t } = useTranslation();
  const { data: chat } = useChat(chatId);
  const { data: connections } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const localName = useSidecarStore((state) => state.modelDisplayName);
  return useMemo(() => {
    if (!chat) return null;
    const connectionId = chat.connectionId ?? null;
    const followsMain = !connectionId;
    if (connectionId === "random") {
      return { kind: "random", title: t("connections.switcher.shuffle"), followsMain, unavailable: null };
    }
    if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
      return {
        kind: "local",
        title: localName || t("connections.switcher.localModel"),
        followsMain,
        unavailable: null,
      };
    }
    const rows = (connections ?? []) as SwitcherRow[];
    const row = followsMain
      ? rows.find((candidate) => isConnectionFlagTrue(candidate.isDefault))
      : rows.find((candidate) => candidate.id === connectionId);
    if (!row) return { kind: "none", title: "", followsMain, unavailable: null };
    // A Model that borrows credentials runs on its lender's Connection.
    const lender = row.credentialsFromConnectionId
      ? rows.find((candidate) => candidate.id === row.credentialsFromConnectionId)
      : undefined;
    const account = accounts?.find((candidate) => candidate.id === (lender ?? row).accountId);
    const override = followsMain ? null : readChatModelOverride(chat);
    return {
      kind: "model",
      title: override ? (override.name ?? override.model) : rowLabel(row),
      model: override?.model ?? row.model,
      provider: account?.provider ?? row.provider,
      baseUrl: account?.baseUrl,
      connectionName: account?.name ?? rowLabel(row),
      followsMain,
      unavailable: account && account.state !== "ok" ? account.state : null,
      icon: override ? null : row.icon,
      imagePath: override ? null : row.imagePath,
    };
  }, [accounts, chat, connections, localName, t]);
}

/** The effective model's tile: its maker's icon, Shuffle, the Local Model, or Follow Main when nothing is set. */
export function EffectiveModelIcon({
  effective,
  size = "sm",
  className,
}: {
  effective: EffectiveChatModel | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (effective?.kind === "model" || effective?.kind === "local") {
    return (
      <ProviderIcon
        provider={effective.kind === "local" ? "local_model" : (effective.provider ?? "custom")}
        baseUrl={effective.baseUrl}
        model={effective.model}
        name={effective.connectionName}
        icon={effective.icon}
        imagePath={effective.imagePath}
        size={size}
        dim={!!effective.unavailable}
        className={className}
      />
    );
  }
  const Icon = effective?.kind === "random" ? Shuffle : House;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-foreground/60",
        size === "sm" ? "h-6 w-6" : "h-9 w-9 rounded-xl",
        className,
      )}
    >
      <Icon size={size === "sm" ? "0.75rem" : "1rem"} />
    </span>
  );
}

export function ConnectionSwitcherBody({
  current,
  onApply,
  onDone,
  showLocalModel,
  localModelHint,
  shuffle,
  followDefault,
  listHeader,
  listFooter,
  empty,
  autoFocusSearch = false,
  className,
  listClassName,
  catalogBrowse = true,
  showUnstarred = false,
  kind = "chat",
  rowFilter,
  extras,
  onAdd,
  firstAccountId,
  ownRole,
  modelFilter,
  catalogFilter,
  accountFilter,
  catalogAnchor,
  knownGood,
  leadCatalog,
  rowState,
  confirmCurrent = false,
}: {
  /** The job this picker sets ("Agents"): rows leave that role pill out, since the title names it. */
  ownRole?: string;
  /** What the host uses: a Model, or a catalog model on one ("random" while Shuffle is on). */
  current: ChatModelChoice | null;
  /** Points the host (chat or Professor Mari) at the choice. */
  onApply: (choice: ChatModelChoice) => Promise<void | false>;
  /** Closes the host menu; every pick ends with it. */
  onDone: () => void;
  showLocalModel: boolean;
  localModelHint?: string;
  /**
   * The chat's random-pool mode; absent where there is none (Professor Mari, jobs). Without `onToggle` the host
   * shows the dice in its own header; with it the dice sits in the Now strip.
   */
  shuffle?: { active: boolean; onToggle?: () => void };
  /** Follow Main: the host follows the Main model; absent where there is no such state (Professor Mari). */
  followDefault?: {
    active: boolean;
    onSelect: () => Promise<void>;
    label?: string;
    /** The unset state is its own row, not the Main model. */ own?: boolean;
  };
  /** The slot's saved Model kind; without it the picker lists chat Models. */
  kind?: ConnectionPickerKind;
  /** Hides saved Models the slot cannot use (the current one stays). */
  rowFilter?: (row: ConnectionModelRow) => boolean;
  /** Plain values that are not Models, such as "random", listed under Follow. */
  extras?: ReadonlyArray<{
    value: string;
    label: string;
    /** Line 2: where the value lives, such as the account of a saved Model (#9317). */
    subtitle?: string;
    icon?: ReactNode;
    active: boolean;
    onSelect: () => Promise<void>;
  }>;
  /**
   * Catalog models of a kind the slot's own kind would drop, listed first in an account's list under `label`
   * (Decision: a provider's own decision models). The account's other models follow under `restLabel` (#9317).
   */
  leadCatalog?: {
    label: string;
    restLabel: string;
    test: (provider: string, model: string, facts: CachedModelFacts | undefined) => boolean;
    /** Providers whose list is only these models (Gemini: its chat models cannot answer the slot). */
    only?: (provider: string) => boolean;
  };
  /** Last row: adds a provider; the host reopens or keeps this picker. */
  onAdd?: () => void;
  /** Marks models known to suit the slot with a check and lists them first (Decision). */
  knownGood?: {
    label: string;
    test: (accountId: string, model: string, facts: CachedModelFacts | undefined) => boolean;
  };
  /**
   * A pick of what the host uses now still goes to the host (onApply, or followDefault.onSelect while it follows the
   * default), so a package's pickConnection can tell it from a close (CONNECTION_PICKER.md).
   */
  confirmCurrent?: boolean;
  /** A pick that is being tried or was turned down, shown on its row. */
  rowState?: (
    accountId: string,
    model: string,
  ) => { label: string; state: "off" | "needs_key"; detail?: string } | null;
  /** Lists only the catalog models this accepts (Embeddings); a provider with none is left out. */
  modelFilter?: (model: string) => boolean;
  /** Catalog-only filter; saved rows remain selectable by their own kind. */
  catalogFilter?: (model: string, facts: CachedModelFacts | undefined) => boolean;
  accountFilter?: (account: ConnectionAccountListItem) => boolean;
  /** Resolve the provider row whose catalog belongs to this job. */
  catalogAnchor?: (account: ConnectionAccountListItem, rows: readonly SwitcherRow[]) => SwitcherRow | undefined;
  /** A provider just added: its group comes first. */
  firstAccountId?: string | null;
  listHeader?: ReactNode;
  /** Below the list, inside its column. */
  listFooter?: ReactNode;
  /** Shown when there is nothing to pick. */
  empty?: ReactNode;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  className?: string;
  listClassName?: string;
  /** False skips catalog search and Browse (Quick Switcher's connection-only mode). */
  catalogBrowse?: boolean;
  /** Job pickers also list provider models below the stars in the initial pane. */
  showUnstarred?: boolean;
}) {
  const { t } = useTranslation();
  const voiceRowId = useVoiceRowId();
  const connectionsQuery = useConnections();
  const accountsQuery = useConnectionAccounts();
  const connectionsRaw = connectionsQuery.data;
  const accounts = accountsQuery.data;
  // A saved Model is listed under its account, so nothing is offered until both lists are in. Read without its
  // account, a Model would show as a pickable line of its own, whatever its account's state.
  const listsReady = connectionsRaw !== undefined && accounts !== undefined;
  const listsFailed = !listsReady && (connectionsQuery.isError || accountsQuery.isError);
  const openModal = useUIStore((state) => state.openModal);
  const openConnectionDetail = useUIStore((state) => state.openConnectionDetail);
  const recentPicks = useUIStore((state) => state.recentModelPicks);
  const rememberModelPick = useUIStore((state) => state.rememberModelPick);
  // The Connections panel's "Group by" choice applies here too.
  const sort = useUIStore((state) => state.connectionPanelSort);
  const accountManualOrder = useUIStore((state) => state.libraryManualOrders?.connection);
  const byFolder = useUIStore((state) => state.connectionsGroupBy) === "folder";
  const { data: folders } = useConnectionFolders();
  const updateConnection = useUpdateConnection();
  const updateAccount = useUpdateConnectionAccount();
  const modelStar = useModelStar();
  const hiddenIds = useHiddenModelIds();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [highlight, setHighlight] = useState(0);
  /** The left pane's choice: "starred", an account's group key or "folder:<id>"; null opens the default pane. */
  const [pane, setPane] = useState<string | null>(null);
  /** One-pane hosts (phone, Chat Settings) show the right pane; Back shows the account list. */
  const [drilled, setDrilled] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    if (!listsReady) return [];
    const all = connectionsRaw as SwitcherRow[];
    const ofKind =
      kind === "chat" ? filterLanguageGenerationConnections(all) : all.filter((row) => matchesKind(row, kind));
    return ofKind.filter(
      (row) => !hiddenIds.has(row.id) && (!rowFilter || row.id === current?.connectionId || rowFilter(row)),
    );
  }, [listsReady, connectionsRaw, hiddenIds, kind, rowFilter, current?.connectionId]);
  const groups = useMemo<SwitcherGroup[]>(() => {
    const { groups: byAccount, standalone } = groupModelsByAccount(rows, accounts ?? []);
    const allRows = (connectionsRaw ?? []) as SwitcherRow[];
    // The panel orders accounts by all their Models; the language filter only trims the rows shown.
    const accountRank = new Map(
      orderAccountGroups(
        groupModelsByAccount((connectionsRaw ?? []) as SwitcherRow[], accounts ?? []).groups,
        sort,
        accountManualOrder,
      ).map((group, index) => [group.account.id, index]),
    );
    return [
      // A provider with no saved model still lists its catalog; one with only image or voice Models has nothing to pick here.
      ...byAccount
        .filter((group) =>
          kind === "chat"
            ? rows.some((row) => row.accountId === group.account.id)
            : group.rows.length > 0 ||
              (catalogBrowse &&
                (!accountFilter || accountFilter(group.account)) &&
                !!(catalogAnchor
                  ? catalogAnchor(
                      group.account,
                      allRows.filter((row) => !hiddenIds.has(row.id)),
                    )
                  : allRows.find(
                      (row) =>
                        !hiddenIds.has(row.id) &&
                        row.accountId === group.account.id &&
                        row.provider &&
                        (kind === "decision" || kind === "all" || row.provider !== "decision"),
                    ))),
        )
        .sort((a, b) =>
          a.account.id === firstAccountId
            ? -1
            : b.account.id === firstAccountId
              ? 1
              : (accountRank.get(a.account.id) ?? Infinity) - (accountRank.get(b.account.id) ?? Infinity),
        )
        .map((group) => ({
          key: group.account.id,
          account: group.account,
          name: group.account.name,
          rows: group.rows,
        })),
      ...standalone
        .map((row) => ({ key: row.id, account: null, name: rowLabel(row), rows: [row] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [
    accountManualOrder,
    accounts,
    connectionsRaw,
    rows,
    sort,
    firstAccountId,
    kind,
    catalogBrowse,
    accountFilter,
    catalogAnchor,
    hiddenIds,
  ]);
  const groupOfRow = useMemo(() => {
    const map = new Map<string, SwitcherGroup>();
    for (const group of groups) for (const row of group.rows) map.set(row.id, group);
    return map;
  }, [groups]);
  const groupByAccount = useMemo(
    () => new Map(groups.filter((group) => group.account).map((group) => [group.account!.id, group])),
    [groups],
  );

  // Cost badges from the catalogs already cached for each Connection; nothing is fetched for them.
  const catalogAnchors = groups.map((group) =>
    group.account
      ? catalogAnchor
        ? catalogAnchor(
            group.account,
            ((connectionsRaw ?? []) as SwitcherRow[]).filter((row) => !hiddenIds.has(row.id)),
          )?.id
        : (connectionsRaw as SwitcherRow[] | undefined)?.find(
            (row) =>
              !hiddenIds.has(row.id) &&
              row.accountId === group.account!.id &&
              // A Model with its own address lists another path's models, not the Connection's.
              !ownAddressOf(row) &&
              row.provider &&
              (kind === "chat"
                ? isChatProvider(row.provider)
                : kind === "decision" || kind === "all" || row.provider !== "decision"),
          )?.id
      : group.rows[0]?.id,
  );
  const catalogs = useCachedCatalogFacts(
    catalogBrowse
      ? groups.map((group, index) => [
          ...(catalogAnchors[index] ? [catalogAnchors[index]!] : []),
          ...group.rows.filter((row) => !group.account || !ownAddressOf(row)).map((row) => row.id),
        ])
      : [],
  );
  const catalogOf = (group: SwitcherGroup | undefined) => (group ? catalogs[groups.indexOf(group)] : undefined);

  const mainRow = rows.find((row) => isConnectionFlagTrue(row.isDefault));
  const currentId = current?.connectionId ?? null;
  const currentRow = currentId ? rows.find((row) => row.id === currentId) : undefined;
  const nowRow = currentRow ?? (followDefault?.active && !followDefault.own ? mainRow : undefined);
  const currentGroup = nowRow ? groupOfRow.get(nowRow.id) : undefined;
  // A catalog pick runs on the Model the chat already uses when it is in that Connection, else on its first one.
  const anchorOf = useCallback(
    (group: SwitcherGroup) =>
      group.rows.find((row) => row.id === nowRow?.id) ??
      (kind === "chat" ? group.rows[0] : undefined) ??
      (group.account && catalogAnchor?.(group.account, (connectionsRaw ?? []) as SwitcherRow[])) ??
      // An account with no saved model still has its hidden catalog row.
      (((connectionsRaw as SwitcherRow[] | undefined)?.find(
        (row) =>
          row.accountId === group.account?.id && row.provider && (kind === "chat" || row.provider !== "decision"),
      ) ?? group.rows[0]) as SwitcherRow),
    [nowRow?.id, rows, connectionsRaw, kind, catalogAnchor],
  );

  // The search box shows once both lists are in, so it is focused then, not on the first frame.
  useEffect(() => {
    if (!listsReady || !autoFocusSearch || !window.matchMedia?.("(pointer: fine)").matches) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusSearch, listsReady]);

  const apply = async (entry: Entry) => {
    if (busy) return;
    if (entry.group && unavailableOf(entry.group)) return fix(entry.group);
    setBusy(true);
    try {
      const keeps = isNow(entry) || sameChoice(entry.choice, current);
      let applied: void | false = undefined;
      if (!keeps || (confirmCurrent && current)) applied = await onApply(entry.choice);
      // While the host follows its default, the current value is that default.
      else if (confirmCurrent) await followDefault?.onSelect();
      if (applied === false) return;
      // Every host's pick of an account model feeds the Starred pane's Recent list on this device.
      if (entry.group?.account && entry.model) {
        rememberModelPick({ accountId: entry.group.account.id, model: entry.model });
      }
      if (entry.choice.connectionId === LOCAL_SIDECAR_CONNECTION_ID && !useSidecarStore.getState().modelDownloaded) {
        openAddConnection({ category: "device", item: "local-model" });
      }
      onDone();
    } catch (error) {
      toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  };

  // A Connection that needs a key or is off cannot run a pick: its lines lead to the fix instead.
  const fixLabel = (group: SwitcherGroup) =>
    t(group.account?.state === "off" ? "connections.defaults.fix.turnOn" : "connections.defaults.fix.addKey");
  const fix = (group: SwitcherGroup) => {
    const account = group.account;
    if (!account) return;
    if (account.state === "off") {
      updateAccount.mutate(
        { id: account.id, enabled: true },
        { onError: (error) => toast.error(t("connections.switcher.fixFailed", { error: errorMessage(error) })) },
      );
      return;
    }
    onDone();
    openModal("connection-account", { accountId: account.id });
  };
  const fixButton = (group: SwitcherGroup) => (
    <button
      type="button"
      data-switcher-fix={group.key}
      onClick={() => fix(group)}
      aria-label={t(
        group.account?.state === "off" ? "connections.switcher.fixTurnOn" : "connections.switcher.fixAddKey",
        { connection: group.name },
      )}
      className="mari-chrome-control shrink-0 whitespace-nowrap px-3 text-xs"
    >
      {fixLabel(group)}
    </button>
  );

  // The star (decision 30): starring saves the model when it is not saved yet (and points the chat at the saved
  // Model when it was the chat's catalog pick). Unstarring removes the saved Model unless something keeps it.
  const toggleStar = async (group: SwitcherGroup, model: string, starred: boolean, name?: string) => {
    if (busy || !group.account) return;
    setBusy(true);
    try {
      const pick = current?.model === model && groupOfRow.get(current.connectionId) === group ? current : null;
      const target = {
        accountId: group.account.id,
        model,
        name: pick?.name ?? name,
        maxContext: pick?.maxContext,
        maxTokensOverride: pick?.maxTokensOverride,
        anchorId: (starAnchorOf(group.rows) ?? anchorOf(group)).id,
      };
      if (starred) {
        await modelStar.unstar(target);
        return;
      }
      const connectionId = await modelStar.star(target);
      if (pick && connectionId) await onApply({ connectionId });
    } catch (error) {
      toast.error(t("connections.star.failed", { error: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  };
  const starsOf = (group: SwitcherGroup) => starsOfRows(group.rows);
  // Edit order: the Starred order is the anchor's pinnedModels order, so a move rewrites that list.
  const [editOrder, setEditOrder] = useState(false);
  const moveStar = (group: SwitcherGroup, model: string, by: -1 | 1) => {
    const next = reorderStars([...starsOf(group)], model, by);
    if (next) updateConnection.mutate({ id: anchorOf(group).id, pinnedModels: next });
  };
  const iconButtonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/50 outline-none transition-[color,background-color,opacity] hover:bg-foreground/10 hover:text-foreground/80 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:opacity-30 disabled:hover:bg-transparent";
  const orderButtons = (group: SwitcherGroup, model: string, title: string) => {
    const stars = [...starsOf(group)];
    const at = stars.indexOf(model);
    return (
      <>
        <button
          type="button"
          className={iconButtonClass}
          disabled={at <= 0 || updateConnection.isPending}
          aria-label={t("connections.switcher.moveUp", { model: title })}
          title={t("connections.switcher.moveUp", { model: title })}
          onClick={() => moveStar(group, model, -1)}
        >
          <ArrowUp size="0.875rem" aria-hidden />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          disabled={at < 0 || at >= stars.length - 1 || updateConnection.isPending}
          aria-label={t("connections.switcher.moveDown", { model: title })}
          title={t("connections.switcher.moveDown", { model: title })}
          onClick={() => moveStar(group, model, 1)}
        >
          <ArrowDown size="0.875rem" aria-hidden />
        </button>
      </>
    );
  };
  const orderToggle = (
    <button
      type="button"
      data-switcher-edit-order
      aria-pressed={editOrder}
      className="mb-1 ml-auto flex min-h-11 items-center rounded-lg px-3 text-xs text-foreground/50 outline-none hover:bg-foreground/10 hover:text-foreground/80 focus-visible:ring-1 focus-visible:ring-foreground/25"
      onClick={() => setEditOrder((on) => !on)}
    >
      {t(editOrder ? "connections.switcher.doneOrder" : "connections.switcher.editOrder")}
    </button>
  );
  const starButton = (group: SwitcherGroup, model: string, title: string, starred: boolean) =>
    group.account ? (
      <button
        type="button"
        data-switcher-star={model}
        disabled={busy}
        aria-pressed={starred}
        // A toggle keeps one name; aria-pressed says whether it is starred.
        aria-label={t("connections.star.toggle", { model: title })}
        title={t(starred ? "connections.star.remove" : "connections.star.add", { model: title })}
        onClick={() => void toggleStar(group, model, starred, title)}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25",
          starred
            ? "text-[var(--marinara-chat-chrome-accent)]"
            : // Calm rows: an unstarred star shows on hover or focus; touch screens always show it.
              "text-foreground/35 opacity-0 hover:text-foreground/70 focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100",
        )}
      >
        <Star size="0.875rem" fill={starred ? "currentColor" : "none"} aria-hidden />
      </button>
    ) : null;

  // Now: what the host runs, or the Main model it follows. Pressing it keeps that state.
  const builtInReady = useSidecarStore((state) => state.modelDownloaded);
  const localEntry: Entry = {
    key: LOCAL_SIDECAR_CONNECTION_ID,
    title: t("connections.switcher.localModel"),
    subtitle: localModelHint ?? (builtInReady ? undefined : t("connections.builtin.notDownloadedSetUp")),
    choice: { connectionId: LOCAL_SIDECAR_CONNECTION_ID },
  };
  const nowEntry: Entry | null =
    currentId === LOCAL_SIDECAR_CONNECTION_ID
      ? localEntry
      : currentRow && current
        ? entryOfRow(currentRow, currentGroup, current.model ? current : undefined)
        : followDefault?.active && !followDefault.own && mainRow
          ? entryOfRow(mainRow, groupOfRow.get(mainRow.id))
          : null;
  const nowRuns = nowEntry && nowEntry !== localEntry ? runsKey(nowEntry.choice, rows) : null;
  // Catalog choices name a model on an anchor row. Saved Models keep their own identity and tuning,
  // even when another saved Model under the same Connection has the same provider model id.
  const matchesNow = (choice: ChatModelChoice) =>
    sameChoice(choice, current) ||
    (!!followDefault?.active && !followDefault.own && choice.connectionId === mainRow?.id && !choice.model) ||
    (!!choice.model && !!nowRuns && runsKey(choice, rows) === nowRuns);
  const isNow = (entry: Entry) => matchesNow(entry.choice);
  const leads = (group: SwitcherGroup | undefined, model: string, facts?: CachedModelFacts) =>
    !!leadCatalog && !!group?.account && leadCatalog.test(group.account.provider, model, facts);
  /** A provider the lead models are exclusive to: its other models are not offered, starred or saved. */
  const leadOnly = (group: SwitcherGroup | undefined, model: string, facts?: CachedModelFacts) =>
    !!group?.account && !!leadCatalog?.only?.(group.account.provider) && !leads(group, model, facts);
  const acceptsCatalog = (model: string, facts?: CachedModelFacts, group?: SwitcherGroup) =>
    !leadOnly(group, model, facts) &&
    (!modelFilter || modelFilter(model)) &&
    (!catalogFilter || catalogFilter(model, facts)) &&
    (kind === "all" || !!modelFilter || catalogMatchesKind(model, facts, kind) || leads(group, model, facts));
  // Your models: each Connection's starred models, plus the saved Models a role or their own settings keep.
  const listed = useMemo(
    () =>
      groups.map((group) => {
        if (!group.account) return { group, entries: group.rows.map((row) => entryOfRow(row, group)) };
        const byModel = new Map<string, Entry>();
        for (const model of starsOfRows(group.rows)) {
          if (
            !leadOnly(group, model, catalogOf(group)?.of(model)) &&
            (kind === "chat" || !catalogFilter || acceptsCatalog(model, catalogOf(group)?.of(model)))
          )
            byModel.set(model, entryFor(group, anchorOf(group), model));
        }
        for (const row of group.rows) {
          const kept = row.ownSettings || roleBadges(row).some((role) => role !== "random");
          if (
            row.model &&
            kept &&
            !byModel.has(row.model) &&
            !leadOnly(group, row.model, catalogOf(group)?.of(row.model)) &&
            (kind === "chat" || !catalogFilter || acceptsCatalog(row.model, catalogOf(group)?.of(row.model)))
          ) {
            byModel.set(row.model, entryFor(group, anchorOf(group), row.model));
          }
        }
        return { group, entries: [...byModel.values()] };
      }),
    [anchorOf, groups],
  );

  // Starred models of every provider: the left pane's first item.
  const starredEntries = listed.flatMap((item) =>
    item.group.account
      ? [...starsOf(item.group)].flatMap((model) => item.entries.find((entry) => entry.model === model) ?? [])
      : [],
  );
  // The picker opens on Starred when it has something for this job, else on the current pick's account.
  const paneKey =
    pane ??
    (starredEntries.length > 0 || knownGood
      ? "starred"
      : ((currentGroup?.account ? currentGroup : groups.find((group) => group.account))?.key ?? "starred"));
  const paneGroup = groups.find((group) => group.key === paneKey);
  /** An account pane's long list: opened past Browse, and the one model family it shows (null = all). */
  const [browseOpen, setBrowseOpen] = useState(false);
  const [family, setFamily] = useState<ModelFamily | null>(null);
  const idBase = useId();
  // Edit order, Browse and the family belong to the pane they were set in.
  useEffect(() => {
    setEditOrder(false);
    setBrowseOpen(false);
    setFamily(null);
  }, [paneKey]);
  // A selected account scopes the search to its own models.
  const scopeGroup = paneGroup;
  // The open account's list: shares the cache loadCatalog fills, and tells the pane when it failed.
  const scopeAnchorId = scopeGroup ? (catalogAnchors[groups.indexOf(scopeGroup)] ?? anchorOf(scopeGroup).id) : null;
  const scopeModels = useConnectionModels(scopeAnchorId, catalogBrowse);
  const refreshModels = useRefreshConnectionModels();
  /** An account's pane: its starred models, then its saved Models and the rest of its catalog. */
  const paneEntries = (group: SwitcherGroup) => {
    const anchor = anchorOf(group);
    const starred = group.account
      ? [...starsOf(group)]
          .filter(
            (model) =>
              !leadOnly(group, model, catalogOf(group)?.of(model)) &&
              (kind === "chat" || !catalogFilter || acceptsCatalog(model, catalogOf(group)?.of(model))),
          )
          .map((model) => entryFor(group, anchor, model))
      : [];
    const seen = new Set(starred.map((entry) => entry.model));
    // A saved row without a model (an image server) is still a choice of its own.
    const saved = group.rows
      .filter(
        (row) => !row.model || (!seen.has(row.model) && !leadOnly(group, row.model, catalogOf(group)?.of(row.model))),
      )
      .map((row) => entryOfRow(row, group));
    for (const entry of saved) seen.add(entry.model);
    if (showUnstarred && nowEntry?.model && nowEntry.group?.key === group.key && !seen.has(nowEntry.model)) {
      saved.unshift(nowEntry);
      seen.add(nowEntry.model);
    }
    const ids = catalogBrowse ? new Set((catalogOf(group)?.idSets ?? []).flatMap((set) => [...set])) : [];
    const fromCatalog = [...ids]
      .filter((id) => !seen.has(id) && acceptsCatalog(id, catalogOf(group)?.of(id), group))
      .sort((x, y) => x.localeCompare(y))
      .map((id) => entryFor(group, anchor, id));
    const lead = fromCatalog.filter(
      (entry) => !!entry.model && leads(group, entry.model, catalogOf(group)?.of(entry.model)),
    );
    // `rest` starts with the saved Models (`savedCount` of them): models of yours that a folded list keeps in view.
    return {
      starred,
      lead,
      rest: [...saved, ...fromCatalog.filter((entry) => !lead.includes(entry))],
      savedCount: saved.length,
    };
  };

  // Search (decision 27): saved Models first (starred, then the rest), then catalog models not saved yet, each
  // with prefix matches before the rest, then the typed text as a model id. A Connection's name or a maker
  // ("glm" → Z.ai) also finds saved Models.
  const catalog = useCatalogSearch(catalogBrowse ? deferredQuery : "");
  const { saved: savedHits, extra: extraHits } = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    if (!q) return { saved: [] as Entry[], extra: [] as Entry[] };
    const byRank = <T,>(items: Array<{ rank: number; text: number; item: T }>) =>
      items.filter((entry) => entry.rank >= 0).sort((a, b) => a.rank - b.rank || a.text - b.text);
    const starredIn = (group: SwitcherGroup | undefined, model: string | null | undefined) =>
      !!group?.account && !!model && starsOfRows(group.rows).has(model);
    const saved = byRank(
      // A row with no model yet (an account's placeholder) is not something a job can use, unless its server
      // answers with the model it has loaded: then it is that account's Default model.
      rows
        .filter((row) => row.model || groupOfRow.get(row.id)?.account?.loadedModel)
        .map((row) => {
          const model = { id: row.model ?? "", name: row.name };
          const group = groupOfRow.get(row.id);
          const byModel = rankModelMatch(q, model, { saved: true, starred: starredIn(group, row.model) });
          const byOwner = `${group?.name ?? ""} ${modelBrand(row.model) ?? ""}`.toLowerCase().includes(q) ? 4 : -1;
          return {
            rank: byModel >= 0 ? byModel : byOwner,
            text: rankModelMatch(q, model),
            item: entryOfRow(row, group),
          };
        }),
    ).map(({ item }) => item);
    const added = byRank(
      (catalog.data ?? []).flatMap((hit) => {
        const group = groupByAccount.get(hit.accountId);
        if (
          !group ||
          group.rows.some((row) => row.model === hit.model) ||
          !acceptsCatalog(hit.model, catalogOf(group)?.of(hit.model), group)
        )
          return [];
        const model = { id: hit.model, name: hit.name };
        return [
          {
            rank: rankModelMatch(q, model, { starred: starredIn(group, hit.model) }),
            text: rankModelMatch(q, model),
            item: {
              ...entryFor(group, anchorOf(group), hit.model, hit.name),
              subtitle: `${hit.model} · ${group.name}`,
            },
          },
        ];
      }),
    ).map(({ item }) => item);
    // A pasted id goes to the Connection in use, else the first one. Only chat slots take a
    // typed id: image and video slots once saved it as a chat Model on the wrong job.
    const typed = kind === "chat" ? deferredQuery : "";
    const target = scopeGroup ?? (currentGroup?.account ? currentGroup : groups.find((group) => group.account));
    const known = rows.some((row) => row.model === typed) || added.some((entry) => entry.choice.model === typed);
    if (target && typed && !/\s/.test(typed) && !known) {
      added.push({
        key: `use:${typed}`,
        title: t("connections.switcher.useModelId", { model: typed }),
        subtitle: t("connections.switcher.useModelIdOn", { connection: target.name }),
        choice: { connectionId: anchorOf(target).id, model: typed },
      });
    }
    return { saved, extra: added };
  }, [
    anchorOf,
    catalog.data,
    currentGroup,
    deferredQuery,
    groupByAccount,
    groupOfRow,
    groups,
    kind,
    rows,
    scopeGroup,
    t,
  ]);
  // Models known to suit the slot come first, across every provider's cached catalog.
  const knownEntries = useMemo(() => {
    if (!knownGood) return [] as Entry[];
    const out: Entry[] = [];
    for (const group of groups) {
      if (!group.account) continue;
      const catalog = catalogOf(group);
      const seen = new Set<string>();
      for (const facts of catalog?.factSets ?? []) {
        for (const [model, modelFacts] of facts) {
          if (
            !seen.has(model) &&
            acceptsCatalog(model, modelFacts, group) &&
            knownGood.test(group.account.id, model, modelFacts)
          ) {
            seen.add(model);
            out.push(entryFor(group, anchorOf(group), model, model));
          }
        }
      }
    }
    return out.slice(0, 30);
  }, [knownGood, groups, catalogs, anchorOf]);

  const searching = deferredQuery.length > 0;
  // Search results: starred matches first, then one group per account; a selected account searches only its own
  // models. The typed id comes last.
  const isStarredEntry = (entry: Entry) =>
    !!entry.group?.account && !!entry.model && starsOf(entry.group).has(entry.model);
  const typedEntry = extraHits.find((entry) => entry.key.startsWith("use:"));
  const allSections: Array<{ key: string; label?: string; entries: Entry[] }> = [];
  if (searching && scopeGroup) {
    const q = deferredQuery.toLowerCase();
    const facts = catalogOf(scopeGroup);
    const match = (list: Entry[]) =>
      list
        .map((entry) => ({
          entry,
          rank: rankModelMatch(q, { id: entry.model ?? "", name: facts?.nameOf(entry.model) ?? entry.title }),
        }))
        .filter((hit) => hit.rank >= 0)
        .sort((x, y) => x.rank - y.rank)
        .map((hit) => hit.entry);
    const { starred, lead, rest } = paneEntries(scopeGroup);
    allSections.push(
      { key: "starred", label: t("connections.switcher.starred"), entries: match(starred) },
      ...(leadCatalog ? [{ key: "lead", label: leadCatalog.label, entries: match(lead) }] : []),
      {
        key: "all",
        label: leadCatalog && lead.length ? leadCatalog.restLabel : t("connections.switcher.allModels"),
        entries: match(rest),
      },
    );
  } else if (searching) {
    const hits = [...savedHits, ...extraHits.filter((entry) => entry !== typedEntry)];
    const rest = hits.filter((entry) => !isStarredEntry(entry));
    allSections.push(
      { key: "starred", label: t("connections.switcher.starred"), entries: hits.filter(isStarredEntry) },
      // Accounts follow their best hit, so a saved Model's account comes before catalog-only ones.
      ...[...new Set(rest.flatMap((entry) => (entry.group ? [entry.group] : [])))].map((group) => ({
        key: group.key,
        label: group.name,
        entries: rest.filter((entry) => entry.group === group),
      })),
      { key: "other", entries: rest.filter((entry) => !entry.group) },
    );
  }
  if (searching && typedEntry) allSections.push({ key: "use", entries: [typedEntry] });
  const searchSections = allSections.filter((section) => section.entries.length > 0);
  const searchEntries = searchSections.flatMap((section) => section.entries);

  // Enter adds a typed id only after the user moved onto that row; typing a name to filter
  // and pressing Enter must not create a Model.
  const highlightMoved = useRef(false);
  useEffect(() => {
    setHighlight(0);
    highlightMoved.current = false;
  }, [deferredQuery]);

  /**
   * One model line: maker icon, name (a sliders icon first when it has its own settings), then where it runs at the
   * left of line two and its state or roles at the right. `now` keeps the host's state (Follow Main stays on).
   */
  // ponytail: reads the usage meters' cached readings only (no fetch per row); a Connection whose meter never loaded
  // shows no limit. A server-side "limited until" flag on the account if this needs to be exact.
  const usageQueryClient = useQueryClient();
  const limitReached = (group: SwitcherGroup | undefined, cost: string | null | undefined) => {
    if (!group?.account) return false;
    const usage = group.rows
      .map((row) =>
        usageQueryClient.getQueryData<SubscriptionUsage>([...connectionKeys.detail(row.id), "subscription-usage"]),
      )
      .find(Boolean);
    if (usage && !("windows" in usage) && cost !== "included" && !cost?.startsWith("multiplier:")) return false;
    return usageAtLimit(usage);
  };

  const renderEntry = (
    rawEntry: Entry,
    {
      index,
      now = false,
      star = "unstarred",
      away = false,
      order = false,
      pane = false,
    }: {
      index?: number;
      /** A row in the left pane: its tile takes the panes' 2rem column so it lines up with Starred and accounts. */
      pane?: boolean;
      /** Only the Starred lists that show the Edit order toggle pass this. */
      order?: boolean;
      now?: boolean;
      star?: "all" | "unstarred" | "none";
      /** Shown outside its provider's list (Now, Starred, Recent): line 2 names the provider, and the upstream it goes via. */
      away?: boolean;
    } = {},
  ) => {
    // The provider's own name when it has one; the id is the second line only when two rows would look the same.
    const ordering = editOrder && order;
    const catalogFacts = rawEntry.group ? catalogOf(rawEntry.group) : undefined;
    const niceName =
      rawEntry.model && rawEntry.title === rawEntry.model ? catalogFacts?.nameOf(rawEntry.model) : undefined;
    const entry: Entry = { ...rawEntry, ...(niceName ? { title: niceName } : {}) };
    const sameTitle = rawEntry.group?.rows.some((row) => row.model !== entry.model && rowLabel(row) === entry.title);
    if (entry.subtitle === entry.model && !sameTitle) entry.subtitle = "";
    const via = viaName(rawEntry.group?.account?.provider, entry.model);
    let routeId = via && entry.model !== entry.title ? entry.model : undefined;
    if (rawEntry.group?.account) {
      entry.subtitle = [
        away ? rawEntry.group.name : entry.subtitle,
        via && t("connections.accounts.section.via", { service: via }),
      ]
        .filter(Boolean)
        .join(" · ");
      if (routeId && entry.subtitle.includes(routeId)) routeId = undefined;
    } else if (away && entry.row?.provider) {
      // A saved Model with no account says which provider it runs on (#9317).
      const service = PROVIDERS[entry.row.provider as APIProvider]?.name;
      entry.subtitle = [service, entry.subtitle].filter(Boolean).join(" · ");
    }
    const isCurrent = now || isNow(entry) || sameChoice(entry.choice, current);
    const highlighted = index !== undefined && index === highlight;
    const group = entry.group;
    const unavailable = unavailableOf(group);
    // The job this picker is for is in its title already; its pill would only repeat it.
    const roleLabels = entry.row ? modelRoleLabels(entry.row, t, voiceRowId).filter((role) => role !== ownRole) : [];
    const starred = group?.account && entry.model ? starsOf(group).has(entry.model) : false;
    const custom = !!entry.row?.ownSettings && !starred && roleLabels.length === 0;
    const showStar = !!group?.account && !!entry.model && (star === "all" || (star === "unstarred" && !starred));
    const stateLabel = unavailable ? t(accountStateLabel({ state: unavailable })) : null;
    const local = entry.choice.connectionId === LOCAL_SIDECAR_CONNECTION_ID;
    const typed = entry.key.startsWith("use:");
    const rowStateOf = entry.model && group?.account ? rowState?.(group.account.id, entry.model) : null;
    const isKnown =
      !!knownGood &&
      !!entry.model &&
      !!group?.account &&
      knownGood.test(group.account.id, entry.model, catalogOf(group)?.of(entry.model));
    const catalog = catalogOf(group);
    const facts = catalog?.of(entry.model);
    return (
      <ModelRow
        key={entry.key}
        rowProps={{
          "data-switcher-row": true,
          className: cn("rounded-lg", now ? "bg-transparent pe-0" : isCurrent && ACCENT_BAR),
        }}
        data-switcher-entry={entry.choice.model ?? entry.choice.connectionId}
        data-switcher-model={entry.model}
        aria-current={isCurrent ? "true" : undefined}
        aria-label={[
          entry.title,
          entry.subtitle,
          routeId,
          stateLabel ?? roleLabels.join(", "),
          custom && t("connections.row.customSettings"),
        ]
          .filter(Boolean)
          .join(", ")}
        disabled={busy}
        onClick={() => {
          if (unavailable && group) return fix(group);
          if (now && !confirmCurrent) return onDone();
          void apply(entry);
        }}
        onMouseEnter={index !== undefined ? () => setHighlight(index) : undefined}
        className={cn(
          "rounded-lg disabled:cursor-wait",
          highlighted && "bg-foreground/10",
          // Now and pane rows put the tile in the shared 2rem column; text then starts where Starred and accounts start.
          now && "min-h-0 gap-2 py-1 ps-1.5 max-md:gap-2 max-md:ps-1.5",
          pane && "gap-2 ps-3 max-md:gap-2 max-md:ps-3",
        )}
        tile={
          <span className={cn("flex shrink-0 justify-center", (now || pane) && "w-8")}>
            {typed ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-foreground/50">
                <Search size="0.875rem" aria-hidden />
              </span>
            ) : local ? (
              <ProviderIcon provider="local_model" size={now || pane ? "sm" : "model"} dim={!!unavailable} />
            ) : (
              <ModelTile
                row={entry.row}
                account={group?.account}
                model={entry.model}
                dim={!!unavailable}
                size={now || pane ? "sm" : undefined}
              />
            )}
          </span>
        }
        title={entry.title}
        routeId={routeId}
        // The Now strip folds its heading into line 2 to stay one compact row.
        subtitle={now ? [nowLabel, entry.subtitle].filter(Boolean).join(" · ") : entry.subtitle}
        roles={roleLabels}
        status={
          rowStateOf
            ? { label: rowStateOf.label, state: rowStateOf.state, detail: rowStateOf.detail }
            : stateLabel
              ? { label: stateLabel, state: unavailable ?? undefined }
              : limitReached(group, facts?.cost)
                ? { label: t("connections.switcher.limitReached"), state: "limit" }
                : null
        }
        customized={custom}
        facts={facts}
        showPaid={catalog?.showPaid}
        current={isCurrent}
        dim={!!unavailable}
        trailing={
          isCurrent && !now ? (
            <Check size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
          ) : isKnown ? (
            <Check size="0.75rem" aria-label={knownGood!.label} className="shrink-0 text-foreground/35" />
          ) : null
        }
        end={
          <>
            {now && unavailable && group && fixButton(group)}
            {ordering && starred && group && orderButtons(group, entry.model!, entry.title)}
            {starred && entry.row && !ordering && (
              <button
                type="button"
                data-switcher-settings={entry.model}
                aria-label={t("connections.star.settings", { model: entry.title })}
                title={t("connections.star.settings", { model: entry.title })}
                onClick={() => {
                  onDone();
                  openConnectionDetail(entry.row!.id);
                }}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/35 outline-none transition-[color,background-color,opacity] hover:bg-foreground/10 hover:text-foreground/70 focus-visible:ring-1 focus-visible:ring-foreground/25",
                  // Shown on hover, unless the model has settings of its own; touch screens always show it.
                  !entry.row.ownSettings &&
                    "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-md:opacity-100",
                )}
              >
                <SlidersHorizontal size="0.875rem" aria-hidden />
              </button>
            )}
            {showStar && !ordering && starButton(group!, entry.model!, entry.title, starred)}
          </>
        }
      />
    );
  };

  // The catalogs are read once, so a small one can list in place (the server caches them; a failure just leaves the Browse row).
  const loadCatalog = useCountConnectionModels();
  const catalogQueryClient = useQueryClient();
  useEffect(() => {
    if (!catalogBrowse) return;
    for (const group of groups) {
      if (!group.account || group.account.state !== "ok") continue;
      const id = anchorOf(group).id;
      // A failed list is not cached, so loading it on every render would refetch it forever; Refresh retries it.
      if (catalogQueryClient.getQueryState(connectionKeys.models(id))?.status === "error") continue;
      void loadCatalog(id);
    }
  }, [catalogBrowse, groups, anchorOf, loadCatalog, catalogQueryClient]);

  // The Main model and where it runs, for the "Use default" tooltip.
  const mainVia = mainRow ? viaName(mainRow.provider, mainRow.model) : null;
  const mainLine = mainRow
    ? [
        rowLabel(mainRow),
        groupOfRow.get(mainRow.id)?.name,
        mainVia && t("connections.accounts.section.via", { service: mainVia }),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const extraRows = (extras ?? []).map((extra) => (
    <button
      key={extra.value}
      type="button"
      data-switcher-extra={extra.value}
      aria-current={extra.active ? "true" : undefined}
      disabled={busy}
      onClick={() => {
        if (extra.active) return onDone();
        setBusy(true);
        void extra
          .onSelect()
          .then(onDone)
          .catch((error) => toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) })))
          .finally(() => setBusy(false));
      }}
      className={cn(ROW_CLASS, extra.active && "bg-foreground/[0.07] font-semibold")}
    >
      {extra.icon}
      {extra.subtitle ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate">{extra.label}</span>
          <span className="block truncate text-[0.6875rem] font-normal leading-4 text-[var(--muted-foreground)]">
            {extra.subtitle}
          </span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{extra.label}</span>
      )}
      {extra.active && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
    </button>
  ));
  const addRow = onAdd && (
    <div className="shrink-0 border-t border-foreground/10 px-1 py-1">
      <button type="button" data-switcher-add onClick={onAdd} className={ROW_CLASS}>
        <Plus size="0.875rem" aria-hidden className="mx-[0.3125rem] shrink-0 text-foreground/55" />
        <span className="min-w-0 flex-1 truncate">{t("connections.switcher.addProvider")}</span>
      </button>
    </div>
  );

  // Shuffle on: the list becomes the pool, as before.
  const poolList = (
    <>
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
    <SearchInput
      className="mx-2 my-2 shrink-0"
      inputRef={searchRef}
      data-switcher-search
      value={query}
      onChange={setQuery}
      onKeyDown={(event) => {
        // Keys pressed while an input method is composing belong to the composition.
        if (event.nativeEvent.isComposing || event.keyCode === 229 || !searching) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          highlightMoved.current = true;
          setHighlight((index) => Math.min(Math.max(index + step, 0), searchEntries.length - 1));
        } else if (event.key === "Enter") {
          event.preventDefault();
          const entry = searchEntries[highlight];
          // A typed id is used on Enter only when nothing else matches, as in the old catalog picker.
          if (entry && (!entry.key.startsWith("use:") || highlightMoved.current || searchEntries.length === 1))
            void apply(entry);
        }
      }}
      label={t("connections.switcher.searchLabel")}
      placeholder={
        scopeGroup
          ? t("connections.switcher.searchInPlaceholder", { account: scopeGroup.name })
          : t("connections.switcher.searchPlaceholder")
      }
      autoCapitalize="off"
      autoCorrect="off"
    />
  );

  const nothing = groups.length === 0 && !showLocalModel;
  // A job's pick is not "this chat only"; only chat hosts (no job role) say so.
  const nowLabel =
    followDefault && !ownRole
      ? followDefault.label
        ? t("connections.switcher.now")
        : t(followDefault.active ? "connections.switcher.nowFollowsMain" : "connections.switcher.nowThisChat")
      : t("connections.switcher.now");
  const usageOf = (group: SwitcherGroup | undefined) => {
    const usageRow = group ? resolveUsageConnection(rows, anchorOf(group).id) : null;
    return (
      usageRow && (
        <div className="border-b border-foreground/10 px-3 pt-1">
          <SubscriptionUsageWidget connectionId={usageRow.id} variant="inline" />
        </div>
      )
    );
  };

  const openPane = (key: string) => {
    setPane(key);
    setDrilled(true);
  };
  const heading = (label: ReactNode, count?: number, id?: string) => (
    <ListHeading className="flex items-baseline justify-between gap-2">
      <span id={id} className="min-w-0 truncate">
        {label}
      </span>
      {count !== undefined && <span className="shrink-0 font-normal tabular-nums">{count}</span>}
    </ListHeading>
  );
  // On a narrow host each left item drills into its pane.
  const chevron = <ChevronRight size="0.875rem" className="shrink-0 text-foreground/35 @xl:hidden" aria-hidden />;
  const paneButton = (key: string, tile: ReactNode, label: string, count: number) => {
    const selected = paneKey === key;
    return (
      <button
        key={key}
        type="button"
        data-switcher-pane={key}
        aria-pressed={selected}
        onClick={() => openPane(key)}
        className={cn(ROW_CLASS, "min-h-11", selected && cn("bg-foreground/[0.07] font-semibold", ACCENT_BAR))}
      >
        {tile}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 font-normal tabular-nums text-foreground/50">{count}</span>
        {chevron}
      </button>
    );
  };
  const accountItem = (group: SwitcherGroup) => {
    const account = group.account!;
    const selected = paneKey === group.key;
    return (
      <ServiceRow
        key={group.key}
        account={account}
        rows={group.rows}
        density="sm"
        count={t("connections.list.models", { count: catalogOf(group)?.count ?? group.rows.length })}
        state={account.state}
        stateLabel={t(accountStateLabel(account))}
        current={selected}
        onClick={() => openPane(group.key)}
        aria-pressed={selected}
        data-switcher-pane={group.key}
        className={cn(selected && ACCENT_BAR)}
        trailing={chevron}
        end={unavailableOf(group) && fixButton(group)}
      />
    );
  };
  // Group by folder (the Connections panel's choice): each folder is a pane of its saved Models.
  const knownFolders = new Set((folders ?? []).map((folder) => folder.id));
  const folderPanes = byFolder
    ? [...sortPanelFolders(folders ?? [], sort), null]
        .map((folder) => ({
          key: `folder:${folder?.id ?? "none"}`,
          folder,
          entries: rows
            .filter((row) => (folder ? row.folderId === folder.id : !row.folderId || !knownFolders.has(row.folderId)))
            .map((row) => entryOfRow(row, groupOfRow.get(row.id))),
        }))
        .filter((item) => item.entries.length > 0)
    : [];
  // A filtered job (embeddings) skips accounts with nothing it can use, as the old list did.
  const accountGroups = groups.filter((group) => {
    const account = group.account;
    if (!account) return false;
    if (kind === "chat") return rows.some((row) => row.accountId === account.id);
    // An account that needs a key stays listed, so its Add key button is reachable.
    if (accountFilter && unavailableOf(group)) return true;
    if (!modelFilter && !catalogFilter && kind === "all") return true;
    const { starred, lead, rest } = paneEntries(group);
    return starred.length + lead.length + rest.length > 0;
  });
  const standaloneGroups = groups.filter((group) => !group.account);

  const leftPane = (
    <div
      data-switcher-accounts
      className={cn(
        "flex min-h-0 w-full flex-col @xl:w-[15.5rem] @xl:shrink-0 @xl:border-r @xl:border-foreground/10",
        drilled && "@max-xl:hidden",
      )}
    >
      <ListFrame option="[data-switcher-pane],[data-switcher-extra]" className="min-h-0 flex-1" listClassName="p-1.5">
        {extraRows}
        {paneButton(
          "starred",
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-[var(--marinara-chat-chrome-accent)]"
            aria-hidden
          >
            <Star size="0.875rem" fill="currentColor" />
          </span>,
          t("connections.switcher.starred"),
          starredEntries.length,
        )}
        {accountGroups.length > 0 && (
          <section data-switcher-section="accounts" aria-label={t("connections.switcher.accounts")}>
            {heading(t("connections.switcher.accounts"))}
            {accountGroups.map(accountItem)}
          </section>
        )}
        {folderPanes.length > 0 && (
          <section data-switcher-section="folders" aria-label={t("connections.switcher.folders")}>
            {heading(t("connections.switcher.folders"))}
            {folderPanes.map((item) =>
              paneButton(
                item.key,
                <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                  <span
                    className={cn("h-2 w-2 rounded-full", !item.folder?.color && "border border-foreground/40")}
                    style={item.folder?.color ? { backgroundColor: item.folder.color } : undefined}
                  />
                </span>,
                item.folder?.name ?? t("connections.folders.none"),
                item.entries.length,
              ),
            )}
          </section>
        )}
        {standaloneGroups.flatMap((group) =>
          group.rows.map((row) => renderEntry(entryOfRow(row, group), { pane: true, away: true })),
        )}
        {showLocalModel && renderEntry(localEntry, { pane: true })}
      </ListFrame>
      {addRow}
    </div>
  );

  const paneFolder = folderPanes.find((item) => item.key === paneKey);
  const shownGroup = paneFolder ? undefined : paneGroup;
  const shownEntries = shownGroup ? paneEntries(shownGroup) : null;
  const restLabel =
    leadCatalog && shownEntries?.lead.length ? leadCatalog.restLabel : t("connections.switcher.allModels");
  // Browse: below models of yours (starred, recommended or saved), a long list of the account's other models
  // starts folded. Saved Models stay in view above the fold, since they carry settings of their own.
  const savedCount = shownEntries?.savedCount ?? 0;
  const restFolded =
    !!shownEntries &&
    shownEntries.starred.length + shownEntries.lead.length + savedCount > 0 &&
    shownEntries.rest.length - savedCount >= BROWSE_MIN;
  const savedEntries = restFolded ? shownEntries!.rest.slice(0, savedCount) : [];
  const foldable = restFolded ? shownEntries!.rest.slice(savedCount) : (shownEntries?.rest ?? []);
  const restShown = !!shownEntries && (!restFolded || browseOpen);
  const familyChips = restShown ? familyChipsFor(foldable.map((entry) => entry.model ?? "")) : [];
  // A family that is gone from the list (after Refresh) shows every model again.
  const shownFamily = familyChips.some((chip) => chip.family === family) ? family : null;
  const restEntries = shownFamily
    ? foldable.filter((entry) => modelFamilyOf(entry.model ?? "") === shownFamily)
    : foldable;
  // Recent (Starred pane): this device's last picks that are not starred and that this picker still lists.
  const recentEntries: Entry[] = [];
  if (!shownGroup && !paneFolder && !searching) {
    for (const pick of recentPicks) {
      if (recentEntries.length === RECENT_SHOWN) break;
      const group = groupByAccount.get(pick.accountId);
      if (!group || starsOf(group).has(pick.model)) continue;
      const facts = catalogOf(group)?.of(pick.model);
      const listed = group.rows.some((row) => row.model === pick.model)
        ? !leadOnly(group, pick.model, facts)
        : catalogBrowse &&
          !!catalogOf(group)?.idSets.some((ids) => ids.has(pick.model)) &&
          acceptsCatalog(pick.model, facts, group);
      if (listed) recentEntries.push(entryFor(group, anchorOf(group), pick.model));
    }
  }
  const paneTitle = (title: ReactNode, summary: string) => (
    <div className="flex min-w-0 shrink-0 items-baseline gap-2.5 px-3.5 pb-1 pt-2.5">
      <strong className="truncate text-[0.8125rem] font-semibold">{title}</strong>
      <span className="truncate text-[0.6875rem] max-sm:text-[13px] text-foreground/50">{summary}</span>
    </div>
  );
  // The overview is hidden during search and account browsing; avoid walking every catalog on those renders.
  const unstarredGroups =
    showUnstarred && catalogBrowse && !query.trim() && !searching && !shownGroup && !paneFolder
      ? groups
          .map((group) => {
            const { lead, rest } = paneEntries(group);
            // A model already under Recent is not listed a second time.
            const recent = new Set(
              recentEntries.filter((entry) => entry.group?.key === group.key).map((entry) => entry.model),
            );
            return { group, entries: [...lead, ...rest].filter((entry) => !recent.has(entry.model)) };
          })
          .filter(({ entries }) => entries.length > 0)
      : [];
  const starredAccounts = new Set(starredEntries.map((entry) => entry.group?.key)).size;
  const rightPane = (
    <div
      data-switcher-pane-models={paneKey}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !drilled && "@max-xl:hidden")}
    >
      <div className="shrink-0 px-1 pt-1 @xl:hidden">
        <button
          type="button"
          data-switcher-back
          onClick={() => setDrilled(false)}
          className={cn(ROW_CLASS, "w-auto text-foreground/70")}
        >
          <ChevronLeft size="0.875rem" className="shrink-0" aria-hidden />
          {t("connections.switcher.backToAccounts")}
        </button>
      </div>
      {shownGroup?.account ? (
        <ServiceRow
          account={shownGroup.account}
          rows={shownGroup.rows}
          density="sm"
          count={[
            t("connections.list.models", { count: catalogOf(shownGroup)?.count ?? shownGroup.rows.length }),
            shownEntries!.starred.length > 0
              ? t("connections.switcher.starredSome", { count: shownEntries!.starred.length })
              : t("connections.switcher.starredNone"),
          ].join(" · ")}
          state={shownGroup.account.state}
          stateLabel={t(accountStateLabel(shownGroup.account))}
          className="shrink-0 ps-1 pe-3 pt-1"
          trailing={
            catalogBrowse &&
            scopeAnchorId &&
            !unavailableOf(shownGroup) && (
              <button
                type="button"
                data-model-refresh
                onClick={() =>
                  refreshModels.mutate(scopeAnchorId, {
                    onError: (error) =>
                      toast.error(t("connections.modelPicker.refreshFailed", { error: errorMessage(error) })),
                  })
                }
                disabled={refreshModels.isPending || scopeModels.isFetching}
                aria-label={t("connections.modelPicker.refresh")}
                title={t("connections.modelPicker.refresh")}
                className="mari-chrome-control mari-chrome-control--icon"
              >
                <RefreshCw
                  size="0.875rem"
                  className={cn((refreshModels.isPending || scopeModels.isFetching) && "animate-spin")}
                  aria-hidden
                />
              </button>
            )
          }
          end={unavailableOf(shownGroup) && fixButton(shownGroup)}
        />
      ) : paneFolder ? (
        paneTitle(
          paneFolder.folder?.name ?? t("connections.folders.none"),
          t("connections.list.models", { count: paneFolder.entries.length }),
        )
      ) : (
        paneTitle(
          t("connections.switcher.starred"),
          t("connections.switcher.starredSummary", {
            models: t("connections.list.models", { count: starredEntries.length }),
            accounts: t("connections.switcher.accountCount", { count: starredAccounts }),
          }),
        )
      )}
      {shownGroup && usageOf(shownGroup)}
      <ListFrame
        data-connection-switcher-scroll
        option="button.mari-connection-model-choice"
        className="min-h-0 flex-1"
        listClassName={cn("p-1.5", listClassName)}
      >
        {shownEntries ? (
          <>
            {shownEntries.starred.length > 0 && (
              <section data-switcher-section="starred" aria-label={t("connections.switcher.starred")}>
                {heading(t("connections.switcher.starred"), shownEntries.starred.length)}
                {shownEntries.starred.length > 1 && orderToggle}
                {shownEntries.starred.map((entry) =>
                  renderEntry(entry, { star: "all", order: shownEntries.starred.length > 1 }),
                )}
              </section>
            )}
            {leadCatalog && shownEntries.lead.length > 0 && (
              <section data-switcher-section="lead" aria-label={leadCatalog.label}>
                {heading(leadCatalog.label, shownEntries.lead.length)}
                <EntryRows
                  listKey={`lead:${paneKey}`}
                  entries={shownEntries.lead}
                  render={(entry) => renderEntry(entry, { star: "all" })}
                />
              </section>
            )}
            {savedEntries.length > 0 && (
              <section data-switcher-section="saved" aria-label={t("connections.switcher.saved")}>
                {heading(t("connections.switcher.saved"), savedEntries.length)}
                <EntryRows
                  listKey={`saved:${paneKey}`}
                  entries={savedEntries}
                  render={(entry) => renderEntry(entry, { star: "all" })}
                />
              </section>
            )}
            {restFolded && (
              <button
                type="button"
                data-switcher-browse={paneKey}
                aria-expanded={browseOpen}
                aria-controls={`${idBase}-rest`}
                onClick={() => setBrowseOpen((open) => !open)}
                className={cn(ROW_CLASS, "mt-1 text-foreground/70")}
              >
                <ChevronRight
                  size="0.875rem"
                  aria-hidden
                  className={cn("mx-[0.3125rem] shrink-0 transition-transform", browseOpen && "rotate-90")}
                />
                <span className="min-w-0 flex-1 truncate">
                  {t("connections.switcher.browseAllCount", { count: foldable.length })}
                </span>
              </button>
            )}
            <div id={`${idBase}-rest`}>
              {restShown && foldable.length > 0 && (
                <>
                  {familyChips.length > 0 && (
                    <>
                      <ModelFamilyChips
                        chips={familyChips}
                        total={foldable.length}
                        selected={shownFamily}
                        onSelect={setFamily}
                      />
                      <p role="status" className="sr-only">
                        {t("connections.switcher.familyShowing", { count: restEntries.length })}
                      </p>
                    </>
                  )}
                  <section data-switcher-section="all" aria-label={restLabel}>
                    {heading(restLabel, restEntries.length)}
                    <EntryRows
                      listKey={`rest:${paneKey}:${shownFamily ?? "all"}`}
                      entries={restEntries}
                      render={(entry) => renderEntry(entry, { star: "all" })}
                    />
                  </section>
                </>
              )}
            </div>
            {scopeModels.isError && !refreshModels.isPending ? (
              <ListStatus>{t("connections.modelPicker.loadFailed")}</ListStatus>
            ) : (
              shownEntries.starred.length + shownEntries.lead.length + shownEntries.rest.length === 0 && (
                <ListStatus>{t("connections.switcher.noModels")}</ListStatus>
              )
            )}
          </>
        ) : paneFolder ? (
          <EntryRows
            listKey={`folder:${paneKey}`}
            entries={paneFolder.entries}
            render={(entry) => renderEntry(entry, { star: "all" })}
          />
        ) : (
          <>
            {knownEntries.length > 0 && (
              <section data-switcher-section="known" aria-label={knownGood!.label}>
                {heading(knownGood!.label)}
                {knownEntries.map((entry) => renderEntry(entry, { away: true }))}
              </section>
            )}
            <section data-switcher-section="starred" aria-label={t("connections.switcher.starred")}>
              {/* A list below needs the heading to tell Starred apart from it. */}
              {(showUnstarred || recentEntries.length > 0) &&
                starredEntries.length > 0 &&
                heading(t("connections.switcher.starred"), starredEntries.length)}
              {starredEntries.length > 1 && orderToggle}
              {starredEntries.map((entry) =>
                renderEntry(entry, { star: "all", away: true, order: starredEntries.length > 1 }),
              )}
            </section>
            {recentEntries.length > 0 && (
              <section data-switcher-section="recent" aria-labelledby={`${idBase}-recent`}>
                {heading(t("connections.switcher.recent"), recentEntries.length, `${idBase}-recent`)}
                {recentEntries.map((entry) => renderEntry(entry, { star: "all", away: true }))}
              </section>
            )}
            {unstarredGroups.map(({ group, entries }) => (
              <section key={group.key} data-switcher-section="provider" aria-label={group.name}>
                {heading(group.name, entries.length)}
                <EntryRows
                  listKey={`provider:${group.key}`}
                  entries={entries}
                  render={(entry) => renderEntry(entry, { star: "all", away: true })}
                />
              </section>
            ))}
            {starredEntries.length === 0 && knownEntries.length === 0 && unstarredGroups.length === 0 && (
              <ListStatus>{t("connections.switcher.starredEmpty")}</ListStatus>
            )}
          </>
        )}
      </ListFrame>
    </div>
  );

  const results = (
    <ListFrame
      data-connection-switcher-scroll
      className="min-h-0 flex-1 border-t border-foreground/10"
      listClassName={cn("p-1.5", listClassName)}
    >
      <div data-switcher-results>
        {searchSections.map((section) => (
          <section key={section.key} data-switcher-section={section.key} aria-label={section.label}>
            {section.label && heading(section.label, section.entries.length)}
            <EntryRows
              listKey={`search:${section.key}`}
              entries={section.entries}
              scrollToIndex={highlight - searchEntries.indexOf(section.entries[0]!)}
              render={(entry) =>
                renderEntry(entry, {
                  index: searchEntries.indexOf(entry),
                  star: "all",
                  away: section.key === "starred" && !scopeGroup,
                })
              }
            />
          </section>
        ))}
      </div>
      {searchEntries.length === 0 && (
        <ListStatus>
          {t(!scopeGroup && catalog.isFetching ? "connections.switcher.searching" : "connections.switcher.noMatches")}
        </ListStatus>
      )}
      {scopeGroup && (
        <button
          type="button"
          data-switcher-search-all
          onClick={() => setPane("starred")}
          className={cn(ROW_CLASS, "text-foreground/70")}
        >
          <Search size="0.875rem" className="mx-[0.3125rem] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t("connections.switcher.searchAll")}</span>
        </button>
      )}
    </ListFrame>
  );

  // Now: what the host runs (or the default it follows), with the way back to the default beside it.
  const activeExtra = extras?.find((extra) => extra.active);
  const nowStrip = (
    <section
      data-switcher-section="now"
      aria-label={nowLabel}
      className={cn(
        "mx-2 mt-1.5 shrink-0 rounded-[0.625rem] bg-foreground/[0.06] px-1 py-0.5",
        // In Shuffle the pool list has no Back, so the strip with the dice stays the way out; with no models there
        // are no panes and no Back either, so it keeps the way to the default.
        drilled && !searching && !shuffle?.active && !nothing && "@max-xl:hidden",
      )}
    >
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          {nowEntry && !shuffle?.active ? (
            renderEntry(nowEntry, { now: true, away: true })
          ) : (
            <>
              <ListHeading className="pb-0 pt-0.5 text-[var(--marinara-chat-chrome-accent)]">{nowLabel}</ListHeading>
              <p className="truncate px-3 py-2 text-xs font-medium">
                {shuffle?.active
                  ? t("connections.switcher.shuffle")
                  : (activeExtra?.label ??
                    (followDefault?.active
                      ? (followDefault.label ?? t("connections.switcher.followMain"))
                      : t("connections.switcher.chooseModel")))}
              </p>
            </>
          )}
        </div>
        {followDefault && (!followDefault.active || confirmCurrent) && (
          <button
            type="button"
            data-switcher-default
            disabled={busy}
            title={mainLine || followDefault.label || t("connections.switcher.useDefaultNone")}
            onClick={() => {
              setBusy(true);
              void followDefault
                .onSelect()
                .then(onDone)
                .catch((error) => toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) })))
                .finally(() => setBusy(false));
            }}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[0.6875rem] max-sm:text-[13px] text-foreground/55 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-wait @max-xl:w-11 @max-xl:px-0"
          >
            <House size="0.8125rem" className="shrink-0" aria-hidden />
            <span className="@max-xl:sr-only">{followDefault.label ?? t("connections.switcher.useDefaultNone")}</span>
          </button>
        )}
        {shuffle?.onToggle && (
          <button
            type="button"
            data-switcher-shuffle
            aria-pressed={shuffle.active}
            aria-label={t("connections.switcher.shuffle")}
            title={t(
              shuffle.active
                ? "ui.chat.quickconnectionswitcher.randomPoolActiveClickToDisable"
                : "ui.chat.quickconnectionswitcher.useRandomConnectionFromPool",
            )}
            onClick={shuffle.onToggle}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/55 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/25",
              shuffle.active && "text-[var(--marinara-chat-chrome-accent)]",
            )}
          >
            <Dices size="1rem" aria-hidden />
          </button>
        )}
      </div>
      {listHeader}
    </section>
  );

  return (
    <div
      ref={rootRef}
      data-connection-switcher
      onKeyDown={(event) => {
        // On a narrow host Escape steps back from a drilled pane first; with two panes it closes the host.
        if (event.key !== "Escape" || event.nativeEvent.isComposing || event.keyCode === 229) return;
        const back = rootRef.current?.querySelector<HTMLElement>("[data-switcher-back]");
        if (!back?.offsetParent) return;
        event.preventDefault();
        event.stopPropagation();
        back.click();
      }}
      className={cn("mari-connection-scope @container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
    >
      {nowStrip}
      {listsReady && !shuffle?.active && !nothing && searchBox}
      {!listsReady ? (
        listsFailed ? (
          <div role="alert" className="flex flex-col items-center gap-2 border-t border-foreground/10 px-3 py-3">
            <p className="text-center text-[0.6875rem] text-foreground/60">{t("connections.picker.loadFailed")}</p>
            <button
              type="button"
              onClick={() => {
                void connectionsQuery.refetch();
                void accountsQuery.refetch();
              }}
              className="mari-chrome-control mari-chrome-control--small text-xs"
            >
              {t("connections.picker.retry")}
            </button>
          </div>
        ) : (
          <ListStatus className="border-t border-foreground/10">{t("connections.modelPicker.loading")}</ListStatus>
        )
      ) : shuffle?.active ? (
        <ListFrame
          data-connection-switcher-scroll
          className="min-h-0 flex-1 border-t border-foreground/10"
          listClassName="relative min-h-0 px-1 pb-1"
        >
          {poolList}
        </ListFrame>
      ) : nothing ? (
        // With no models there are no panes, so the add row goes under the empty message. Values that are not
        // models, such as a Decision connection, stay pickable above it.
        <>
          {extraRows.length > 0 && <div className="shrink-0 border-t border-foreground/10 p-1.5">{extraRows}</div>}
          {empty ?? <ListStatus>{t("ui.chat.quickconnectionswitcher.noConnectionsFound")}</ListStatus>}
          {addRow}
        </>
      ) : searching ? (
        results
      ) : (
        <div data-switcher-panes className="flex min-h-0 flex-1 border-t border-foreground/10">
          {leftPane}
          {rightPane}
        </div>
      )}
      {listFooter}
    </div>
  );
}
