// ──────────────────────────────────────────────
// ConnectionGroup — one Connection in the Connections panel list, as a card: its head (where it connects or its
// state, fix, ⋯ actions, open/close chevron at the right), its usage and, while open, its Models (split into Chat
// and Images & voice when it has both, then grouped by upstream) and Browse all models.
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
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
import { useCreateConnection, useDuplicateConnection, useTestConnection } from "../../hooks/use-connections";
import { useUpdateConnectionAccount } from "../../hooks/use-connection-accounts";
import { starAnchorOf } from "../../hooks/use-model-star";
import { sortByModelId, subgroupByUpstream } from "../../lib/connection-groups";
import { useUIStore } from "../../stores/ui.store";
import { openAddModels } from "../../lib/add-connection";
import { cn } from "../../lib/utils";
import { ContextMenu } from "../ui/ContextMenu";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import { BrandMark } from "./ProviderIcon";
import { SMALL_ACTION, StateWord, type EngineTone } from "./DeviceDetail";
import { isMediaRow, menuAt, modelSubtitle, ROW_BUTTON, type ConnectionRowData, type MenuAt } from "./ConnectionRow";

const STATE_TONE: Record<ConnectionAccountListItem["state"], EngineTone> = { ok: "ok", off: "off", needs_key: "warn" };

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
}: {
  account: ConnectionAccountListItem;
  rows: ConnectionRowData[];
  /** The Models the filter and search keep; `rows` still picks the anchor Model for Add model and the stars. */
  visibleRows?: ConnectionRowData[];
  renderRow: (row: ConnectionRowData, subtitle: string) => ReactNode;
  open: boolean;
  onToggle: () => void;
  tile: ReactNode;
}) {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const duplicate = useDuplicateConnection();
  const createConnection = useCreateConnection();
  const updateAccount = useUpdateConnectionAccount();
  const test = useTestConnection();
  const [menu, setMenu] = useState<MenuAt | null>(null);

  // The anchor Model: Add model shows and keeps the Connection's stars on it.
  const chatRow = starAnchorOf(rows) ?? null;
  const firstRow = chatRow ?? rows[0] ?? null;
  // Decision 20: an image Model on the same vendor key joins this Connection, so it needs no key of its own.
  const imageSource = chatRow
    ? IMAGE_GENERATION_SOURCES.find((source) => IMAGE_SOURCE_VENDOR[source.id] === account.provider)
    : undefined;
  const openCreated = (data: unknown) => {
    const id = (data as { id?: string } | undefined)?.id;
    if (id) openConnectionDetail(id);
  };
  const addImageModel = () =>
    imageSource &&
    createConnection.mutate(
      {
        name: imageSource.name,
        provider: "image_generation",
        apiKey: "",
        imageGenerationSource: imageSource.id,
        accountId: account.id,
      },
      {
        onSuccess: openCreated,
        onError: (error) =>
          toast.error(
            t("connections.accounts.addImageModelFailed", {
              error: error instanceof Error ? error.message : String(error ?? ""),
            }),
          ),
      },
    );
  // Only a chat Model can seed the catalog pick; a media-only Connection copies its Model into the editor.
  const addModel = () =>
    chatRow
      ? openAddModels({ accountId: account.id, connectionId: chatRow.id })
      : firstRow
        ? duplicate.mutate(firstRow.id, { onSuccess: openCreated })
        : openModal("create-connection", { provider: account.provider });
  const editAccount = () => openModal("connection-account", { accountId: account.id });
  const runTest = () =>
    firstRow &&
    test.mutate(firstRow.id, {
      onSuccess: (result) =>
        result.success
          ? toast.success(t("connections.accounts.testOk", { latency: result.latencyMs }))
          : toast.error(result.message || t("connections.accounts.testFailed")),
      onError: () => toast.error(t("connections.accounts.testFailed")),
    });
  const service = PROVIDERS[account.provider as APIProvider]?.name ?? account.provider;
  const state = t(`connections.accounts.state.${account.state}`);
  const modelsId = `connection-models-${account.id}`;
  const toggleLabel = t(open ? "connections.list.collapse" : "connections.list.expand", { name: account.name });
  const fix =
    account.state === "needs_key"
      ? {
          label: t("connections.accounts.addKey"),
          aria: t("connections.list.addKeyFor", { name: account.name }),
          run: editAccount,
        }
      : account.state === "off"
        ? {
            label: t("connections.defaults.fix.turnOn"),
            aria: t("connections.list.turnOn", { name: account.name }),
            run: () => updateAccount.mutate({ id: account.id, enabled: true }),
          }
        : null;
  // Mixed Connections (one key for chat and images) split by kind; the rest list their Models directly.
  const chatRows = visibleRows.filter((row) => !isMediaRow(row));
  const mediaRows = visibleRows.filter(isMediaRow);
  const kinds: Array<{
    key: string;
    heading: string | null;
    icon: typeof ImageIcon | null;
    rows: ConnectionRowData[];
  }> =
    chatRows.length > 0 && mediaRows.length > 0
      ? [
          { key: "chat", heading: t("connections.accounts.section.chat"), icon: MessageSquareText, rows: chatRows },
          { key: "media", heading: t("connections.accounts.section.media"), icon: ImageIcon, rows: mediaRows },
        ]
      : [{ key: "all", heading: null, icon: null, rows: visibleRows }];

  return (
    <div
      role="group"
      className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]"
      data-connection-account-id={account.id}
      aria-label={account.name}
    >
      <div className="flex min-w-0 items-center gap-0.5 p-1">
        <button
          type="button"
          data-connections-row={`account:${account.id}`}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={modelsId}
          aria-label={t("connections.list.rowLabel", { name: account.name, state })}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--sidebar-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
        >
          {tile}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-5 text-[var(--foreground)]">
              {account.name}
            </span>
            {/* A working Connection says where it connects; a broken one says what is wrong. */}
            <span className="flex min-w-0 items-center gap-x-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              {account.state === "ok" ? (
                <span className="truncate">{hostOf(account.baseUrl) || service}</span>
              ) : (
                <StateWord tone={STATE_TONE[account.state]} label={state} />
              )}
            </span>
          </span>
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
        <button
          type="button"
          data-connections-toggle={account.id}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={modelsId}
          aria-label={toggleLabel}
          title={toggleLabel}
          className={cn(ROW_BUTTON, "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
        >
          <ChevronDown size="0.875rem" className={cn("transition-transform", open && "rotate-180")} />
        </button>
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            autoFocus={menu.keyboard}
            onClose={() => setMenu(null)}
            items={[
              {
                label: t("connections.accounts.test"),
                icon: <Wifi size="0.75rem" />,
                disabled: !firstRow || test.isPending,
                onSelect: runTest,
              },
              { label: t("connections.detail.edit"), icon: <Settings2 size="0.75rem" />, onSelect: editAccount },
              {
                label: t("connections.accounts.addModel"),
                icon: <Plus size="0.75rem" />,
                disabled: duplicate.isPending,
                onSelect: addModel,
              },
              ...(imageSource
                ? [
                    {
                      label: t("connections.accounts.addImageModel"),
                      icon: <ImageIcon size="0.75rem" />,
                      disabled: createConnection.isPending,
                      onSelect: addImageModel,
                    },
                  ]
                : []),
              ...(chatRow
                ? [
                    {
                      label: t("connections.detail.browseAll"),
                      icon: <Search size="0.75rem" />,
                      onSelect: () => openAddModels({ accountId: account.id, connectionId: chatRow.id }),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>

      {open && account.showUsageWidget && firstRow && (
        <div className="px-3 pb-2 pl-14">
          <SubscriptionUsageWidget connectionId={firstRow.id} variant="inline" />
        </div>
      )}
      {open && (
        <div
          id={modelsId}
          aria-label={t("ui.agents.featureagentdetailhost.value1Value2", { value1: account.name, value2: service })}
          className="mb-1.5 ml-4 mr-1 flex flex-col gap-0.5 border-l border-[var(--border)] pl-1.5"
        >
          {rows.length === 0 && (
            <p className="px-2 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("connections.accounts.noModels")}
            </p>
          )}
          {kinds.map((kind) => (
            <div key={kind.key} className="flex flex-col gap-0.5">
              {kind.heading && kind.icon && (
                <p className="flex items-center gap-1.5 px-2 pt-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                  <kind.icon size="0.75rem" aria-hidden />
                  {kind.heading}
                </p>
              )}
              {/* By model id: the groups and rows keep their places when a star or an edit touches a Model. */}
              {subgroupByUpstream(sortByModelId(kind.rows)).map((group) => (
                <div key={group.upstream ?? ""} className="flex flex-col gap-0.5">
                  {group.upstream && (
                    <p className="flex items-center gap-1.5 px-2 pt-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                      <BrandMark of={group.upstream} className="h-3 w-3" />
                      {t("connections.accounts.upstreamHeading", {
                        upstream: group.upstream,
                        count: group.rows.length,
                      })}
                    </p>
                  )}
                  {group.rows.map((row) => (
                    <div key={row.id}>{renderRow(row, modelSubtitle(row, group.upstream))}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {chatRow && (
            <button
              type="button"
              onClick={() => openAddModels({ accountId: account.id, connectionId: chatRow.id })}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs hover:bg-[var(--sidebar-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] md:min-h-9 [@media(pointer:coarse)]:min-h-11"
            >
              <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
              <span className="min-w-0 flex-1 text-[var(--muted-foreground)]">{t("connections.detail.browseAll")}</span>
              <ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
