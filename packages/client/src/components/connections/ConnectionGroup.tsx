// ──────────────────────────────────────────────
// ConnectionGroup — a Connection card: a heading that folds the card (name, model count, host, one status
// word), its ⋯ menu ("Edit connection" first) and its model well.
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { ConnectionModelList } from "./ConnectionModelList";
import { ConnectionIdentity } from "./ConnectionIdentity";
import { getConnectionIdentity, modelSubtitle } from "../../lib/connection-identity";
import {
  ChevronDown,
  Copy,
  ImageIcon,
  ListChecks,
  KeyRound,
  MoreHorizontal,
  Plus,
  Power,
  Settings2,
  Trash2,
  Wifi,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  PROVIDERS,
  type APIProvider,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import {
  useCachedCatalogFacts,
  useDeleteConnection,
  useMoveConnection,
  useTestConnection,
  type CachedCatalogFacts,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useDeleteConnectionAccount,
  useDuplicateConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { starAnchorOf } from "../../hooks/use-model-star";
import { sortByModelId } from "../../lib/connection-groups";
import { useUIStore } from "../../stores/ui.store";
import { openAddModels } from "../../lib/add-connection";
import { cn } from "../../lib/utils";
import { ContextMenu } from "../ui/ContextMenu";
import { showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { CompactUsageMeter } from "./SubscriptionUsageWidget";
import { resolveUsageConnection } from "../../lib/connection-filters";
import { SMALL_ACTION } from "./DeviceDetail";
import {
  confirmAccountDelete,
  deleteAccountModels,
  menuAt,
  modelRoleLabels,
  ROW_BUTTON,
  type ConnectionRowData,
  type MenuAt,
} from "./ConnectionRow";

/** A block in the Connections list: a tint and spacing, no outline. */
export const GROUP_SURFACE = "rounded-xl bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]";

/** The host a Connection talks to. */
export function hostOf(url: string | null | undefined): string {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return url?.trim() ?? "";
  }
}

export function ConnectionGroup({
  account,
  rows,
  visibleRows = rows,
  renderRow,
  open,
  onToggle,
  tile,
  onPictureClick,
}: {
  account: ConnectionAccountListItem;
  rows: ConnectionRowData[];
  /** The Models the filter and search keep; `rows` still picks the anchor Model for Add model and the stars. */
  visibleRows?: ConnectionRowData[];
  renderRow: (row: ConnectionRowData, subtitle: string, catalog: CachedCatalogFacts) => ReactNode;
  open: boolean;
  onToggle: () => void;
  tile: ReactNode;
  /** The heading's tile becomes its own button that opens the picture menu. */
  onPictureClick?: (at: MenuAt) => void;
  /** Provider identity is part of each account heading, without an enclosing family header. */
  providerName?: string;
}) {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const updateAccount = useUpdateConnectionAccount();
  const removeAccount = useDeleteConnectionAccount();
  const duplicateAccount = useDuplicateConnectionAccount();
  const { data: accounts } = useConnectionAccounts();
  const moveModel = useMoveConnection();
  const deleteModel = useDeleteConnection();
  /** Select mode: the ids of the checked Models; null while the card shows its normal rows. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const test = useTestConnection();
  const [menu, setMenu] = useState<MenuAt | null>(null);
  // Cost badges read this Connection's saved model list (one request per card, answered from the server's copy).
  const [catalog] = useCachedCatalogFacts([rows.map((row) => row.id)]);
  const usage = resolveUsageConnection([account], account.id);

  // The anchor Model: Add model shows and keeps the Connection's stars on it.
  const chatRow = starAnchorOf(rows) ?? null;
  const firstRow = chatRow ?? rows[0] ?? null;
  // Decision 20: an image Model on the same vendor key joins this Connection, so it needs no key of its own.
  const imageSource = chatRow
    ? IMAGE_GENERATION_SOURCES.find((source) => IMAGE_SOURCE_VENDOR[source.id] === account.provider)
    : undefined;
  const addImageModel = () => openAddModels({ accountId: account.id, kind: "image" });
  // The sidebar's main door is "+ Add" at the top; the card's ⋯ menu is the per-Connection one.
  const addModels = () => openAddModels({ accountId: account.id, connectionId: chatRow?.id });
  const rolesOf = (row: ConnectionRowData) => modelRoleLabels(row, t);
  const editAccount = () => openModal("connection-account", { accountId: account.id });
  const replaceKey = () => openModal("connection-account", { accountId: account.id, replaceKey: true });
  const runTest = () =>
    firstRow &&
    test.mutate(firstRow.id, {
      onSuccess: (result) =>
        result.success
          ? toast.success(t("connections.accounts.testOk", { latency: result.latencyMs }))
          : toast.error(result.message || t("connections.accounts.testFailed")),
      onError: () => toast.error(t("connections.accounts.testFailed")),
    });
  const deleteAccount = async () => {
    if (!(await confirmAccountDelete(account.name, rows, t))) return;
    try {
      await deleteAccountModels(rows);
      await removeAccount.mutateAsync(account.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.accounts.editor.deleteFailed"));
    }
  };
  const pickedRows = picked ? rows.filter((row) => picked.has(row.id)) : [];
  const nameOf = (row: ConnectionRowData) => row.name?.trim() || row.model || row.id;
  // ponytail: same-service targets only (same host for custom); a move to another service needs a catalog model per
  // Model, which the single-Model Move dialog asks for.
  const moveTargets = (accounts ?? []).filter(
    (item) =>
      item.id !== account.id &&
      item.provider === account.provider &&
      (account.provider !== "custom" || hostOf(item.baseUrl) === hostOf(account.baseUrl)),
  );
  const runBulk = async (each: (row: ConnectionRowData) => Promise<unknown>) => {
    setBulkBusy(true);
    try {
      for (const row of pickedRows) await each(row);
      setPicked(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBulkBusy(false);
    }
  };
  const moveSelected = async () => {
    const target = await showChoiceDialog({
      title: t("connections.accounts.select.moveTitle", { count: pickedRows.length }),
      message: t("connections.accounts.select.moveMessage"),
      choices: moveTargets.map((item) => ({ key: item.id, label: item.name })),
      cancelLabel: t("connections.accounts.editor.cancel"),
    });
    if (target) await runBulk((row) => moveModel.mutateAsync({ id: row.id, accountId: target }));
  };
  const deleteSelected = async () => {
    const ok = await showConfirmDialog({
      title: t("connections.accounts.select.deleteTitle", { count: pickedRows.length }),
      message: t("connections.accounts.select.deleteMessage", {
        count: pickedRows.length,
        models: pickedRows.map(nameOf).join(", "),
      }),
      confirmLabel: t("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (ok) await runBulk((row) => deleteModel.mutateAsync(row.id));
  };
  const service = PROVIDERS[account.provider as APIProvider]?.name ?? account.provider;
  const state = t(`connections.accounts.state.${account.state}`);
  const identity = getConnectionIdentity(account, rows);
  const heading = identity.name;
  const accountLabel = identity.accountLabel;
  const endpoint = identity.endpoint;
  const count = t("connections.list.models", { count: visibleRows.length });
  const modelsId = `connection-models-${account.id}`;
  // One status word: Ready is plain text; Needs key and Off are the word itself as the fix.
  const fix =
    account.state === "needs_key"
      ? {
          label: state,
          aria: t("connections.list.addKeyFor", { name: account.name }),
          run: editAccount,
        }
      : account.state === "off"
        ? {
            label: state,
            aria: t("connections.list.turnOn", { name: account.name }),
            run: () => updateAccount.mutate({ id: account.id, enabled: true }),
          }
        : null;
  return (
    <div
      role="group"
      className="mari-connection-group flex min-w-0 flex-col"
      data-connection-account-id={account.id}
      aria-label={account.name}
    >
      <div className="mari-connection-card-head flex min-w-0 items-center rounded-lg">
        {onPictureClick && (
          <button
            type="button"
            onClick={(event) => onPictureClick(menuAt(event))}
            aria-label={t("connections.picture.change", { name: account.name })}
            title={t("connections.picture.change", { name: account.name })}
            // The padding grows the hit area to 2.75rem; the negative margin keeps the tile on the card's edge.
            className="-m-0.5 flex shrink-0 items-center justify-center rounded-xl p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          >
            {tile}
          </button>
        )}
        <button
          type="button"
          data-connections-row={`account:${account.id}`}
          data-connection-group-heading
          // The heading is the fold.
          data-connections-toggle={account.id}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={modelsId}
          aria-label={
            account.state === "ok"
              ? [heading, accountLabel, endpoint, count].filter(Boolean).join(", ")
              : t("connections.list.rowLabel", {
                  name: [heading, accountLabel, endpoint, count].filter(Boolean).join(", "),
                  state,
                })
          }
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pe-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
            // Header text starts on the rows' text column: 0.5rem card padding + 2.5rem tile + 0.75rem.
            onPictureClick && "ps-3",
          )}
        >
          <ConnectionIdentity
            account={account}
            rows={rows}
            count={count}
            state={fix ? undefined : account.state}
            stateLabel={state}
            billing={account.billing}
            icon={onPictureClick ? false : tile}
            className="flex-1"
          />
        </button>
        {fix && (
          <button type="button" onClick={fix.run} aria-label={fix.aria} className={cn(SMALL_ACTION, "shrink-0")}>
            {fix.label}
          </button>
        )}
        <button
          type="button"
          onClick={(event) => setMenu(menuAt(event))}
          className={cn(ROW_BUTTON, "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
          title={t("connections.accounts.row.actions", { name: account.name })}
          aria-label={t("connections.accounts.row.actions", { name: account.name })}
          aria-haspopup="menu"
          aria-expanded={!!menu}
        >
          <MoreHorizontal size="1rem" />
        </button>
        {/* Last, like the upstream headings' chevrons below it. The heading button is the keyboard and screen
            reader fold; this is a second pointer target for the same toggle. */}
        <button type="button" tabIndex={-1} aria-hidden onClick={onToggle} className={ROW_BUTTON}>
          <ChevronDown
            size="0.875rem"
            className={cn(
              "text-[var(--muted-foreground)] transition-transform motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
          />
        </button>
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            autoFocus={menu.keyboard}
            onClose={() => setMenu(null)}
            items={[
              {
                label: t("connections.accounts.editor.editTitle"),
                icon: <Settings2 size="0.75rem" />,
                onSelect: editAccount,
              },
              ...(account.hasApiKey
                ? [
                    {
                      label: t("connections.accounts.replaceKey"),
                      icon: <KeyRound size="0.75rem" />,
                      onSelect: replaceKey,
                    },
                  ]
                : []),
              {
                label: t("connections.accounts.test"),
                icon: <Wifi size="0.75rem" />,
                disabled: !firstRow || test.isPending,
                onSelect: runTest,
              },
              {
                label: t("connections.accounts.addModel"),
                icon: <Plus size="0.75rem" />,
                onSelect: addModels,
              },
              ...(imageSource
                ? [
                    {
                      label: t("connections.accounts.addImageModel"),
                      icon: <ImageIcon size="0.75rem" />,
                      onSelect: addImageModel,
                    },
                  ]
                : []),
              {
                label: t("connections.accounts.select.start"),
                icon: <ListChecks size="0.75rem" />,
                disabled: rows.length < 2,
                onSelect: () => setPicked(new Set()),
              },
              {
                label: t("connections.accounts.duplicate"),
                icon: <Copy size="0.75rem" />,
                disabled: duplicateAccount.isPending,
                onSelect: () =>
                  duplicateAccount.mutate(account.id, {
                    onSuccess: ({ account: copy }) =>
                      toast.success(t("connections.accounts.duplicated", { name: copy.name })),
                    onError: (error) =>
                      toast.error(t("connections.accounts.duplicateFailed", { error: error.message })),
                  }),
              },
              {
                // Off in one step: its models stop running and chats fall back, without opening the editor.
                label: t(account.enabled ? "connections.accounts.turnOff" : "connections.accounts.turnOn"),
                icon: <Power size="0.75rem" />,
                onSelect: () => updateAccount.mutate({ id: account.id, enabled: !account.enabled }),
              },
              {
                label: t("connections.accounts.editor.delete"),
                icon: <Trash2 size="0.75rem" />,
                destructive: true,
                disabled: removeAccount.isPending,
                onSelect: () => void deleteAccount(),
              },
            ]}
          />
        )}
      </div>

      {/* The meter stays when the card folds: it is the card's live state, not part of its model list. */}
      {usage && firstRow && (
        <CompactUsageMeter
          connectionId={firstRow.id}
          showFiveHour={usage.showUsageFiveHour}
          showWeekly={usage.showUsageWeekly}
          className="ps-[3.25rem] pe-2 pb-1.5"
        />
      )}
      {picked && (
        <div data-connection-select className="flex flex-col gap-0.5 p-1">
          {sortByModelId(rows).map((row) => (
            <label
              key={row.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-[var(--accent)]"
            >
              <input
                type="checkbox"
                checked={picked.has(row.id)}
                onChange={() =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (!next.delete(row.id)) next.add(row.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate text-xs">{nameOf(row)}</span>
              {row.model && row.model !== nameOf(row) && (
                <span className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]">{row.model}</span>
              )}
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2 px-2 pt-1">
            <span className="me-auto text-[0.6875rem] text-[var(--muted-foreground)]" role="status">
              {t("connections.accounts.select.count", { count: pickedRows.length })}
            </span>
            <button
              type="button"
              className={SMALL_ACTION}
              disabled={!pickedRows.length || !moveTargets.length || bulkBusy}
              title={moveTargets.length ? undefined : t("connections.accounts.select.noTarget")}
              onClick={() => void moveSelected()}
            >
              {t("connections.accounts.select.move")}
            </button>
            <button
              type="button"
              className={cn(SMALL_ACTION, "text-[var(--destructive)]")}
              disabled={!pickedRows.length || bulkBusy}
              onClick={() => void deleteSelected()}
            >
              {t("connections.accounts.select.delete")}
            </button>
            <button type="button" className={SMALL_ACTION} disabled={bulkBusy} onClick={() => setPicked(null)}>
              {t("connections.accounts.editor.cancel")}
            </button>
          </div>
        </div>
      )}
      {open && !picked && (
        <ConnectionModelList
          id={modelsId}
          ariaLabel={t("ui.agents.featureagentdetailhost.value1Value2", { value1: account.name, value2: service })}
          provider={account.provider}
          rows={sortByModelId(visibleRows)}
          getKey={(row) => row.id}
          renderRow={(row, upstream) => renderRow(row, modelSubtitle(row, upstream), catalog)}
          rolesOf={rolesOf}
          // A search keeps every hit in view.
          autoFold={visibleRows.length === rows.length}
          empty={
            <p className="px-2 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("connections.accounts.noModels")}
            </p>
          }
        />
      )}
    </div>
  );
}
