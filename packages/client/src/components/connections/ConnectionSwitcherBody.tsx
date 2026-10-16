// ──────────────────────────────────────────────
// Connection Switcher Body — the quick switch shared by the desktop popover,
// the phone sheet and Professor Mari's composer. Left: search across saved
// Models and catalogs, Use default, Favorites, Recent, Connections (each opens
// in place with its saved Models), Local Model, Shuffle. Right (wide hosts
// only): the chosen Connection's catalog. A catalog pick applies to the chat
// only; the star saves a model, and removing it can remove the saved Model
// (decision 30).
// ──────────────────────────────────────────────
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, Cpu, House, Link, Search, Shuffle, Star } from "lucide-react";
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
import { connectionKeys, useConnections, useUpdateConnection } from "../../hooks/use-connections";
import { useChat, useChats, useSetChatModel } from "../../hooks/use-chats";
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
import { openAddModels } from "../../lib/add-connection";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import { starAnchorOf, starsOfRows, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";

type SwitcherRow = {
  id: string;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
  accountId?: string | null;
  credentialsFromConnectionId?: string | null;
  pinnedModels?: unknown;
  createdAt?: string | null;
  useForRandom?: boolean | string | null;
  isDefault?: boolean | string | null;
  showUsageWidget?: unknown;
  showUsageFiveHour?: unknown;
  showUsageWeekly?: unknown;
  profileImportReviewRequired?: unknown;
};

/** A Connection as the list shows it: an account with its chat Models, or a standalone Model on its own. */
type SwitcherGroup = { key: string; account: ConnectionAccountListItem | null; name: string; rows: SwitcherRow[] };

/** A pickable line: a saved Model, or a catalog model run on one of the Connection's Models (decision 26). */
type Entry = { key: string; title: string; subtitle?: string; choice: ChatModelChoice };

/** A model id under a Connection: its saved Model when there is one, otherwise a per-chat pick on `anchor`. */
function entryFor(group: SwitcherGroup, anchor: SwitcherRow, model: string, title?: string): Entry {
  const saved = group.rows.find((row) => row.model === model);
  return saved
    ? { key: saved.id, title: rowLabel(saved), subtitle: group.name, choice: { connectionId: saved.id } }
    : {
        key: `${group.key}:${model}`,
        title: title || model,
        subtitle: group.name,
        choice: { connectionId: anchor.id, model, ...(title && title !== model ? { name: title } : {}) },
      };
}

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
  empty,
  autoFocusSearch = false,
  pickerFooter,
  className,
  listClassName,
  modelsClassName,
}: {
  /** What the host uses: a Model, or a catalog model on one ("random" while Shuffle is on). */
  current: ChatModelChoice | null;
  /** The host's last choices; without them Recent lists the Models other chats used last. */
  recent?: readonly ChatModelChoice[];
  /** Points the host (chat or Professor Mari) at the choice. */
  onApply: (choice: ChatModelChoice) => Promise<void>;
  /** Closes the host menu; every pick ends with it. */
  onDone: () => void;
  /** columns: both panes side by side. steps: the list only (a Connection's models open in the Add model screen). container: both rendered, host CSS decides. */
  layout: "columns" | "steps" | "container";
  showLocalModel: boolean;
  localModelHint?: string;
  /** The chat's random-pool mode; absent where there is none (Professor Mari). */
  shuffle?: { active: boolean; onToggle: () => void };
  /** "Use default": the host follows the Main model; absent where there is no such state (Professor Mari). */
  followDefault?: { active: boolean; onSelect: () => Promise<void> };
  listHeader?: ReactNode;
  /** Shown when there is nothing to pick. */
  empty?: ReactNode;
  /** Focus the search box on devices with a mouse (a phone keyboard would cover the list). */
  autoFocusSearch?: boolean;
  pickerFooter?: string;
  className?: string;
  listClassName?: string;
  modelsClassName?: string;
}) {
  const { t } = useTranslation();
  const { data: connectionsRaw } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const { data: chats } = useChats();
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const updateConnection = useUpdateConnection();
  const modelStar = useModelStar();
  const hiddenIds = useHiddenModelIds();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [highlight, setHighlight] = useState(0);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

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

  const currentId = current?.connectionId ?? null;
  const currentRow = currentId ? rows.find((row) => row.id === currentId) : undefined;
  const currentGroup = currentRow ? groupOfRow.get(currentRow.id) : undefined;
  const shownGroup = groups.find((group) => group.key === shownKey) ?? currentGroup;
  // A catalog pick runs on the Model the chat already uses when it is in that Connection, else on its first one.
  const anchorOf = useCallback(
    (group: SwitcherGroup) => group.rows.find((row) => row.id === currentId) ?? group.rows[0]!,
    [currentId],
  );

  useEffect(() => {
    if (!autoFocusSearch || !window.matchMedia?.("(pointer: fine)").matches) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusSearch]);

  const apply = async (entry: Entry) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!sameChoice(entry.choice, current)) await onApply(entry.choice);
      onDone();
    } catch (error) {
      toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  };

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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-foreground/25 max-md:h-11 max-md:w-11",
          starred ? "text-[var(--marinara-chat-chrome-accent)]" : "text-foreground/35 hover:text-foreground/70",
        )}
      >
        <Star size="0.875rem" fill={starred ? "currentColor" : "none"} aria-hidden />
      </button>
    ) : null;

  // ★ Favorites: the stars of every Connection, read from its anchor Model.
  const favourites = useMemo(
    () =>
      groups.flatMap((group) => {
        if (!group.account) return [];
        return [...starsOfRows(group.rows)].map((model) => ({
          group,
          model,
          entry: entryFor(group, anchorOf(group), model),
        }));
      }),
    [anchorOf, groups],
  );
  const recent = useMemo(() => {
    if (recentChoices) {
      // This chat's last choices that still exist, minus what it uses now.
      const currentRuns = current ? runsKey(current, rows) : null;
      return recentChoices.flatMap((choice): Entry[] => {
        if (choice.connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
          return showLocalModel
            ? [{ key: choice.connectionId, title: t("connections.switcher.localModel"), choice }]
            : [];
        }
        const row = rows.find((candidate) => candidate.id === choice.connectionId);
        if (!row || runsKey(choice, rows) === currentRuns) return [];
        const title = choice.model ? (choice.name ?? choice.model) : rowLabel(row);
        const key = `recent:${choice.connectionId}:${choice.model ?? ""}`;
        return [{ key, title, subtitle: groupOfRow.get(row.id)?.name, choice }];
      });
    }
    const shown = new Set(favourites.map(({ entry }) => (entry.choice.model ? null : entry.choice.connectionId)));
    return recentModels(chats ?? [], rows, 3, currentId)
      .filter((row) => !shown.has(row.id))
      .map((row): Entry => ({
        key: row.id,
        title: rowLabel(row),
        subtitle: groupOfRow.get(row.id)?.name,
        choice: { connectionId: row.id },
      }));
  }, [chats, current, currentId, favourites, groupOfRow, recentChoices, rows, showLocalModel, t]);

  // Search (decision 27): saved Models first (starred, then the rest), then catalog models not saved yet, each
  // with prefix matches before the rest, then the typed text as a model id.
  const catalog = useCatalogSearch(deferredQuery);
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
        return {
          rank: rankModelMatch(q, model, { saved: true, starred: starredIn(group, row.model) }),
          text: rankModelMatch(q, model),
          item: {
            key: row.id,
            title: rowLabel(row),
            subtitle: group?.name,
            choice: { connectionId: row.id },
          } as Entry,
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
    // A pasted id goes to the Connection in use, or the one on show.
    const typed = deferredQuery;
    const target = [currentGroup, shownGroup].find((group) => group?.account);
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
  }, [anchorOf, catalog.data, currentGroup, deferredQuery, groupByAccount, groupOfRow, rows, shownGroup, t]);
  const searchEntries = useMemo(() => [...savedHits, ...extraHits], [extraHits, savedHits]);
  const savedCount = savedHits.length;
  const hasCatalogHits = extraHits.some((entry) => !entry.key.startsWith("use:"));
  const searching = deferredQuery.length > 0;

  useEffect(() => setHighlight(0), [deferredQuery]);

  const renderEntry = (entry: Entry, index?: number, trailing?: ReactNode) => {
    const isCurrent = sameChoice(entry.choice, current);
    const highlighted = index !== undefined && index === highlight;
    const button = (
      <button
        type="button"
        key={entry.key}
        data-switcher-entry={entry.choice.model ?? entry.choice.connectionId}
        aria-current={isCurrent ? "true" : undefined}
        disabled={busy}
        onClick={() => void apply(entry)}
        onMouseEnter={index !== undefined ? () => setHighlight(index) : undefined}
        className={cn(ROW_CLASS, isCurrent && "bg-foreground/[0.07] font-semibold", highlighted && "bg-foreground/10")}
      >
        {isCurrent && <AccentBar />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{entry.title}</span>
          {entry.subtitle && (
            <span className="truncate text-[0.625rem] font-normal text-foreground/50">{entry.subtitle}</span>
          )}
        </span>
        {isCurrent && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
      </button>
    );
    return trailing ? (
      <div key={entry.key} className="flex items-center">
        {button}
        {trailing}
      </div>
    ) : (
      button
    );
  };

  const renderGroup = (group: SwitcherGroup) => {
    const isCurrent = group === currentGroup;
    const isShown = layout !== "steps" && group === shownGroup;
    // Every Connection is collapsed except the one in use; a standalone Model has nothing to open.
    const isOpen = !!group.account && (openKeys[group.key] ?? isCurrent);
    const state = group.account && group.account.state !== "ok" ? t(accountStateLabel(group.account)) : null;
    const override = isCurrent && current?.model ? current : null;
    return (
      <div key={group.key}>
        <button
          type="button"
          data-connection-option={isCurrent && currentRow ? currentRow.id : group.rows[0]!.id}
          data-connection-group={group.key}
          aria-current={isCurrent ? "true" : undefined}
          aria-expanded={group.account ? isOpen : undefined}
          // A standalone Model has no Connection to browse, so picking it switches the chat to it.
          onClick={() => {
            if (!group.account) {
              void apply({ key: group.key, title: group.name, choice: { connectionId: group.rows[0]!.id } });
              return;
            }
            setOpenKeys((keys) => ({ ...keys, [group.key]: !isOpen }));
            if (!isOpen && layout === "columns") setShownKey(group.key);
          }}
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
          {group.account && (
            <ChevronDown
              size="0.875rem"
              className={cn("shrink-0 text-foreground/40 transition-transform", !isOpen && "-rotate-90")}
              aria-hidden
            />
          )}
        </button>
        {isOpen && (
          <div className="pl-3" data-switcher-group-models={group.key}>
            {override &&
              renderEntry(
                {
                  key: `override:${override.model}`,
                  title: override.name ?? override.model!,
                  subtitle: t("connections.switcher.thisChatOnly"),
                  choice: override,
                },
                undefined,
                starButton(
                  group,
                  override.model!,
                  override.name ?? override.model!,
                  starsOf(group).has(override.model!),
                ),
              )}
            {subgroupByUpstream(group.rows).map((sub) => (
              <div key={sub.upstream ?? ""}>
                {sub.upstream && <SectionLabel>{sub.upstream}</SectionLabel>}
                {sub.rows.map((row) =>
                  renderEntry(
                    {
                      key: row.id,
                      title: rowLabel(row),
                      // The upstream is the heading above, so the id drops it (as on the panel cards).
                      subtitle:
                        sub.upstream && row.model?.startsWith(`${sub.upstream}/`)
                          ? row.model.slice(sub.upstream.length + 1)
                          : (row.model ?? undefined),
                      choice: { connectionId: row.id },
                    },
                    undefined,
                    row.model ? starButton(group, row.model, rowLabel(row), starsOf(group).has(row.model)) : undefined,
                  ),
                )}
              </div>
            ))}
            <button
              type="button"
              data-switcher-browse={group.key}
              // The big model screen for this Connection (decision 32); the menu closes under it.
              onClick={() => {
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
              }}
              className={cn(ROW_CLASS, "text-foreground/65")}
            >
              <span className="min-w-0 flex-1 truncate">{t("connections.switcher.browseAll")}</span>
              <ChevronRight size="0.875rem" className="shrink-0 text-foreground/40" aria-hidden />
            </button>
          </div>
        )}
      </div>
    );
  };

  // "Use default (model name)": names the model the chat would follow.
  const mainRow = rows.find((row) => isConnectionFlagTrue(row.isDefault));
  const defaultRow = followDefault && (
    <button
      type="button"
      data-switcher-default
      aria-current={followDefault.active ? "true" : undefined}
      disabled={busy}
      onClick={() => {
        if (followDefault.active) return onDone();
        setBusy(true);
        void followDefault
          .onSelect()
          .then(onDone)
          .catch((error) => toast.error(t("connections.switcher.pickFailed", { error: errorMessage(error) })))
          .finally(() => setBusy(false));
      }}
      className={cn(ROW_CLASS, followDefault.active && "bg-foreground/[0.07] font-semibold")}
    >
      {followDefault.active && <AccentBar />}
      <House size="0.875rem" className="shrink-0 text-foreground/55" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          {mainRow
            ? t("connections.switcher.useDefault", { model: rowLabel(mainRow) })
            : t("connections.switcher.useDefaultNone")}
        </span>
        <span className="truncate text-[0.625rem] font-normal text-foreground/50">
          {t("connections.switcher.useDefaultHint")}
        </span>
      </span>
      {followDefault.active && <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />}
    </button>
  );

  const localEntry: Entry = {
    key: LOCAL_SIDECAR_CONNECTION_ID,
    title: t("connections.switcher.localModel"),
    subtitle: localModelHint ?? t("connections.switcher.localModelHint"),
    choice: { connectionId: LOCAL_SIDECAR_CONNECTION_ID },
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
                {defaultRow}
                {favourites.length > 0 && (
                  <section data-switcher-section="favourites" aria-label={t("connections.switcher.favourites")}>
                    <SectionLabel>
                      <Star size="0.625rem" className="mr-1 inline align-[-1px]" fill="currentColor" aria-hidden />
                      {t("connections.switcher.favourites")}
                    </SectionLabel>
                    {favourites.map(({ group, model, entry }) =>
                      renderEntry(entry, undefined, starButton(group, model, entry.title, true)),
                    )}
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

  // The catalog shows the chosen Connection through the Model a pick runs on. Only what the chat runs looks
  // current there. A standalone Model gets no catalog.
  const pickerRow = shownGroup ? anchorOf(shownGroup) : undefined;
  const pickerConnection =
    pickerRow && shownGroup?.account
      ? {
          ...pickerRow,
          // A pick runs on the chat's Model; the stars come from the Connection's anchor.
          pinnedModels: (starAnchorOf(shownGroup.rows) ?? pickerRow).pinnedModels,
          model: pickerRow === currentRow ? (current?.model ?? pickerRow.model) : null,
        }
      : undefined;
  const usageRow = pickerRow ? resolveUsageConnection(rows, pickerRow.id) : null;

  const models =
    shuffle?.active || layout === "steps" ? null : (
      <div data-quick-connection-models className={cn("flex min-h-0 min-w-0 flex-1 flex-col", modelsClassName)}>
        {usageRow && (
          <div className="border-b border-foreground/10 px-3 pt-1">
            <SubscriptionUsageWidget connectionId={usageRow.id} variant="inline" />
          </div>
        )}
        {pickerConnection ? (
          <ConnectionModelPicker
            key={pickerConnection.id}
            connection={pickerConnection}
            onChoose={(choice) => (sameChoice(choice, current) ? Promise.resolve() : onApply(choice))}
            accountName={shownGroup?.account?.name}
            footer={layout === "container" ? pickerFooter : null}
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

  // One footer for both columns, and on both phone steps. The composer menu keeps the picker's own line.
  const footer = layout !== "container" && (
    <p className="shrink-0 border-t border-foreground/10 px-3 py-2 text-[0.625rem] text-foreground/50">
      {pickerFooter ?? t("connections.switcher.appliesToChat")}
    </p>
  );

  if (layout === "columns") {
    return (
      <div data-connection-switcher className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
        <div className="flex min-h-0 min-w-0 flex-1">
          {list}
          {models}
        </div>
        {footer}
      </div>
    );
  }
  return (
    <div data-connection-switcher className={cn("contents", className)}>
      {list}
      {models}
      {footer}
    </div>
  );
}
