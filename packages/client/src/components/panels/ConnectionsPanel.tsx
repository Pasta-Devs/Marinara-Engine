// ──────────────────────────────────────────────
// Panel: Connections (variant D). The list: Defaults, then the Connections grouped (Chat, Images & voice), then the
// engines set up on this device. Each row opens a detail page: two columns on a wide panel, a drill-in otherwise.
// Search finds models first; a model result opens its editor.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  ExternalLink,
  HardDrive,
  ImageIcon,
  Link,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { PROVIDERS, isChatProvider, parsePinnedModels, type APIProvider } from "@marinara-engine/shared";
import { useConnections, useMoveConnection, useUploadConnectionImage } from "../../hooks/use-connections";
import { useConnectionAccounts, useUpdateConnectionAccount } from "../../hooks/use-connection-accounts";
import { starAnchorOf, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";
import type { DeviceItem } from "../../hooks/use-device-setup";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import {
  CONNECTION_EXPORT_WARNING,
  createConnectionExportEnvelope,
  type ConnectionTransferRow,
} from "../../lib/connection-transfer";
import { groupModelsByAccount } from "../../lib/connection-groups";
import { ConnectionRow, isMediaRow, mediaService, type ConnectionRowData } from "../connections/ConnectionRow";
import { ConnectionDetail, hostOf } from "../connections/ConnectionDetail";
import { ConnectionDefaultsDetail, useConnectionDefaults } from "../connections/ConnectionDefaults";
import { DeviceDetail, SMALL_ACTION, StateWord, useDeviceEngines } from "../connections/DeviceDetail";
import { BrandMark, ProviderIcon } from "../connections/ProviderIcon";
import { openAddConnection } from "../../lib/add-connection";
import { useChatModelPick } from "../connections/ConnectionSwitcherBody";
import { PanelSection } from "../ui/PanelSection";
import { ContextMenu } from "../ui/ContextMenu";

/** Two columns from this panel width; below it a row drills in. */
const WIDE_PANEL_PX = 768;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.trim();
  }
}

