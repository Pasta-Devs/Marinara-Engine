// ──────────────────────────────────────────────
// Connection Switcher Body — the one model chooser shared by the chat's
// composer chip, the phone menu, Chat Settings and Professor Mari's composer.
// One column: search, Now (pinned), Follow Main, Recent, then the starred
// Models grouped by Connection. A catalog shows only on a search or from a
// Connection's "All models" row. A pick applies to the chat only; the star
// saves a model, and removing it can remove the saved Model (decision 30).
// ──────────────────────────────────────────────
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Cpu, House, Layers, Search, Shuffle, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  rankModelMatch,
  readChatModelOverride,
  readChatRecentModels,
  type ChatModelChoice,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import {
  connectionKeys,
  usageAtLimit,
  useCachedCatalogFacts,
  useConnections,
  useUpdateConnection,
  type SubscriptionUsage,
} from "../../hooks/use-connections";
import { useChat, useChats, useSetChatModel } from "../../hooks/use-chats";
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
import { accountStateLabel, groupModelsByAccount, recentModels, roleBadges } from "../../lib/connection-groups";
import { cn } from "../../lib/utils";
import { modelBrand, ProviderIcon } from "./ProviderIcon";
import { ConnectionIdentity } from "./ConnectionIdentity";
import { ConnectionModelList } from "./ConnectionModelList";
import { modelRoleLabels } from "./ConnectionRow";
import { ModelRow, ModelTile } from "./ModelRow";
import { modelIdLabel } from "../../lib/connection-identity";
import { ConnectionModelPicker } from "./ConnectionModelPicker";
import { openAddModels } from "../../lib/add-connection";
import { StarText } from "./StarText";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import { starAnchorOf, starsOfRows, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";

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

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error ?? ""));
const rowLabel = (row: SwitcherRow) => row.name || row.model || row.id;
const sameChoice = (a: ChatModelChoice | null | undefined, b: ChatModelChoice | null | undefined) =>
  !!a && !!b && a.connectionId === b.connectionId && (a.model ?? "") === (b.model ?? "");
/** The account and model id a choice runs, so a saved Model and the same catalog pick count as one. */
const runsKey = (choice: ChatModelChoice, rows: readonly SwitcherRow[]) => {
  const row = rows.find((candidate) => candidate.id === choice.connectionId);
  return `${row?.accountId ?? choice.connectionId}\n${choice.model ?? row?.model ?? ""}`;
};

const ROW_CLASS =
  "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-wait max-md:min-h-11 [@media(pointer:coarse)]:min-h-11";

