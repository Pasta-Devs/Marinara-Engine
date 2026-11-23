// ──────────────────────────────────────────────
// New layout: the Connections landing page (board 1-2, "ConnList").
// Accounts in one table, each folding open to its Models; a compact Defaults grid on top
// says which Model each job uses. Model rows open the Model editor; the account name opens
// the account editor. Add account opens the add window anchored under its button.
// ──────────────────────────────────────────────
import { useMenuKeyboard } from "../../hooks/use-menu-keyboard";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Folder,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Plus,
  Search,
  Shuffle,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { isChatProvider, parsePinnedModels, PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { starAnchorOf, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";
import { groupModelsByAccount } from "../../lib/connection-groups";
import { isLoadedModelRow } from "../../lib/connection-identity";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { ProviderIcon } from "../connections/ProviderIcon";
import { hostOf } from "../connections/ConnectionGroup";
import { useConnectionDefaults } from "../connections/ConnectionDefaults";
import { groupJobs, JOBS_PAGE_ID, listOfJobs, useJobTileClick } from "../connections/JobsPage";
import { useModelLists } from "../../hooks/use-connections";
import { CardBrowse, changesLine } from "../connections/CardBrowse";
import { openAddConnection, openAddModels } from "../../lib/add-connection";
import type { ConnectionRowData } from "../connections/ConnectionRow";
import { builtInFirst, useDeviceEngines, useLocalModelUsedBy } from "../connections/DeviceDetail";
import { useDecisionEngine } from "./decision-engine";
import { useBuiltinEmbeddingState } from "../connections/BuiltinEmbeddingDetail";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { useDeleteConnection, useDuplicateConnection, useUpdateConnection } from "../../hooks/use-connections";
import { useFeatureModels } from "../../hooks/use-connection-accounts";
import {
  useConnectionFolders,
  useDeleteConnectionFolder,
  useUpdateConnectionFolder,
} from "../../hooks/use-connection-folders";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { jobLabelKey, rowJobs } from "../../lib/connection-jobs";
import { createConnectionExportEnvelope, type ConnectionTransferRow } from "../../lib/connection-transfer";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { confirmModelDelete } from "../connections/ConnectionRow";
import { moveBlockedKey, moveTargetsFor } from "../connections/ConnectionGroup";
import { useFolderChooser } from "../connections/ConnectionFolderGroup";
import { MoveConnectionDialog } from "../connections/MoveConnectionDialog";
import { useKitMenu, type KitAction } from "./LibraryKit";
import { ACCOUNT_PREFIX } from "./LibraryViewers";

type KindFilter = "all" | "chat" | "image" | "video" | "voice";

function rowKind(row: ConnectionRowData): Exclude<KindFilter, "all"> {
  if (row.videoGenerationSource || row.provider === "video_generation") return "video";
  if (row.imageGenerationSource || row.provider === "image_generation") return "image";
  if (row.audioSource || row.audioGenerationSource || /tts|stt|audio/.test(row.provider)) return "voice";
  return "chat";
}

function fmtContext(tokens: number | undefined) {
  if (!tokens) return null;
  if (tokens >= 1_000_000) return `${+(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}

/** The path of a Model's own address, as the table shows it ("/proxy/openai"). */
function ownAddressPath(url: string) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return path || url;
  } catch {
    return url;
  }
}

function AccountStatus({ account }: { account: ConnectionAccountListItem }) {
  const localize = useLocalizedUiText();
  const state = account.enabled === false ? "off" : account.state;
  const label = state === "ok" ? localize("Ready") : state === "needs_key" ? localize("Needs a key") : localize("Off");
  return (
    <span className={cn("ov-conn__status", `is-${state}`)}>
      <span className="ov-conn__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The Main model line, in place of the 12-cell Defaults grid: which model writes the replies (and its "if it fails"
 * model), then one sentence for every other job ("Everything else follows Main, except Images and Quick answers")
 * with a link to the Jobs page.
 */
function MainLine({ connectionsList, onJobs }: { connectionsList: ConnectionRowData[]; onJobs: () => void }) {
  const { t, i18n } = useTranslation();
  const tiles = useConnectionDefaults(connectionsList);
  const { main, own, problems } = groupJobs(tiles);
  const { click, picker } = useJobTileClick();
  if (!main) return null;
  const unset = !!main.muted && !main.follows;
  const warn = main.warning && !main.warning.quiet ? main.warning : null;
  const sentence = own.length
    ? t("connections.home.someOwn", {
        jobs: listOfJobs(
          own.map((tile) => tile.title),
          i18n.resolvedLanguage,
        ),
      })
    : t("connections.home.allFollow");
  return (
    <section className="ov-conn-main" aria-labelledby="ov-conn-main-title" data-conn-main>
      <div className="ov-conn-main__row">
        <span id="ov-conn-main-title" className="ov-conn-main__label">
          {t("connections.home.mainModel")}
        </span>
        <button
          type="button"
          className={cn("ov-conn-main__pick", unset && "is-unset", warn && "is-warn")}
          onClick={() => click(main)}
          title={[t("connections.defaults.purpose.main"), warn?.text].filter(Boolean).join("\n")}
        >
          {main.source ? (
            <ProviderIcon
              provider={main.source.provider ?? ""}
              baseUrl={main.source.baseUrl ?? undefined}
              model={main.source.model ?? undefined}
              size="sm"
            />
          ) : null}
          <span className="ov-conn-main__model">{unset ? t("connections.home.chooseMain") : main.value}</span>
          {main.hint && !unset ? <span className="ov-conn__dim">{main.hint}</span> : null}
          <ChevronDown size={13} className="ov-conn__dim" aria-hidden="true" />
        </button>
        {main.fallback ? (
          <span className="ov-conn__dim ov-conn-main__fallback">
            {t("connections.home.ifFails", { model: main.fallback })}
          </span>
        ) : null}
      </div>
      <p className="ov-conn-main__jobs">
        <span>{sentence}</span>{" "}
        <button type="button" className="ov-conn__link" onClick={onJobs} data-conn-jobs-link>
          {t("connections.home.jobs")} ›
        </button>
        {problems > 0 ? (
          <span className="ov-conn-main__warn"> · {t("connections.home.needsAttention", { count: problems })}</span>
        ) : null}
      </p>
      {picker}
    </section>
  );
}

/**
 * On this device: the built-in model and the local engines, as one card under the accounts. Engines that are set
 * up (downloaded, or in use) show; the rest wait behind "N more on this device", so a fresh install shows one line.
 */
function DeviceCard({ onOpen }: { onOpen: (item: DeviceItem) => void }) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const setup = useDeviceSetup();
  const engines = useDeviceEngines();
  const usedBy = useLocalModelUsedBy();
  const decision = useDecisionEngine();
  const embedding = useBuiltinEmbeddingState();
  const [showAll, setShowAll] = useState(false);
  // The engine list already carries the built-in model once it can run here (with its own Download), so the
  // set-up row only fills in when it is missing there.
  const builtInAvailable =
    setup["local-model"].available &&
    !setup["local-model"].setUp &&
    !engines.some((engine) => engine.item === "local-model");
  if (engines.length === 0 && !builtInAvailable && !decision && !embedding) return null;
  const rows = builtInFirst(
    [
      ...engines.map((engine) => ({
        item: engine.item,
        name: engine.name,
        detail: [engine.detail, engine.item === "local-model" && usedBy.length ? usedBy.join(", ") : null]
          .filter(Boolean)
          .join(" · "),
        tone: engine.tone,
        state: engine.state,
        fix: engine.fix,
        inUse: engine.item === "local-model" && usedBy.length > 0,
        open: () => onOpen(engine.item),
      })),
      ...(builtInAvailable
        ? [
            {
              item: "local-model" as DeviceItem,
              name: t("connections.add.device.local_model"),
              detail: localize("No account needed"),
              tone: "off" as const,
              state: t("connections.builtin.card.notDownloaded"),
              fix: {
                label: t("connections.defaults.setUp"),
                run: () => openAddConnection({ category: "device", item: "local-model" }),
              },
              inUse: false,
              open: () => openAddConnection({ category: "device", item: "local-model" }),
            },
          ]
        : []),
      ...(decision
        ? [
            {
              item: "decision" as DeviceItem,
              name: decision.name,
              detail: decision.detail,
              tone: decision.tone,
              state: decision.state,
              fix: undefined as { label: string; run: () => void } | undefined,
              inUse: false,
              open: () => onOpen("decision" as DeviceItem),
            },
          ]
        : []),
      ...(embedding
        ? [
            {
              item: "builtin-embedding" as DeviceItem,
              name: embedding.name,
              detail: embedding.detail,
              tone: embedding.tone,
              state: embedding.state,
              fix: undefined as { label: string; run: () => void } | undefined,
              inUse: false,
              open: () => onOpen("embeddings" as DeviceItem),
            },
          ]
        : []),
    ],
    (row) => row.item,
  );
  // Grow as you add: a downloaded engine, or one a job uses, earns its row.
  const ready = rows.filter((row) => row.tone !== "off" || row.inUse);
  const more = rows.filter((row) => !ready.includes(row));
  const shown = showAll ? rows : ready;
  return (
    <article className="ov-conn-card ov-conn-card--device" data-conn-device>
      <header className="ov-conn-card__head">
        <span className="ov-conn-card__name">
          <b>{t("connections.accounts.section.device")}</b>
          <span className="ov-conn__dim">{localize("No account needed")}</span>
        </span>
      </header>
      {shown.length ? (
        <div className="ov-conn-card__rows">
          {shown.map((row) => (
            <div
              key={row.item}
              className="ov-conn-row ov-conn-row--device"
              role="button"
              tabIndex={0}
              onClick={row.open}
              onKeyDown={(event) => {
                if (event.key === "Enter") row.open();
              }}
            >
              <ProviderIcon provider={row.item} size="sm" dim={row.tone !== "ok"} />
              <span className="ov-conn-row__name">
                <b>{row.name}</b>
                {row.detail ? <span className="ov-conn__dim">{row.detail}</span> : null}
              </span>
              <span className="ov-conn-row__trail">
                <span
                  className={cn(
                    "ov-conn__status",
                    row.tone === "ok" ? "is-ok" : row.tone === "warn" ? "is-needs_key" : "is-off",
                  )}
                >
                  <span className="ov-conn__dot" aria-hidden="true" />
                  {row.state}
                </span>
                {row.fix ? (
                  <button
                    type="button"
                    className="ov-conn__link"
                    onClick={(event) => {
                      event.stopPropagation();
                      row.fix!.run();
                    }}
                  >
                    {row.fix.label}
                  </button>
                ) : null}
                <ChevronRight size={14} className="ov-conn__dim" aria-hidden="true" />
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {more.length ? (
        <footer className="ov-conn-card__foot">
          <button
            type="button"
            className="ov-conn-card__browse"
            aria-expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? t("connections.home.deviceFewer")
              : ready.length
                ? t("connections.home.deviceMore", { count: more.length })
                : t("connections.home.deviceIntro", { count: more.length })}
            <ChevronDown size={13} className={cn(showAll && "rotate-180")} aria-hidden="true" />
          </button>
        </footer>
      ) : null}
    </article>
  );
}

export function ConnectionsLanding() {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const { t, i18n } = useTranslation();
  const { data: connections } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const hiddenIds = useHiddenModelIds();
  const modelStar = useModelStar();
  const openModal = useUIStore((s) => s.openModal);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const ovMobile = useOverhaulMobile();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  // Cards show their first few Models; "Show N more" opens the rest.
  const [expanded, setExpanded] = useState<string[]>([]);
  // The card whose catalog is open under its models ("Browse 164 ▾"); one at a time keeps the page short.
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // A11Y3: arrows move through the account menu; Escape closes it and returns to its ⋯.
  const menuKeys = useMenuKeyboard({ open: menu !== null, onClose: () => setMenu(null) });
  // Model actions (the classic list's ⋯): Move, Folder, Duplicate, Shuffle, Make default for, Remove.
  const modelMenu = useKitMenu();
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const { data: featureModels } = useFeatureModels();
  const { data: folders } = useConnectionFolders();
  const updateFolder = useUpdateConnectionFolder();
  const deleteFolder = useDeleteConnectionFolder();
  const chooseFolder = useFolderChooser();
  const groupBy = useUIStore((s) => s.connectionsGroupBy);
  const setGroupBy = useUIStore((s) => s.setConnectionsGroupBy);
  const byFolder = groupBy === "folder";
  const [moving, setMoving] = useState<{
    row: ConnectionRowData;
    same: ConnectionAccountListItem[];
    other: ConnectionAccountListItem[];
    splitFrom: ConnectionAccountListItem | null;
  } | null>(null);

  const rows = useMemo(
    () => ((connections as ConnectionRowData[] | undefined) ?? []).filter((row) => !hiddenIds.has(row.id)),
    [connections, hiddenIds],
  );
  const tiles = useConnectionDefaults(rows);
  const jobsByModel = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tile of tiles) {
      if (!tile.source || tile.follows || tile.muted) continue;
      map.set(tile.source.id, [...(map.get(tile.source.id) ?? []), tile.title]);
    }
    return map;
  }, [tiles]);

  const { groups, standalone } = useMemo(() => groupModelsByAccount(rows, accounts ?? []), [accounts, rows]);
  const needle = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const matchRow = (row: ConnectionRowData) =>
      (kind === "all" || rowKind(row) === kind) &&
      (!needle || `${row.name} ${row.model}`.toLowerCase().includes(needle));
    const list = groups
      .map((group) => {
        const accountHit = !needle || `${group.account.name} ${group.account.baseUrl}`.toLowerCase().includes(needle);
        const models = group.rows.filter((row) => (accountHit && kind === "all") || matchRow(row));
        const keep = kind === "all" ? accountHit || models.length > 0 : models.length > 0;
        return keep ? { account: group.account, rows: models.length || !accountHit ? models : group.rows } : null;
      })
      .filter((group): group is NonNullable<typeof group> => !!group);
    // The account that writes your replies first, then A to Z.
    const mainAccount = tiles.find((tile) => tile.key === "main")?.source?.accountId ?? null;
    list.sort(
      (a, b) =>
        Number(b.account.id === mainAccount) - Number(a.account.id === mainAccount) ||
        a.account.name.localeCompare(b.account.name),
    );
    return { groups: list, standalone: standalone.filter(matchRow) };
  }, [groups, kind, needle, standalone, tiles]);

  // An empty chat row is an account's hidden anchor, except on a server that answers with its loaded model: there it
  // is that account's Default model, and counts like any model.
  const loadedModelAccounts = new Set((accounts ?? []).filter((item) => item.loadedModel).map((item) => item.id));
  const modelCount = rows.filter(
    (row) => !(isChatProvider(row.provider) && !row.model?.trim() && !loadedModelAccounts.has(row.accountId ?? "")),
  ).length;

  const allRows = useMemo(() => (connections as ConnectionRowData[] | undefined) ?? [], [connections]);
  const modelActions = (row: ConnectionRowData): KitAction[] => {
    const title = row.name?.trim() || row.model?.trim() || row.id;
    const account = row.accountId ? accounts?.find((item) => item.id === row.accountId) : undefined;
    const { same, other } = moveTargetsFor(row, account, accounts ?? [], allRows);
    const splitFrom =
      account &&
      !row.credentialsFromConnectionId &&
      allRows.filter((candidate) => candidate.accountId === account.id).length > 1
        ? account
        : null;
    const canMove = same.length + other.length > 0 || !!splitFrom;
    const blockedKey = moveBlockedKey(row);
    const inShuffle = row.useForRandom === "true";
    const canShuffle = row.provider !== "audio" && row.provider !== "audio_generation" && row.provider !== "decision";
    const roles = rowJobs(row);
    const folderName = (folders ?? []).find((folder) => folder.id === row.folderId)?.name;
    return [
      {
        key: "edit",
        label: t("connections.row.editModel"),
        icon: <Pencil size={14} />,
        onSelect: () => openConnectionDetail(row.id),
      },
      ...(roles.length
        ? [
            {
              key: "default",
              label: t("connections.row.makeDefaultFor"),
              icon: <BadgeCheck size={14} />,
              submenu: roles.map((job) => ({
                key: job.flag,
                label: `${isConnectionFlagTrue(row[job.flag]) ? "✓ " : ""}${t(jobLabelKey(job))}`,
                onSelect: () => updateConnection.mutate({ id: row.id, [job.flag]: true }),
              })),
            },
          ]
        : []),
      {
        key: "move",
        label: t("connections.accounts.row.moveTo"),
        icon: <MoveRight size={14} />,
        disabled: !canMove,
        onSelect: () => (canMove ? setMoving({ row, same, other, splitFrom: splitFrom ?? null }) : undefined),
        ...(canMove || !blockedKey ? {} : { label: `${t("connections.accounts.row.moveTo")} (${t(blockedKey)})` }),
      },
      {
        key: "folder",
        label: folderName ? `${t("connections.folders.folder")}: ${folderName}` : t("connections.folders.moveSelected"),
        icon: <Folder size={14} />,
        onSelect: () => void chooseFolder([row]),
      },
      {
        key: "dup",
        label: t("ui.presets.sectionstab.duplicate"),
        icon: <Copy size={14} />,
        onSelect: () =>
          duplicateConnection.mutate(row.id, {
            onSuccess: (data: unknown) => {
              const id = (data as { id?: string } | undefined)?.id;
              if (id) openConnectionDetail(id);
            },
          }),
      },
      ...(canShuffle
        ? [
            {
              key: "shuffle",
              label: inShuffle
                ? t("connections.accounts.row.removeFromShuffle")
                : t("connections.accounts.row.addToShuffle"),
              icon: <Shuffle size={14} />,
              onSelect: () => updateConnection.mutate({ id: row.id, useForRandom: !inShuffle }),
            },
          ]
        : []),
      {
        key: "export",
        label: localize("Export"),
        icon: <Upload size={14} />,
        onSelect: () => void exportConnections([row]),
      },
      {
        key: "remove",
        label: t("connections.row.remove"),
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () =>
          void confirmModelDelete(row.id, title, t).then((ok) => {
            if (ok) deleteConnection.mutate(row.id);
          }),
      },
    ];
  };
  const exportConnections = async (list: ConnectionRowData[]) => {
    if (!list.length) return;
    const confirmed = await showConfirmDialog({
      title: t("ui.panels.connectionspanel.exportConnectionData"),
      message: t("connections.transfer.exportWarning"),
      confirmLabel: t("ui.characters.spritestab.export"),
      cancelLabel: t("common.close"),
    });
    if (!confirmed) return;
    const envelope = createConnectionExportEnvelope(
      list as ConnectionTransferRow[],
      accounts ?? [],
      featureModels ?? {},
    );
    const status =
      list.length > 1
        ? await downloadZipFile(
            [{ path: "marinara-connections.json", content: JSON.stringify(envelope, null, 2) }],
            "marinara-connections.zip",
          )
        : await downloadJsonFile(
            envelope,
            `${sanitizeExportFilenamePart(list[0]?.name, "connection")}.connection.json`,
          );
    if (status === "saved") toast.success(t("connections.transfer.exported", { count: list.length }));
  };
  const folderActions = (folder: { id: string; name: string }): KitAction[] => [
    {
      key: "rename",
      label: "Rename",
      icon: <Pencil size={14} />,
      onSelect: () =>
        void showPromptDialog({
          title: t("connections.folders.renameTitle"),
          message: "",
          defaultValue: folder.name,
          confirmLabel: localize("Rename"),
        }).then((name) => {
          if (name?.trim()) updateFolder.mutate({ id: folder.id, name: name.trim() });
        }),
    },
    {
      key: "delete",
      label: t("connections.folders.delete"),
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () =>
        void showConfirmDialog({
          title: localizeUi("ui.overhaul.connectionslanding.value1Value2", {
            value1: t("connections.folders.delete"),
            value2: folder.name,
          }),
          message: t("connections.folders.deleteMessage"),
          confirmLabel: localize("Delete"),
          tone: "destructive",
        }).then((ok) => {
          if (ok) deleteFolder.mutate(folder.id);
        }),
    },
  ];

  const renderModel = (row: ConnectionRowData, accountRows: ConnectionRowData[], via?: string) => {
    const anchor = (row.accountId && starAnchorOf(accountRows)) || row;
    const starred = !!row.model && parsePinnedModels(anchor.pinnedModels).includes(row.model);
    const canStar = isChatProvider(row.provider) && !!row.model && !!row.accountId;
    // The Default model has no model id, so no star: it is saved like any Model and removed from its ⋯ menu.
    const loadedModel = isLoadedModelRow(row);
    const jobs = jobsByModel.get(row.id) ?? [];
    const context = fmtContext(row.maxContext);
    // Settings of its own (sampling, context…): the Model is "tuned". Its name is the label the user gave it, so
    // two Models of one model id read as variants ("Opus creative", "Opus precise").
    const tuned = isChatProvider(row.provider) && !!(row as { ownSettings?: boolean }).ownSettings;
    // A Model with its own address on the Connection's server says which path it uses.
    const ownAddress = (row as { modelBaseUrl?: string | null }).modelBaseUrl?.trim() || "";
    const ownPath = ownAddress ? ownAddressPath(ownAddress) : "";
    return (
      <div
        key={row.id}
        className="ov-conn-row"
        role="button"
        tabIndex={0}
        data-conn-model={row.id}
        onClick={() => openConnectionDetail(row.id)}
        onContextMenu={(event) => modelMenu.openFromEvent(event, row.name || row.model, modelActions(row))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget) openConnectionDetail(row.id);
        }}
      >
        <button
          type="button"
          className={cn("ov-conn__star", starred && "is-on")}
          style={loadedModel ? { visibility: "hidden" } : undefined}
          disabled={!canStar}
          aria-pressed={starred}
          aria-label={starred ? localize("Unstar model") : localize("Star model")}
          onClick={(event) => {
            event.stopPropagation();
            if (canStar)
              void modelStar.toggle(
                { accountId: row.accountId!, model: row.model, name: row.name, anchorId: anchor.id },
                starred,
              );
          }}
        >
          <Star size={13} aria-hidden="true" />
        </button>
        <span className="ov-conn-row__name">
          <b title={row.name || row.model}>{row.name || row.model}</b>
          {row.name && row.model && row.name !== row.model ? (
            <span className="ov-conn__dim">{row.model}</span>
          ) : loadedModel ? (
            <span className="ov-conn__dim">{t("connections.loadedModel.subtitle")}</span>
          ) : null}
          {via ? <span className="ov-conn__dim">· {via}</span> : null}
          {ownPath ? (
            <span
              className="ov-conn__dim"
              title={localizeUi("ui.chat.quickreplymenu.value1Value2", {
                value1: t("connections.ownAddress.label"),
                value2: ownAddress,
              })}
            >
              · {ownPath}
            </span>
          ) : null}
        </span>
        <span className="ov-conn-row__trail">
          {tuned ? (
            <span className="ov-conn-tuned" title={t("connections.home.tunedHint")}>
              <SlidersHorizontal size={11} aria-hidden="true" />
              {t("connections.home.tuned")}
            </span>
          ) : null}
          {row.useForRandom === "true" ? (
            <span className="ov-conn__chip" title={t("connections.switcher.shuffle")}>
              <Shuffle size={11} aria-hidden="true" /> {t("connections.switcher.shuffle")}
            </span>
          ) : null}
          {jobs.map((job, index) => (
            <span key={job} className={cn("ov-conn__chip", index === 0 && jobs[0] === tiles[0]?.title && "is-main")}>
              {job}
            </span>
          ))}
          {context ? (
            <span className="ov-conn__dim ov-conn-row__ctx">
              {context} {localize("context")}
            </span>
          ) : null}
          <button
            type="button"
            className="ov-conn__more"
            aria-label={localize("Model actions")}
            aria-haspopup="menu"
            onClick={(event) => {
              event.stopPropagation();
              modelMenu.openFromEvent(event, row.name || row.model, modelActions(row), "button");
            }}
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </button>
        </span>
      </div>
    );
  };

  /** A card's first Models; the rest open with "Show N more" (a search shows every match). */
  const CARD_ROWS = 6;
  const cardRows = (key: string, list: ConnectionRowData[], render: (row: ConnectionRowData) => ReactNode) => {
    const all = !!needle || expanded.includes(key);
    const shown = all ? list : list.slice(0, CARD_ROWS);
    return (
      <>
        {shown.map(render)}
        {list.length > CARD_ROWS && !needle ? (
          <button
            type="button"
            className="ov-conn-card__more"
            aria-expanded={all}
            onClick={() =>
              setExpanded((current) =>
                current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
              )
            }
          >
            {all ? t("connections.home.showFewer") : t("connections.home.showMore", { count: list.length - CARD_ROWS })}
          </button>
        ) : null}
      </>
    );
  };

  // Each account's catalog (its first chat Model without an address of its own), for "Browse 164 models".
  const catalogIds = useMemo(
    () =>
      visible.groups.map(
        ({ account }) =>
          rows.find(
            (row) =>
              row.accountId === account.id &&
              isChatProvider(row.provider) &&
              !(row as { modelBaseUrl?: string | null }).modelBaseUrl?.trim(),
          )?.id ?? "",
      ),
    [rows, visible.groups],
  );
  const catalogLists = useModelLists(catalogIds.filter(Boolean));
  const catalogCount = (index: number) => {
    const id = catalogIds[index];
    if (!id) return null;
    return catalogLists[catalogIds.filter(Boolean).indexOf(id)]?.data?.models?.length ?? null;
  };
  const catalogChanges = (index: number) => {
    const id = catalogIds[index];
    return id ? catalogLists[catalogIds.filter(Boolean).indexOf(id)]?.data?.changes : undefined;
  };

  const renderAccount = (account: ConnectionAccountListItem, models: ConnectionRowData[], index: number) => {
    const host = hostOf(account.baseUrl) || PROVIDERS[account.provider as APIProvider]?.name || "";
    const accountRows = groups.find((g) => g.account.id === account.id)?.rows ?? [];
    const count = catalogCount(index);
    const problem = account.enabled === false || account.state !== "ok";
    const changes = changesLine(catalogChanges(index), t, i18n.language);
    const catalogId = catalogIds[index];
    const open = browsing === account.id && !!catalogId;
    const anchor = starAnchorOf(accountRows);
    return (
      <article key={account.id} className="ov-conn-card" data-connection-account-id={account.id}>
        <header className="ov-conn-card__head">
          <ProviderIcon
            provider={account.provider}
            baseUrl={account.baseUrl}
            name={account.name}
            icon={account.icon}
            imagePath={account.imagePath}
            size="sm"
            dim={account.state !== "ok"}
          />
          <button
            type="button"
            className="ov-conn-card__name"
            onClick={() => openConnectionDetail(`${ACCOUNT_PREFIX}${account.id}`)}
            title={localize("Edit account")}
          >
            <b>{account.name}</b>
            {host && !account.name.includes(host) ? <span className="ov-conn__dim">{host}</span> : null}
          </button>
          {/* Status and balance live on the account's page; the card only speaks up when something is wrong. */}
          {problem ? <AccountStatus account={account} /> : null}
          {changes && !problem ? (
            <span className="ov-conn-card__changes" title={changes.title} data-conn-changes>
              {changes.text}
            </span>
          ) : null}
          <button
            type="button"
            className="ov-conn__more"
            aria-label={localize("Account actions")}
            aria-haspopup="menu"
            aria-expanded={menu?.id === account.id}
            onClick={(event) => openMenu(event, account.id)}
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </button>
        </header>
        <div className="ov-conn-card__rows">
          {models.length ? (
            cardRows(account.id, models, (row) => renderModel(row, accountRows))
          ) : (
            <p className="ov-conn-card__empty">{localize("No models starred yet.")}</p>
          )}
        </div>
        {open && anchor ? (
          <CardBrowse
            accountId={account.id}
            accountName={account.name}
            catalogId={catalogId}
            anchorId={anchor.id}
            saved={new Set(accountRows.flatMap((row) => (row.model ? [row.model] : [])))}
            rows={rows}
          />
        ) : null}
        <footer className="ov-conn-card__foot">
          <button
            type="button"
            className="ov-conn-card__browse"
            aria-expanded={catalogId ? open : undefined}
            onClick={() =>
              catalogId ? setBrowsing(open ? null : account.id) : openAddModels({ accountId: account.id })
            }
            data-conn-browse
          >
            {count ? t("connections.home.browseCount", { count }) : t("connections.home.browse")}
            <ChevronDown size={13} aria-hidden="true" className={cn("ov-conn-card__chev", open && "is-open")} />
          </button>
          <button
            type="button"
            className={cn("ov-conn-card__account", account.state === "needs_key" && "is-warn")}
            onClick={() => openConnectionDetail(`${ACCOUNT_PREFIX}${account.id}`)}
            data-conn-account-link
          >
            {account.state === "needs_key" ? t("connections.home.fixKey") : t("connections.home.accountLink")}
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </footer>
      </article>
    );
  };

  // Group by folder: every visible Model under its folder, then the ones in none (shared with the classic list).
  const folderView = () => {
    const entries = [
      ...visible.groups.flatMap((group) =>
        group.rows.map((row) => ({
          row,
          via: group.account.name,
          accountRows: groups.find((item) => item.account.id === group.account.id)?.rows ?? [],
        })),
      ),
      ...visible.standalone.map((row) => ({ row, via: undefined as string | undefined, accountRows: [row] })),
    ];
    const list = [...(folders ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const known = new Set(list.map((folder) => folder.id));
    const sections = [
      ...list.map((folder) => ({
        id: folder.id,
        name: folder.name,
        folder,
        rows: entries.filter((entry) => entry.row.folderId === folder.id),
      })),
      {
        id: "__none",
        name: t("connections.folders.none"),
        folder: null,
        rows: entries.filter((entry) => !entry.row.folderId || !known.has(entry.row.folderId)),
      },
    ].filter((section) => section.rows.length > 0 || (section.folder && !needle && kind === "all"));
    return sections.map((section) => (
      <article
        key={section.id}
        className="ov-conn-card"
        onContextMenu={
          section.folder
            ? (event) => modelMenu.openFromEvent(event, section.name, folderActions(section.folder!))
            : undefined
        }
      >
        <header className="ov-conn-card__head">
          <Folder size={15} aria-hidden="true" />
          <span className="ov-conn-card__name">
            <b title={section.name}>{section.name}</b>
            <span className="ov-conn__dim">{section.rows.length}</span>
          </span>
          {section.folder ? (
            <button
              type="button"
              className="ov-conn__more"
              aria-label={localize("Folder actions")}
              aria-haspopup="menu"
              onClick={(event) =>
                modelMenu.openFromEvent(event, section.name, folderActions(section.folder!), "button")
              }
            >
              <MoreHorizontal size={15} aria-hidden="true" />
            </button>
          ) : null}
        </header>
        <div className="ov-conn-card__rows">
          {cardRows(
            `folder:${section.id}`,
            section.rows.map((entry) => entry.row),
            (row) => {
              const entry = section.rows.find((item) => item.row === row)!;
              return renderModel(entry.row, entry.accountRows, entry.via);
            },
          )}
        </div>
      </article>
    ));
  };

  const openMenu = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    menuKeys.noteOpener(event);
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu((current) => (current?.id === id ? null : { id, x: rect.right, y: rect.bottom + 4 }));
  };

  // Grow as you add: each tool appears once it has something to do.
  const kinds = new Set(rows.map(rowKind));
  const showKind = kinds.size > 1 || kind !== "all";
  const showGroup = (folders ?? []).length > 0 || byFolder;
  const showSearch = modelCount >= 8 || (accounts ?? []).length >= 3 || !!needle;

  const makeKindSelect = (toolsCopy = false) => (
    <select
      className={cn("ov-select", ovMobile && "ovm-lp-filter", toolsCopy && "ovm-lp-filter--tools")}
      value={kind}
      onChange={(event) => setKind(event.target.value as KindFilter)}
      aria-label={localize("Kind")}
    >
      <option value="all">{localize(ovMobile ? "All" : "All kinds")}</option>
      <option value="chat">{localize("Chat")}</option>
      <option value="image">{localize("Images")}</option>
      <option value="video">{localize("Video")}</option>
      <option value="voice">{localize("Voice")}</option>
    </select>
  );

  const makeGroupSelect = (toolsCopy = false) => (
    <select
      className={cn("ov-select", ovMobile && "ovm-lp-filter ovm-conn-group", toolsCopy && "ovm-lp-filter--tools")}
      value={groupBy}
      onChange={(event) => setGroupBy(event.target.value as "connection" | "folder")}
      aria-label={localize("Group")}
    >
      <option value="connection">{localize("By account")}</option>
      <option value="folder">{localize("By folder")}</option>
    </select>
  );

  const nothing = visible.groups.length === 0 && visible.standalone.length === 0;

  return (
    <section className="ov-list ov-conn" data-component="OverhaulConnections">
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">
          {localize("Connections")}
          <span className="ov-conn__count">
            {(accounts ?? []).length} {localize((accounts ?? []).length === 1 ? "account" : "accounts")} · {modelCount}{" "}
            {localize(modelCount === 1 ? "model" : "models")}
          </span>
        </h1>
        <button type="button" className="ov-btn" onClick={() => openModal("import-connection")}>
          <Download size={14} aria-hidden="true" />
          {localize("Import")}
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--icon"
          disabled={allRows.length === 0}
          aria-label={t("connections.list.exportAll")}
          title={t("connections.list.exportAll")}
          onClick={() => void exportConnections(allRows)}
        >
          <Upload size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--primary"
          data-ov-add-account
          data-ov-anchor="ov-add-account"
          aria-label={ovMobile ? localize("New connection") : undefined}
          onClick={() => openModal("create-connection", { anchor: "ov-add-account" })}
        >
          <Plus size={14} aria-hidden="true" />
          {ovMobile ? localize("New") : localize("New connection")}
        </button>
      </header>
      <MainLine connectionsList={rows} onJobs={() => openConnectionDetail(JOBS_PAGE_ID)} />
      {showSearch || showKind || showGroup ? (
        <div className="ov-gallery__tools">
          {showSearch ? (
            <label className="ov-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={localize("Search accounts and models")}
                aria-label={localize("Search accounts and models")}
              />
            </label>
          ) : (
            <span className="ov-gallery__spacer" />
          )}
          {showKind ? makeKindSelect(ovMobile) : null}
          {showGroup ? makeGroupSelect(ovMobile) : null}
        </div>
      ) : null}
      {nothing && (needle || kind !== "all") ? (
        <p className="ov-list__empty">{localize("Nothing matches.")}</p>
      ) : nothing && !accounts?.length ? (
        <p className="ov-list__empty">{localize("No accounts yet.")}</p>
      ) : (
        <div className="ov-conn-cards">
          {byFolder ? (
            folderView()
          ) : (
            <>
              {visible.groups.map(({ account, rows: models }, index) => renderAccount(account, models, index))}
              {visible.standalone.length ? (
                <article className="ov-conn-card">
                  <header className="ov-conn-card__head">
                    <span className="ov-conn-card__name">
                      <b>{localize("Other models")}</b>
                    </span>
                  </header>
                  <div className="ov-conn-card__rows">
                    {cardRows("__other", visible.standalone, (row) => renderModel(row, [row]))}
                  </div>
                </article>
              ) : null}
            </>
          )}
          {!needle && kind === "all" ? <DeviceCard onOpen={(item) => openConnectionDetail(`device:${item}`)} /> : null}
        </div>
      )}
      {modelMenu.node}
      {chooseFolder.dialog}
      {moving ? (
        <MoveConnectionDialog
          {...moving}
          rowsOf={(accountId) => allRows.filter((candidate) => candidate.accountId === accountId)}
          onClose={() => setMoving(null)}
        />
      ) : null}
      {menu ? (
        <>
          <div className="ov-conn__menu-scrim" onClick={() => setMenu(null)} />
          <div
            ref={menuKeys.menuRef}
            className="ov-menu ov-conn__menu"
            role="menu"
            style={{ top: menu.y, left: menu.x }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openModal("connection-account", { accountId: menu.id });
                setMenu(null);
              }}
            >
              {localize("Edit account")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openModal("connection-account", { accountId: menu.id, replaceKey: true });
                setMenu(null);
              }}
            >
              {localize("Replace key")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openAddModels({ accountId: menu.id });
                setMenu(null);
              }}
            >
              {t("connections.accounts.addModel")}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