function connectionMatchesSearch(conn: ConnectionRowData, query: string) {
  if (!query) return true;
  const haystack = [
    conn.name,
    conn.provider,
    conn.model,
    conn.baseUrl,
    conn.imageService,
    conn.imageGenerationSource,
    conn.videoService,
    conn.videoGenerationSource,
    conn.openrouterProvider,
    conn.embeddingModel,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/** One list row: a button that opens a detail page, and an optional inline fix that needs no drill-in. */
function ListRow({
  rowKey,
  selected,
  tile,
  title,
  sub,
  label,
  fix,
  onOpen,
}: {
  /** The page the row opens: "defaults", "account:<id>", "device:<item>" or "other". */
  rowKey: string;
  selected: boolean;
  tile: ReactNode;
  title: string;
  sub: ReactNode;
  label: string;
  fix?: { label: string; aria: string; run: () => void };
  onOpen: () => void;
}) {
  return (
    <div
      className={cn("relative flex min-w-0 items-center gap-1.5 rounded-xl", selected && "bg-[var(--sidebar-accent)]")}
    >
      {selected && (
        <span
          aria-hidden
          className="mari-chrome-accent-progress mari-accent-animated absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
        />
      )}
      <button
        type="button"
        data-connections-row={rowKey}
        onClick={onOpen}
        aria-current={selected || undefined}
        aria-label={label}
        className={cn(
          "group flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--sidebar-accent)]",
          FOCUS,
        )}
      >
        {tile}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm leading-5 text-[var(--foreground)]">{title}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
            {sub}
          </span>
        </span>
        {!fix && (
          <ChevronRight
            size="0.875rem"
            className="shrink-0 text-[var(--muted-foreground)] opacity-60 group-hover:opacity-100"
          />
        )}
      </button>
      {fix && (
        <span className="flex shrink-0 items-center pr-1">
          <button type="button" onClick={fix.run} aria-label={fix.aria} className={SMALL_ACTION}>
            {fix.label}
          </button>
        </span>
      )}
    </div>
  );
}

function SettingsTile() {
  return (
    <span className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm">
      <Settings2 size="1rem" />
    </span>
  );
}

export function ConnectionsPanel() {
  const { t } = useTranslation();
  const connectionsQuery = useConnections();
  const accountsQuery = useConnectionAccounts();
  const { data: connections, isLoading } = connectionsQuery;
  const { data: accounts } = accountsQuery;
  const loadFailed = connectionsQuery.isError || accountsQuery.isError;
  const uploadConnectionImage = useUploadConnectionImage();
  const moveConnection = useMoveConnection();
  const updateAccount = useUpdateConnectionAccount();
  const activeChat = useChatStore((s) => s.activeChat);
  const chatPick = useChatModelPick(activeChat?.id ?? null);
  const modelStar = useModelStar();
  const hiddenIds = useHiddenModelIds();
  const openModal = useUIStore((s) => s.openModal);
  const linkApiBannerDismissed = useUIStore((s) => s.linkApiBannerDismissed);
  const dismissLinkApiBanner = useUIStore((s) => s.dismissLinkApiBanner);
  const upgradeNoteDismissed = useUIStore((s) => s.connectionsUpgradeNoteDismissed);
  const dismissUpgradeNote = useUIStore((s) => s.dismissConnectionsUpgradeNote);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number; keyboard: boolean } | null>(null);
  const [wide, setWide] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  /** The row a narrow panel's "‹ Connections" returns focus to. */
  const returnKeyRef = useRef<string | null>(null);
  const connectionImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetConnectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWide((entry?.contentRect.width ?? 0) >= WIDE_PANEL_PX));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Rows wait for their Undo while hidden (decision 30).
  const connectionsList = useMemo(
    () => ((connections as ConnectionRowData[] | undefined) ?? []).filter((row) => !hiddenIds.has(row.id)),
    [connections, hiddenIds],
  );
  const defaults = useConnectionDefaults(connectionsList);
  const engines = useDeviceEngines();
  // ponytail: "had connections before" = a Connection created well after one of its Models, which only the upgrade
  // grouping does (a Model saved without a Connection is linked in the same moment). A Model moved into a much
  // newer Connection also counts; a server flag if that ever matters.
  const upgradedFromModels = useMemo(
    () =>
      !!accounts?.some((account) =>
        connectionsList.some(
          (row) =>
            row.accountId === account.id &&
            !!row.createdAt &&
            Date.parse(account.createdAt) - Date.parse(row.createdAt) > 60_000,
        ),
      ),
    [accounts, connectionsList],
  );

  const grouped = useMemo(() => {
    const { groups, standalone } = groupModelsByAccount(connectionsList, accounts ?? []);
    const sorted = [...groups].sort((a, b) => a.account.name.localeCompare(b.account.name));
    const isMedia = (group: (typeof sorted)[number]) => group.rows.length > 0 && group.rows.every(isMediaRow);
    return {
      all: sorted,
      chat: sorted.filter((group) => !isMedia(group)),
      media: sorted.filter(isMedia),
      // Until the Connections load, every Model would look standalone.
      standalone: accounts ? standalone : [],
    };
  }, [accounts, connectionsList]);
  const accountById = useMemo(() => new Map((accounts ?? []).map((account) => [account.id, account])), [accounts]);

  const query = search.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    return {
      models: connectionsList.filter((row) => connectionMatchesSearch(row, query)),
      accounts: grouped.all.filter(({ account }) =>
        [account.name, PROVIDERS[account.provider as APIProvider]?.name ?? account.provider, hostOf(account.baseUrl)]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    };
  }, [connectionsList, grouped.all, query]);

  // A wide panel always shows a page: the chosen one, else the first Connection, else Defaults.
  const firstKey = grouped.all[0] ? `account:${grouped.all[0].account.id}` : "defaults";
  const validKey = (key: string | null) => {
    if (!key) return false;
    if (key === "defaults") return true;
    if (key === "other") return grouped.standalone.length > 0;
    if (key.startsWith("device:")) return engines.some((engine) => `device:${engine.item}` === key);
    return accountById.has(key.slice("account:".length));
  };
  const current = validKey(selected) ? selected : wide ? firstKey : null;

  const select = useCallback(
    (key: string | null) => {
      setSelected(key);
      if (!wide && key) rootRef.current?.scrollIntoView({ block: "start" });
    },
    [wide],
  );
  // Drill-in moves focus to "‹ Connections", so a keyboard user lands on the new page; going back focuses its row.
  useEffect(() => {
    if (wide) return;
    if (current) backRef.current?.focus({ preventScroll: true });
    else if (returnKeyRef.current) {
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-connections-row="${CSS.escape(returnKeyRef.current)}"]`)
        ?.focus();
      returnKeyRef.current = null;
    }
  }, [current, wide]);

  const handlePickConnectionImage = useCallback((connectionId: string) => {
    imageTargetConnectionIdRef.current = connectionId;
    if (connectionImageInputRef.current) {
      connectionImageInputRef.current.value = "";
      connectionImageInputRef.current.click();
    }
  }, []);

  const handleConnectionImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const connectionId = imageTargetConnectionIdRef.current;
      if (!file || !connectionId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetConnectionIdRef.current = null;
        toast.error(t("ui.panels.connectionspanel.chooseAnImageFileForTheConnectionPicture"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error(t("ui.panels.agentspanel.couldNotReadThatImage"));
          return;
        }

        try {
          await uploadConnectionImage.mutateAsync({ id: connectionId, image });
          toast.success(t("ui.panels.connectionspanel.connectionPictureUpdated"));
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : t("ui.panels.connectionspanel.failedToUploadConnectionPicture"),
          );
        } finally {
          imageTargetConnectionIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetConnectionIdRef.current = null;
        toast.error(t("ui.panels.agentspanel.couldNotReadThatImage"));
      };
      reader.readAsDataURL(file);
    },
    [uploadConnectionImage, t],
  );

  const exportConnections = async (connectionsToExport: ConnectionRowData[]) => {
    if (connectionsToExport.length === 0) return;

    const confirmed = await showConfirmDialog({
      title: t("ui.panels.connectionspanel.exportConnectionData"),
      message: CONNECTION_EXPORT_WARNING,
      confirmLabel: t("ui.characters.spritestab.export"),
      cancelLabel: t("common.close"),
    });
    if (!confirmed) return;

    const envelope = createConnectionExportEnvelope(connectionsToExport as ConnectionTransferRow[]);
    const saveStatus =
      connectionsToExport.length > 1
        ? await downloadZipFile(
            [{ path: "marinara-connections.json", content: JSON.stringify(envelope, null, 2) }],
            "marinara-connections.zip",
          )
        : await downloadJsonFile(
            envelope,
            `${sanitizeExportFilenamePart(connectionsToExport[0]?.name, "connection")}.connection.json`,
          );
    if (saveStatus === "saved")
      toast.success(
        t("ui.panels.connectionspanel.exportedValue1ConnectionValue2", {
          value1: connectionsToExport.length,
          value2: connectionsToExport.length === 1 ? "" : t("ui.noodle.stageprofileview.s"),
        }),
      );
  };

  const renderRow = (row: ConnectionRowData, subtitle?: string, connectionName?: string) => {
    const account = row.accountId ? accountById.get(row.accountId) : undefined;
    const chatModel = isChatProvider(row.provider);
    // A Connection's stars live on its anchor Model; a standalone Model keeps its own.
    const anchor =
      (row.accountId && starAnchorOf(connectionsList.filter((other) => other.accountId === row.accountId))) || row;
    const starred = !!row.model && parsePinnedModels(anchor.pinnedModels).includes(row.model);
    // Same service and endpoint only; the server checks the credential kind again (decision 28).
    const moveTargets =
      account && !row.credentialsFromConnectionId
        ? (accounts ?? [])
            .filter(
              (item) =>
                item.id !== account.id &&
                item.provider === account.provider &&
                (account.provider !== "custom" || originOf(item.baseUrl) === originOf(account.baseUrl)),
            )
            .map(({ id, name }) => ({ id, name }))
        : [];
    return (
      <ConnectionRow
        key={row.id}
        row={row}
        account={account}
        subtitle={subtitle}
        connectionName={connectionName}
        current={activeChat?.connectionId === row.id}
        starred={starred}
        onToggleStar={
          chatModel && row.model && row.accountId
            ? () =>
                void modelStar.toggle(
                  { accountId: row.accountId!, model: row.model, name: row.name, anchorId: anchor.id },
                  starred,
                )
            : undefined
        }
        onUseInChat={
          activeChat && chatModel
            ? () =>
                void chatPick
                  .apply({ connectionId: row.id })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : t("connections.row.useInChatFailed")),
                  )
            : undefined
        }
        moveTargets={moveTargets}
        onMove={(accountId, name) =>
          moveConnection.mutate(
            { id: row.id, accountId },
            {
              onSuccess: () =>
                toast.success(t("connections.accounts.row.moved", { model: row.name, connection: name })),
              onError: (error) =>
                toast.error(
                  t("connections.accounts.row.moveFailed", {
                    error: error instanceof Error ? error.message : String(error ?? ""),
                  }),
                ),
            },
          )
        }
        onImagePick={() => handlePickConnectionImage(row.id)}
      />
    );
  };

  // ── List rows ──
  const accountRow = ({ account, rows }: (typeof grouped.all)[number]) => {
    const key = `account:${account.id}`;
    const state = t(`connections.accounts.state.${account.state}`);
    const fix =
      account.state === "needs_key"
        ? {
            label: t("connections.accounts.addKey"),
            aria: t("connections.list.addKeyFor", { name: account.name }),
            run: () => openModal("connection-account", { accountId: account.id }),
          }
        : account.state === "off"
          ? {
              label: t("connections.defaults.fix.turnOn"),
              aria: t("connections.list.turnOn", { name: account.name }),
              run: () => updateAccount.mutate({ id: account.id, enabled: true }),
            }
          : undefined;
    return (
      <ListRow
        key={key}
        rowKey={key}
        selected={wide && current === key}
        tile={
          <ProviderIcon
            provider={account.provider}
            baseUrl={account.baseUrl}
            service={rows[0] && mediaService(rows[0])}
            name={account.name}
            dim={account.state === "off"}
          />
        }
        title={account.name}
        label={t("connections.list.rowLabel", { name: account.name, state })}
        sub={
          <>
            <StateWord tone={account.state === "ok" ? "ok" : account.state === "off" ? "off" : "warn"} label={state} />
            <span>· {t("connections.list.models", { count: rows.length })}</span>
          </>
        }
        fix={fix}
        onOpen={() => select(key)}
      />
    );
  };
  const problemCount = defaults.problems.length;
  const defaultsRow = (
    <ListRow
      key="defaults"
      rowKey="defaults"
      selected={wide && current === "defaults"}
      tile={<SettingsTile />}
      title={t("connections.defaults.title")}
      label={
        problemCount
          ? t("connections.list.defaultsLabelProblems", { model: defaults.mainLabel, count: problemCount })
          : t("connections.list.defaultsLabel", { model: defaults.mainLabel })
      }
      sub={
        <>
          <span className="truncate">{t("connections.list.main", { model: defaults.mainLabel })}</span>
          {problemCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[var(--marinara-app-accent-static)]">
              <AlertTriangle size="0.6875rem" />
              {t("connections.list.problems", { count: problemCount })}
            </span>
          )}
        </>
      }
      onOpen={() => select("defaults")}
    />
  );
  const deviceGroup = engines.length > 0 && (
    <PanelSection title={t("connections.accounts.section.device")} icon={<HardDrive size="0.75rem" />}>
      {engines.map((engine) => {
        const key = `device:${engine.item}`;
        return (
          <ListRow
            key={key}
            rowKey={key}
            selected={wide && current === key}
            tile={<ProviderIcon provider={engine.item} />}
            title={engine.name}
            label={t("connections.list.rowLabel", { name: engine.name, state: engine.state })}
            sub={
              <>
                <StateWord tone={engine.tone} label={engine.state} />
                {engine.detail && <span>· {engine.detail}</span>}
              </>
            }
            fix={
              engine.fix && {
                label: engine.fix.label,
                aria: t("connections.list.fixFor", { action: engine.fix.label, name: engine.name }),
                run: engine.fix.run,
              }
            }
            onOpen={() => select(key)}
          />
        );
      })}
    </PanelSection>
  );

  const noConnections = !isLoading && !loadFailed && connectionsList.length === 0 && (accounts?.length ?? 0) === 0;
  const list = (
    <div className="flex flex-col gap-0.5">
      {loadFailed ? (
        // ERR-1: a failed load never looks like an empty list.
        <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3" role="alert">
          <div className="flex items-start gap-2.5">
            <CloudOff size="1rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">{t("connections.list.loadFailed")}</p>
              <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("connections.list.loadFailedHelp")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void connectionsQuery.refetch();
              void accountsQuery.refetch();
            }}
            className={cn(SMALL_ACTION, "mt-2.5")}
          >
            <RefreshCw size="0.75rem" />
            {t("connections.list.tryAgain")}
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-12 rounded-xl" />
          ))}
        </div>
      ) : noConnections ? (
        <>
          {defaultsRow}
          <div className="mt-1 flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
            <p className="text-sm font-medium text-[var(--foreground)]">{t("connections.list.emptyTitle")}</p>
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.list.emptyHelp")}</p>
          </div>
          {!linkApiBannerDismissed && (
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
              <p className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <BrandMark of="linkapi" color className="h-6 w-6" />
                <span>
                  {t("ui.panels.connectionspanel.lookingToTryNewModelsFromATrustedProvider")}{" "}
                  <a
                    href="https://linkapi.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sky-400 underline decoration-sky-400/30 transition-colors hover:text-sky-300"
                  >
                    {t("ui.panels.connectionspanel.linkapi")}
                  </a>
                  !
                </span>
              </p>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <a
                  href="https://linkapi.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mari-chrome-control mari-chrome-control--small w-full px-2 text-xs"
                >
                  <ExternalLink size="0.75rem" className="shrink-0" />
                  <span>{t("ui.panels.connectionspanel.visitLinkapi")}</span>
                </a>
                <button
                  type="button"
                  onClick={dismissLinkApiBanner}
                  className="mari-chrome-control mari-chrome-control--small w-full px-2 text-xs"
                >
                  <X size="0.75rem" className="shrink-0" />
                  <span>{t("ui.panels.connectionspanel.dismissPermanently")}</span>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {defaultsRow}
          {grouped.chat.length > 0 && (
            <PanelSection title={t("connections.accounts.section.chat")} icon={<MessageSquareText size="0.75rem" />}>
              {grouped.chat.map(accountRow)}
            </PanelSection>
          )}
          {grouped.media.length > 0 && (
            <PanelSection title={t("connections.accounts.section.media")} icon={<ImageIcon size="0.75rem" />}>
              {grouped.media.map(accountRow)}
            </PanelSection>
          )}
          {grouped.standalone.length > 0 && (
            <PanelSection title={t("connections.accounts.section.other")} icon={<Link size="0.75rem" />}>
              <ListRow
                rowKey="other"
                selected={wide && current === "other"}
                tile={<ProviderIcon provider="custom" />}
                title={t("connections.accounts.section.other")}
                label={t("connections.accounts.section.other")}
                sub={<span>{t("connections.list.models", { count: grouped.standalone.length })}</span>}
                onOpen={() => select("other")}
              />
            </PanelSection>
          )}
        </>
      )}
      {deviceGroup}
    </div>
  );

  const searchResults = results && (
    <div className="flex flex-col gap-0.5" aria-live="polite">
      {results.models.length === 0 && results.accounts.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-[var(--muted-foreground)]">
          {t("connections.list.noMatch", { query: search.trim() })}
        </p>
      ) : (
        <>
          {results.models.length > 0 && (
            <>
              <p className="px-2 pb-0.5 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("connections.list.modelsHeading", { count: results.models.length })}
              </p>
              {results.models.map((row) =>
                renderRow(row, undefined, row.accountId ? accountById.get(row.accountId)?.name : undefined),
              )}
            </>
          )}
          {results.accounts.length > 0 && (
            <>
              <p className="px-2 pb-0.5 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("connections.list.connectionsHeading", { count: results.accounts.length })}
              </p>
              {results.accounts.map(accountRow)}
            </>
          )}
        </>
      )}
    </div>
  );

  // An engine without its page yet (its state still loading) opens its set-up screen instead.
  const openDevice = (item: DeviceItem) =>
    engines.some((engine) => engine.item === item)
      ? select(`device:${item}`)
      : openAddConnection({ category: "device", item });
  let detail: ReactNode = null;
  if (current === "defaults") {
    detail = <ConnectionDefaultsDetail connectionsList={connectionsList} onOpenDevice={openDevice} />;
  } else if (current?.startsWith("device:")) {
    detail = (
      <DeviceDetail
        key={current}
        item={current.slice("device:".length) as DeviceItem}
        onOpenDefaults={() => select("defaults")}
      />
    );
  } else if (current === "other") {
    detail = (
      <div className="flex flex-col gap-0.5">
        <p className="px-1.5 pb-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {t("connections.accounts.section.other")}
        </p>
        {grouped.standalone.map((row) => renderRow(row))}
      </div>
    );
  } else if (current?.startsWith("account:")) {
    const group = grouped.all.find((entry) => `account:${entry.account.id}` === current);
    if (group) {
      detail = (
        <ConnectionDetail
          key={group.account.id}
          account={group.account}
          rows={group.rows}
          renderRow={(row, subtitle) => renderRow(row, subtitle)}
        />
      );
    }
  }

  const header = (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openModal("create-connection")}
          className="mari-panel-gradient-button mari-panel-gradient--connections flex-1 text-xs"
          title={t("ui.panels.connectionspanel.createConnection")}
        >
          <Plus size="0.8125rem" />
          {t("connections.accounts.header.add")}
        </button>
        <button
          type="button"
          onClick={() => openModal("import-connection")}
          className="mari-chrome-control mari-chrome-control--primary px-3 text-xs"
          title={t("ui.panels.connectionspanel.importConnection")}
          aria-label={t("ui.panels.connectionspanel.importConnection")}
        >
          <Download size="0.8125rem" />
          {t("connections.accounts.header.import")}
        </button>
      </div>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder={t("connections.list.search")}
            aria-label={t("connections.list.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <button
          type="button"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHeaderMenu({ x: rect.right, y: rect.bottom + 4, keyboard: event.detail === 0 });
          }}
          className="mari-chrome-control mari-chrome-control--small h-10 min-h-0 w-10 !p-0 md:h-9 md:w-9"
          title={t("connections.accounts.header.more")}
          aria-label={t("connections.accounts.header.more")}
          aria-haspopup="menu"
          aria-expanded={!!headerMenu}
        >
          <MoreHorizontal size="0.875rem" />
        </button>
        {headerMenu && (
          <ContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            autoFocus={headerMenu.keyboard}
            onClose={() => setHeaderMenu(null)}
            items={[
              {
                label: t("connections.list.exportAll"),
                icon: <Upload size="0.75rem" />,
                disabled: connectionsList.length === 0,
                onSelect: () => void exportConnections(connectionsList),
              },
            ]}
          />
        )}
      </div>
      {upgradedFromModels && !upgradeNoteDismissed && (
        <div
          role="note"
          data-connections-upgrade-note
          className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs text-[var(--muted-foreground)]"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p>{t("connections.upgradeNote.grouped")}</p>
            <p>{t("connections.upgradeNote.picks")}</p>
          </div>
          <button
            type="button"
            onClick={dismissUpgradeNote}
            className={cn(
              "-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--sidebar)] hover:text-[var(--foreground)]",
              FOCUS,
            )}
            aria-label={t("connections.upgradeNote.dismiss")}
            title={t("connections.upgradeNote.dismiss")}
          >
            <X size="0.875rem" />
          </button>
        </div>
      )}
    </>
  );

  const body = wide ? (
    <>
      {header}
      <div className="flex min-h-0 gap-3">
        <div className="w-72 shrink-0">{searchResults ?? list}</div>
        <div className="min-w-0 flex-1 border-l border-[var(--border)]/50 pl-3">
          {detail ?? (
            <p className="px-2 py-6 text-xs text-[var(--muted-foreground)]">{t("connections.list.nothingToShow")}</p>
          )}
        </div>
      </div>
    </>
  ) : current && detail ? (
    <>
      <button
        ref={backRef}
        type="button"
        data-connections-back
        onClick={() => {
          returnKeyRef.current = current;
          setSelected(null);
        }}
        className={cn(
          "-ml-1 flex min-h-9 w-fit items-center gap-1 rounded-lg px-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] max-md:min-h-11",
          FOCUS,
        )}
      >
        <ChevronLeft size="0.875rem" />
        {t("connections.list.back")}
      </button>
      {detail}
    </>
  ) : (
    <>
      {header}
      {searchResults ?? list}
    </>
  );

  return (
    <div ref={rootRef} className="flex min-h-full flex-col gap-2 p-3" data-connections-panel={wide ? "wide" : "narrow"}>
      <input
        ref={connectionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConnectionImageSelected}
      />
      {body}
    </div>
  );
}