function AccentBar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--marinara-chat-chrome-accent)]"
    />
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-0.5 pt-2 text-[0.6875rem] font-medium text-foreground/45">{children}</p>;
}

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
  recent: recentChoices,
  onApply,
  onDone,
  layout,
  showLocalModel,
  localModelHint,
  shuffle,
  followDefault,
  listHeader,
  listFooter,
  empty,
  autoFocusSearch = false,
  pickerFooter,
  className,
  listClassName,
  modelsClassName,
  catalogBrowse = true,
}: {
  /** What the host uses: a Model, or a catalog model on one ("random" while Shuffle is on). */
  current: ChatModelChoice | null;
  /** The host's last choices; without them Recent lists the Models other chats used last. */
  recent?: readonly ChatModelChoice[];
  /** Points the host (chat or Professor Mari) at the choice. */
  onApply: (choice: ChatModelChoice) => Promise<void>;
  /** Closes the host menu; every pick ends with it. */
  onDone: () => void;
  /**
   * steps: one column; a Connection's Browse opens its catalog in place, with a back button.
   * container: Professor Mari's composer; the list and the current Connection's catalog both render and the host
   * CSS places them, and Browse opens the Add model screen.
   */
  layout: "steps" | "container";
  showLocalModel: boolean;
  localModelHint?: string;
  /** The chat's random-pool mode; absent where there is none (Professor Mari). */
  shuffle?: { active: boolean; onToggle: () => void };
  /** Follow Main: the host follows the Main model; absent where there is no such state (Professor Mari). */
  followDefault?: { active: boolean; onSelect: () => Promise<void> };
  listHeader?: ReactNode;
  /** Below the list, inside its column. */
  listFooter?: ReactNode;
  /** Shown when there is nothing to pick. */
  empty?: ReactNode;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  pickerFooter?: string;
  className?: string;
  listClassName?: string;
  modelsClassName?: string;
  /** False skips catalog search and Browse (Quick Switcher's connection-only mode). */
  catalogBrowse?: boolean;
}) {
  const { t } = useTranslation();
  const { data: connectionsRaw } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const { data: chats } = useChats();
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const openModal = useUIStore((state) => state.openModal);
  // The Connections panel's "Group by" choice applies here too.
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
  /** The Connection whose catalog is open in place (steps layout). */
  const [browsingKey, setBrowsingKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      filterLanguageGenerationConnections((connectionsRaw ?? []) as SwitcherRow[]).filter(
        (row) => !hiddenIds.has(row.id),
      ),
    [connectionsRaw, hiddenIds],
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

  // Cost badges from the catalogs already cached for each Connection; nothing is fetched for them.
  const catalogs = useCachedCatalogFacts(catalogBrowse ? groups.map((group) => group.rows.map((row) => row.id)) : []);
  const catalogOf = (group: SwitcherGroup | undefined) => (group ? catalogs[groups.indexOf(group)] : undefined);

  const mainRow = rows.find((row) => isConnectionFlagTrue(row.isDefault));
  const currentId = current?.connectionId ?? null;
  const currentRow = currentId ? rows.find((row) => row.id === currentId) : undefined;
  const nowRow = currentRow ?? (followDefault?.active ? mainRow : undefined);
  const currentGroup = nowRow ? groupOfRow.get(nowRow.id) : undefined;
  const browsingGroup =
    layout === "steps" && catalogBrowse
      ? groups.find((group) => group.key === browsingKey && group.account)
      : undefined;
  // A catalog pick runs on the Model the chat already uses when it is in that Connection, else on its first one.
  const anchorOf = useCallback(
    (group: SwitcherGroup) => group.rows.find((row) => row.id === nowRow?.id) ?? group.rows[0]!,
    [nowRow?.id],
  );

  useEffect(() => {
    if (!autoFocusSearch || !window.matchMedia?.("(pointer: fine)").matches) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusSearch]);

  const apply = async (entry: Entry) => {
    if (busy) return;
    if (entry.group && unavailableOf(entry.group)) return fix(entry.group);
    setBusy(true);
    try {
      if (!isNow(entry) && !sameChoice(entry.choice, current)) await onApply(entry.choice);
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
      className="mari-connection-btn"
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
      toast.error(t("connections.favorite.failed", { error: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  };
  const starsOf = (group: SwitcherGroup) => starsOfRows(group.rows);
  const starButton = (group: SwitcherGroup, model: string, title: string, starred: boolean) =>
    group.account ? (
      <button
        type="button"
        data-switcher-star={model}
        disabled={busy}
        aria-pressed={starred}
        // A toggle keeps one name; aria-pressed says whether it is a favorite.
        aria-label={t("connections.favorite.toggle", { model: title })}
        title={t(starred ? "connections.favorite.remove" : "connections.favorite.add", { model: title })}
        onClick={() => void toggleStar(group, model, starred, title)}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25",
          starred ? "text-[var(--marinara-chat-chrome-accent)]" : "text-foreground/35 hover:text-foreground/70",
        )}
      >
        <Star size="0.875rem" fill={starred ? "currentColor" : "none"} aria-hidden />
      </button>
    ) : null;

  // Now: what the host runs, or the Main model it follows. Pressing it keeps that state.
  const localEntry: Entry = {
    key: LOCAL_SIDECAR_CONNECTION_ID,
    title: t("connections.switcher.localModel"),
    subtitle: localModelHint ?? t("connections.switcher.localModelHint"),
    choice: { connectionId: LOCAL_SIDECAR_CONNECTION_ID },
  };
  const nowEntry: Entry | null =
    currentId === LOCAL_SIDECAR_CONNECTION_ID
      ? localEntry
      : currentRow && current
        ? entryOfRow(currentRow, currentGroup, current.model ? current : undefined)
        : followDefault?.active && mainRow
          ? entryOfRow(mainRow, groupOfRow.get(mainRow.id))
          : null;
  const nowRuns = nowEntry && nowEntry !== localEntry ? runsKey(nowEntry.choice, rows) : null;
  // Catalog choices name a model on an anchor row. Saved Models keep their own identity and tuning,
  // even when another saved Model under the same Connection has the same provider model id.
  const matchesNow = (choice: ChatModelChoice) =>
    sameChoice(choice, current) ||
    (!!followDefault?.active && choice.connectionId === mainRow?.id && !choice.model) ||
    (!!choice.model && !!nowRuns && runsKey(choice, rows) === nowRuns);
  const isNow = (entry: Entry) => matchesNow(entry.choice);

  const recent = useMemo(() => {
    if (recentChoices) {
      // This chat's last choices that still exist, minus what it uses now.
      return recentChoices.flatMap((choice): Entry[] => {
        if (choice.connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
          return showLocalModel && currentId !== LOCAL_SIDECAR_CONNECTION_ID
            ? [{ key: choice.connectionId, title: t("connections.switcher.localModel"), choice }]
            : [];
        }
        const row = rows.find((candidate) => candidate.id === choice.connectionId);
        if (!row || runsKey(choice, rows) === nowRuns) return [];
        return [
          {
            ...entryOfRow(row, groupOfRow.get(row.id), choice.model ? choice : undefined),
            key: `recent:${row.id}:${choice.model ?? ""}`,
          },
        ];
      });
    }
    return recentModels(chats ?? [], rows, 3, currentId)
      .filter((row) => runsKey({ connectionId: row.id }, rows) !== nowRuns)
      .map((row) => entryOfRow(row, groupOfRow.get(row.id)));
  }, [chats, currentId, groupOfRow, nowRuns, recentChoices, rows, showLocalModel, t]);

  // Your models: each Connection's starred models, plus the saved Models a role or their own settings keep.
  const listed = useMemo(
    () =>
      groups.map((group) => {
        if (!group.account) return { group, entries: group.rows.map((row) => entryOfRow(row, group)) };
        const byModel = new Map<string, Entry>();
        for (const model of starsOfRows(group.rows)) byModel.set(model, entryFor(group, anchorOf(group), model));
        for (const row of group.rows) {
          const kept = row.ownSettings || roleBadges(row).some((role) => role !== "random");
          if (row.model && kept && !byModel.has(row.model)) {
            byModel.set(row.model, entryFor(group, anchorOf(group), row.model));
          }
        }
        return { group, entries: [...byModel.values()] };
      }),
    [anchorOf, groups],
  );

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
      rows.map((row) => {
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
        if (!group || group.rows.some((row) => row.model === hit.model)) return [];
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
    // A pasted id goes to the Connection in use, else the first one.
    const typed = deferredQuery;
    const target = currentGroup?.account ? currentGroup : groups.find((group) => group.account);
    const known = rows.some((row) => row.model === typed) || added.some((entry) => entry.choice.model === typed);
    if (target && !/\s/.test(typed) && !known) {
      added.push({
        key: `use:${typed}`,
        title: t("connections.switcher.useModelId", { model: typed }),
        subtitle: t("connections.switcher.useModelIdOn", { connection: target.name }),
        choice: { connectionId: anchorOf(target).id, model: typed },
      });
    }
    return { saved, extra: added };
  }, [anchorOf, catalog.data, currentGroup, deferredQuery, groupByAccount, groupOfRow, groups, rows, t]);
  const searchEntries = useMemo(() => [...savedHits, ...extraHits], [extraHits, savedHits]);
  const savedCount = savedHits.length;
  const hasCatalogHits = extraHits.some((entry) => !entry.key.startsWith("use:"));
  const searching = deferredQuery.length > 0;

  useEffect(() => setHighlight(0), [deferredQuery]);

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
    entry: Entry,
    {
      index,
      now = false,
      star = "unstarred",
    }: { index?: number; now?: boolean; star?: "all" | "unstarred" | "none" } = {},
  ) => {
    const isCurrent = now || isNow(entry) || sameChoice(entry.choice, current);
    const highlighted = index !== undefined && index === highlight;
    const group = entry.group;
    const unavailable = unavailableOf(group);
    const roleLabels = entry.row ? modelRoleLabels(entry.row, t) : [];
    const starred = group?.account && entry.model ? starsOf(group).has(entry.model) : false;
    const custom = !!entry.row?.ownSettings && !starred && roleLabels.length === 0;
    const showStar = !!group?.account && !!entry.model && (star === "all" || (star === "unstarred" && !starred));
    const stateLabel = unavailable ? t(accountStateLabel({ state: unavailable })) : null;
    const local = entry.choice.connectionId === LOCAL_SIDECAR_CONNECTION_ID;
    const typed = entry.key.startsWith("use:");
    const catalog = catalogOf(group);
    const facts = catalog?.of(entry.model);
    return (
      <ModelRow
        key={entry.key}
        rowProps={{ "data-switcher-row": true, className: "rounded-lg" }}
        data-switcher-entry={entry.choice.model ?? entry.choice.connectionId}
        aria-current={isCurrent ? "true" : undefined}
        aria-label={[
          entry.title,
          entry.subtitle,
          stateLabel ?? roleLabels.join(", "),
          custom && t("connections.row.customSettings"),
        ]
          .filter(Boolean)
          .join(", ")}
        disabled={busy}
        onClick={() => {
          if (unavailable && group) return fix(group);
          if (now) return onDone();
          void apply(entry);
        }}
        onMouseEnter={index !== undefined ? () => setHighlight(index) : undefined}
        className={cn("rounded-lg disabled:cursor-wait", highlighted && "bg-foreground/10")}
        tile={
          typed ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-foreground/50">
              <Search size="0.875rem" aria-hidden />
            </span>
          ) : local ? (
            <ProviderIcon provider="local_model" size="row" dim={!!unavailable} />
          ) : (
            <ModelTile row={entry.row} account={group?.account} model={entry.model} dim={!!unavailable} />
          )
        }
        title={entry.title}
        subtitle={entry.subtitle}
        roles={roleLabels}
        status={
          stateLabel
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
        trailing={isCurrent && <Check size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
        end={
          <>
            {now && unavailable && group && fixButton(group)}
            {showStar && starButton(group!, entry.model!, entry.title, starred)}
          </>
        }
      />
    );
  };

  const browse = (group: SwitcherGroup) => {
    if (layout === "steps") {
      setBrowsingKey(group.key);
      return;
    }
    // Professor Mari's composer: the big model screen for this Connection (decision 32); the menu closes under it.
    const anchor = anchorOf(group);
    onDone();
    openAddModels({
      accountId: group.account!.id,
      connectionId: anchor.id,
      chat: {
        currentModel: anchor === currentRow ? (current?.model ?? anchor.model ?? null) : null,
        onChoose: (choice) => (sameChoice(choice, current) ? Promise.resolve() : onApply(choice)),
      },
    });
  };
  const backFromCatalog = () => {
    const key = browsingKey;
    setBrowsingKey(null);
    window.requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>(`[data-switcher-browse="${CSS.escape(key ?? "")}"]`)?.focus(),
    );
  };

  const renderGroup = ({ group, entries }: { group: SwitcherGroup; entries: Entry[] }) => {
    const shown = entries.filter((entry) => !isNow(entry));
    // A standalone Model has no Connection to browse: it is its own line.
    if (!group.account) {
      return shown.length > 0 ? (
        <div key={group.key}>{shown.map((entry) => renderEntry(entry, { star: "all" }))}</div>
      ) : null;
    }
    const unavailable = unavailableOf(group);
    return (
      <section
        key={group.key}
        className="mari-connection-group mt-1"
        data-switcher-section="connection"
        aria-label={group.name}
      >
        <div data-connection-group={group.key} className="flex min-w-0 items-center gap-2 rounded-lg py-1.5 ps-3 pe-1">
          <ConnectionIdentity
            account={group.account}
            rows={group.rows}
            count={shown.length ? t("connections.list.models", { count: shown.length }) : undefined}
            state={group.account.state}
            stateLabel={t(accountStateLabel(group.account))}
            size="sm"
            className="flex-1"
          />
          {unavailable && fixButton(group)}
        </div>
        <ConnectionModelList
          provider={group.account.provider}
          rows={shown}
          getKey={(entry) => entry.key}
          renderRow={(entry, upstream) =>
            renderEntry({ ...entry, subtitle: modelIdLabel(entry.model, upstream) }, { star: "all" })
          }
          footer={
            // Favorites first; every other model of this Connection is one visible row away, not a header word.
            !unavailable &&
            catalogBrowse && (
              <button
                type="button"
                data-switcher-browse={group.key}
                onClick={() => browse(group)}
                aria-label={t("connections.switcher.browseConnection", { connection: group.name })}
                className={cn(
                  ROW_CLASS,
                  "mari-connection-model-well min-h-11 gap-3 ps-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                  <Layers size="0.875rem" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {catalogOf(group)?.count
                    ? t("connections.switcher.allModelsCount", { count: catalogOf(group)!.count })
                    : t("connections.switcher.allModels")}
                </span>
                <ChevronRight size="0.875rem" aria-hidden className="shrink-0" />
              </button>
            )
          }
        />
      </section>
    );
  };

  // Group by folder: each folder's saved Models, then the ones in none; a row names its Connection.
  const folderSections = () => {
    const known = new Set((folders ?? []).map((folder) => folder.id));
    return [...(folders ?? []), null].map((folder) => {
      const entries = rows
        .filter((row) => (folder ? row.folderId === folder.id : !row.folderId || !known.has(row.folderId)))
        .map((row) => entryOfRow(row, groupOfRow.get(row.id)))
        .filter((entry) => !isNow(entry));
      if (entries.length === 0) return null;
      const name = folder?.name ?? t("connections.folders.none");
      return (
        <section
          key={folder?.id ?? "none"}
          className="mari-connection-group mt-1"
          data-switcher-section="folder"
          aria-label={name}
        >
          <div className="flex min-w-0 items-center gap-2 py-1.5 ps-3 pe-1">
            <span
              aria-hidden
              className={cn("h-2 w-2 shrink-0 rounded-full", !folder?.color && "border border-foreground/40")}
              style={folder?.color ? { backgroundColor: folder.color } : undefined}
            />
            <strong className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</strong>
          </div>
          <div className="mari-connection-model-well">
            {entries.map((entry) => renderEntry(entry, { star: "all" }))}
          </div>
        </section>
      );
    });
  };

  // Follow Main: names the model the chat would follow. In Now while it does, else offered under it.
  const followRow = (active: boolean) =>
    followDefault && (
      <button
        type="button"
        data-switcher-default
        aria-current={active ? "true" : undefined}
        disabled={busy}
        onClick={() => {
          if (active) return onDone();
          setBusy(true);
          void followDefault
            .onSelect()
            .then(onDone)
            .catch((error) => toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) })))
            .finally(() => setBusy(false));
        }}
        className={cn(ROW_CLASS, active && "bg-foreground/[0.07] font-semibold")}
      >
        {active && <AccentBar />}
        {mainRow ? (
          <ProviderIcon
            provider={mainRow.provider ?? "custom"}
            model={mainRow.model}
            name={groupOfRow.get(mainRow.id)?.name}
            icon={mainRow.icon}
            imagePath={mainRow.imagePath}
            size="sm"
          />
        ) : (
          <House size="0.875rem" className="mx-[0.3125rem] shrink-0 text-foreground/55" aria-hidden />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{t("connections.switcher.followMain")}</span>
          <span className="truncate text-[0.625rem] font-normal text-foreground/50">
            {mainRow
              ? t("connections.switcher.followMainHint", { model: rowLabel(mainRow) })
              : t("connections.switcher.noMain")}
          </span>
        </span>
        {active && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
      </button>
    );

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
      <Shuffle size="0.875rem" className="mx-[0.3125rem] shrink-0 text-foreground/55" aria-hidden />
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
    <label className="mx-1 mb-1 flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 text-foreground/55 focus-within:border-foreground/25 md:min-h-9">
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

  // The catalog of one Connection through the Model a pick runs on. Only what the chat runs looks current there.
  const pickerConnectionOf = (group: SwitcherGroup) => {
    const anchor = anchorOf(group);
    return {
      ...anchor,
      // A pick runs on the chat's Model; the stars come from the Connection's anchor.
      pinnedModels: (starAnchorOf(group.rows) ?? anchor).pinnedModels,
      model:
        anchor === currentRow
          ? (current?.model ?? anchor.model)
          : followDefault?.active && mainRow && group.rows.some((row) => row.id === mainRow.id)
            ? mainRow.model
            : null,
    };
  };
  const onChoose = (choice: ChatModelChoice) => (matchesNow(choice) ? Promise.resolve() : onApply(choice));

  const nothing = groups.length === 0 && !showLocalModel;
  const nowLabel = followDefault
    ? t(followDefault.active ? "connections.switcher.nowFollowsMain" : "connections.switcher.nowThisChat")
    : t("connections.switcher.now");
  // Now stays in sight while the list scrolls; the host's opaque surface colour backs it.
  const nowSection = (nowEntry || followDefault?.active) && (
    <section
      data-switcher-section="now"
      aria-label={nowLabel}
      className={cn(
        "mb-1 border-b border-foreground/10 pb-1",
        layout === "steps" && "sticky top-0 z-[1] bg-[var(--mari-chat-existing-bg,var(--background))]",
      )}
    >
      <SectionLabel>{nowLabel}</SectionLabel>
      {nowEntry ? renderEntry(nowEntry, { now: true }) : followRow(true)}
    </section>
  );

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

  const list = browsingGroup ? (
    <div data-switcher-catalog={browsingGroup.key} className={cn("flex min-h-0 flex-1 flex-col", listClassName)}>
      <div className="shrink-0 border-b border-foreground/10 p-1">
        <button
          type="button"
          data-switcher-back
          onClick={backFromCatalog}
          className={cn(ROW_CLASS, "w-auto text-foreground/70")}
        >
          <ChevronLeft size="0.875rem" className="shrink-0" aria-hidden />
          {t("connections.switcher.back")}
        </button>
      </div>
      {usageOf(browsingGroup)}
      <ConnectionModelPicker
        key={browsingGroup.key}
        connection={pickerConnectionOf(browsingGroup)}
        onChoose={onChoose}
        accountName={browsingGroup.name}
        footer={null}
        autoFocusSearch
        onPicked={onDone}
      />
    </div>
  ) : (
    <div data-switcher-list className={cn("flex min-h-0 flex-col", layout === "steps" && "flex-1", listClassName)}>
      {listHeader}
      {!shuffle?.active && !nothing && <div className="shrink-0 pt-1">{searchBox}</div>}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1">
        {shuffle?.active ? (
          poolList
        ) : nothing ? (
          (empty ?? (
            <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
              {t("ui.chat.quickconnectionswitcher.noConnectionsFound")}
            </div>
          ))
        ) : searching ? (
          <div data-switcher-results>
            {searchEntries.slice(0, savedCount).map((entry, index) => renderEntry(entry, { index, star: "all" }))}
            {hasCatalogHits && <SectionLabel>{t("connections.switcher.notStarred")}</SectionLabel>}
            {searchEntries
              .slice(savedCount)
              .map((entry, index) => renderEntry(entry, { index: savedCount + index, star: "all" }))}
            {searchEntries.length === 0 && (
              <p className="px-3 py-3 text-[0.6875rem] text-foreground/50">
                {t(catalog.isFetching ? "connections.switcher.searching" : "connections.switcher.noMatches")}
              </p>
            )}
          </div>
        ) : (
          <>
            {nowSection}
            {followDefault && !followDefault.active && followRow(false)}
            {recent.length > 0 && (
              <section data-switcher-section="recent" aria-label={t("connections.switcher.recent")}>
                <SectionLabel>{t("connections.switcher.recent")}</SectionLabel>
                {recent.map((entry) => renderEntry(entry))}
              </section>
            )}
            {byFolder ? folderSections() : listed.map(renderGroup)}
            {(showLocalModel || shuffleRow) && (
              <div className="mt-1 border-t border-foreground/10 pt-1">
                {showLocalModel && currentId !== LOCAL_SIDECAR_CONNECTION_ID && renderEntry(localEntry)}
                {shuffleRow}
              </div>
            )}
          </>
        )}
      </div>
      {listFooter}
    </div>
  );

  // Professor Mari's composer keeps the current Connection's catalog beside the list on wide screens.
  const pickerGroup = currentGroup?.account ? currentGroup : undefined;
  const models =
    layout !== "container" || shuffle?.active ? null : (
      <div data-quick-connection-models className={cn("flex min-h-0 min-w-0 flex-1 flex-col", modelsClassName)}>
        {usageOf(pickerGroup)}
        {pickerGroup ? (
          <ConnectionModelPicker
            key={pickerGroup.key}
            connection={pickerConnectionOf(pickerGroup)}
            onChoose={onChoose}
            accountName={pickerGroup.name}
            footer={pickerFooter}
            onPicked={onDone}
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

  // One footer line; the composer menu keeps the picker's own line.
  const footer = layout !== "container" && (
    <p className="shrink-0 border-t border-foreground/10 px-3 py-2 text-[0.625rem] text-foreground/50">
      <StarText text={pickerFooter ?? t("connections.switcher.appliesToChatStars")} />
    </p>
  );

  if (layout === "steps") {
    return (
      <div
        ref={rootRef}
        data-connection-switcher
        onKeyDown={(event) => {
          if (event.key === "Escape" && browsingKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            event.stopPropagation();
            backFromCatalog();
          }
        }}
        className={cn("mari-connection-scope flex min-h-0 min-w-0 flex-1 flex-col", className)}
      >
        {list}
        {footer}
      </div>
    );
  }
  return (
    <div ref={rootRef} data-connection-switcher className={cn("mari-connection-scope contents", className)}>
      {list}
      {models}
    </div>
  );
}
