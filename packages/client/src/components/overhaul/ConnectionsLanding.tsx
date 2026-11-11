// ──────────────────────────────────────────────
// New layout: the Connections landing page (board 1-2, "ConnList").
// Accounts in one table, each folding open to its Models; a compact Defaults grid on top
// says which Model each job uses. Model rows open the Model editor; the account name opens
// the account editor. Add account opens the add window anchored under its button.
// ──────────────────────────────────────────────
import { Fragment, useMemo, useState, type MouseEvent } from "react";
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
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { isChatProvider, parsePinnedModels, PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import type { ConnectionAccountListItem } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts, useConnectionBalance } from "../../hooks/use-connection-accounts";
import { starAnchorOf, useHiddenModelIds, useModelStar } from "../../hooks/use-model-star";
import { groupModelsByAccount } from "../../lib/connection-groups";
import { JOB, type JobKey } from "../../lib/connection-jobs";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { ProviderIcon } from "../connections/ProviderIcon";
import { balanceWord } from "../connections/ConnectionBalance";
import { hostOf } from "../connections/ConnectionGroup";
import { JobPickerWindow, useConnectionDefaults, type DefaultsTile } from "../connections/ConnectionDefaults";
import { openAddConnection, openAddModels } from "../../lib/add-connection";
import type { ConnectionRowData } from "../connections/ConnectionRow";
import { useDeviceEngines, useLocalModelUsedBy } from "../connections/DeviceDetail";
import { useDecisionEngine } from "./decision-engine";
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

type KindFilter = "all" | "chat" | "image" | "video" | "voice";
type SortKey = "name" | "models" | "recent";

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

function AccountBalance({ account }: { account: ConnectionAccountListItem }) {
  const { t, i18n } = useTranslation();
  const localize = useLocalizedUiText();
  const { data } = useConnectionBalance(account.id, account.state === "ok" && !!account.balanceSource);
  const word = balanceWord(data?.balance, t, i18n.resolvedLanguage);
  if (word) return <>{word}</>;
  if (account.billing === "free") return <>{localize("Free")}</>;
  if (account.billing === "plan") return <>{localize("Plan")}</>;
  if (account.treatAsLocalEndpoint) return <>{localize("Self-hosted")}</>;
  return <span className="ov-conn__dim">—</span>;
}

function DefaultsGrid({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const tiles = useConnectionDefaults(connectionsList);
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState<JobKey | null>(null);
  const problems = tiles.filter((tile) => tile.warning && !tile.warning.quiet).length;
  const click = (tile: DefaultsTile) => {
    if (tile.setup?.item) return openAddConnection({ category: "device", item: tile.setup.item });
    if (tile.device) return openAddConnection({ category: "device", item: tile.device });
    setPicking(tile.key);
  };
  return (
    <section className="ov-conn-defaults" aria-labelledby="ov-conn-defaults-title">
      <button
        type="button"
        className="ov-conn-defaults__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={13} className={cn(!open && "-rotate-90")} aria-hidden="true" />
        <span id="ov-conn-defaults-title" className="ov-conn-defaults__title">
          {localize("Defaults")}
        </span>
        <span className="ov-conn__dim">{localize("which model each job uses")}</span>
        {problems > 0 ? (
          <span className="ov-conn-defaults__warn">
            {problems === 1
              ? localize("1 needs attention")
              : localizeUi("ui.chat.scheduletimeline.value1Value2", {
                  value1: problems,
                  value2: localize("need attention"),
                })}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="ov-conn-defaults__grid">
          {tiles.map((tile) => {
            const unset = !!tile.muted && !tile.follows;
            return (
              <button
                key={tile.key}
                type="button"
                className="ov-conn-defaults__cell"
                onClick={() => click(tile)}
                title={tile.warning?.text ?? [tile.follows, tile.value, tile.hint].filter(Boolean).join(" · ")}
              >
                <span className="ov-conn-defaults__job">{tile.title}</span>
                <span
                  className={cn(
                    "ov-conn-defaults__value",
                    unset && "is-unset",
                    tile.warning && !tile.warning.quiet && "is-warn",
                  )}
                >
                  {tile.follows ? (
                    tile.follows
                  ) : (
                    <>
                      {tile.hint ? <span className="ov-conn__dim">{tile.hint} · </span> : null}
                      {tile.value}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {picking ? <JobPickerWindow job={JOB[picking]} onClose={() => setPicking(null)} /> : null}
    </section>
  );
}

/**
 * On this device: the built-in model and the local voice engines. They are not accounts, so they get their
 * own group under the accounts; a row opens the engine's page, or its set-up window before it is set up.
 */
function DeviceRows({ onOpen }: { onOpen: (item: DeviceItem) => void }) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const setup = useDeviceSetup();
  const engines = useDeviceEngines();
  const usedBy = useLocalModelUsedBy();
  const decision = useDecisionEngine();
  const builtInAvailable = setup["local-model"].available && !setup["local-model"].setUp;
  if (engines.length === 0 && !builtInAvailable && !decision) return null;
  const rows = [
    ...engines.map((engine) => ({
      item: engine.item,
      name: engine.name,
      detail: [engine.detail, engine.item === "local-model" && usedBy.length ? usedBy.join(", ") : null]
        .filter(Boolean)
        .join(" · "),
      tone: engine.tone,
      state: engine.state,
      fix: engine.fix,
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
            open: () => openAddConnection({ category: "device", item: "local-model" }),
          },
        ]
      : []),
    ...(decision
      ? [
          {
            item: "decision" as DeviceItem,
            name: decision.name,
            detail: "",
            tone: decision.tone,
            state: decision.state,
            fix: undefined as { label: string; run: () => void } | undefined,
            open: () => onOpen("decision" as DeviceItem),
          },
        ]
      : []),
  ];
  return (
    <>
      <tr className="ov-conn__account is-open ov-conn__account--other">
        <td className="ov-conn__lead" />
        <td colSpan={6}>
          <b>{t("connections.accounts.section.device")}</b>
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.item}
          className="ov-conn__account ov-conn__device"
          tabIndex={0}
          onClick={row.open}
          onKeyDown={(event) => {
            if (event.key === "Enter") row.open();
          }}
        >
          <td className="ov-conn__lead" />
          <td colSpan={3}>
            <span className="ov-conn__acct">
              <ProviderIcon provider={row.item} size="sm" dim={row.tone !== "ok"} />
              <b>{row.name}</b>
              {row.detail ? <span className="ov-conn__dim">{row.detail}</span> : null}
            </span>
          </td>
          <td colSpan={2}>
            <span className="ov-conn__devstate">
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
            </span>
          </td>
          <td className="ov-conn__act">
            <ChevronRight size={14} className="ov-conn__dim" aria-hidden="true" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function ConnectionsLanding() {
  const localize = useLocalizedUiText();
  const { t } = useTranslation();
  const { data: connections } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const hiddenIds = useHiddenModelIds();
  const modelStar = useModelStar();
  const openModal = useUIStore((s) => s.openModal);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const ovMobile = useOverhaulMobile();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [openIds, setOpenIds] = useState<string[] | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
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
    list.sort((a, b) =>
      sort === "models"
        ? b.rows.length - a.rows.length || a.account.name.localeCompare(b.account.name)
        : sort === "recent"
          ? b.account.updatedAt.localeCompare(a.account.updatedAt)
          : a.account.name.localeCompare(b.account.name),
    );
    return { groups: list, standalone: standalone.filter(matchRow) };
  }, [groups, kind, needle, sort, standalone]);

  // Every account starts folded except the first, unless a search is on (then all open).
  const isOpen = (id: string) =>
    needle ? true : openIds ? openIds.includes(id) : id === visible.groups[0]?.account.id;
  const toggle = (id: string) =>
    setOpenIds((current) => {
      const base = current ?? (visible.groups[0] ? [visible.groups[0].account.id] : []);
      return base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
    });

  const modelCount = rows.filter((row) => !(isChatProvider(row.provider) && !row.model?.trim())).length;

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
          title: `${t("connections.folders.delete")}: ${folder.name}?`,
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
    const jobs = jobsByModel.get(row.id) ?? [];
    const context = fmtContext(row.maxContext);
    const output = fmtContext(row.maxTokensOverride ?? undefined);
    return (
      <tr
        key={row.id}
        className="ov-conn__model"
        tabIndex={0}
        onClick={() => openConnectionDetail(row.id)}
        onContextMenu={(event) => modelMenu.openFromEvent(event, row.name || row.model, modelActions(row))}
        onKeyDown={(event) => {
          if (event.key === "Enter") openConnectionDetail(row.id);
        }}
      >
        <td className="ov-conn__lead" />
        <td colSpan={3}>
          <span className="ov-conn__model-line">
            <span className="ov-conn__model-name">
              <button
                type="button"
                className={cn("ov-conn__star", starred && "is-on")}
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
              <b>{row.name || row.model}</b>
              {row.name && row.model && row.name !== row.model ? (
                <span className="ov-conn__dim">{row.model}</span>
              ) : null}
              {via ? <span className="ov-conn__dim">· {via}</span> : null}
            </span>
            <span className="ov-conn__dim ov-conn__ctx">
              {[context && `${context} ${localize("context")}`, output && `${output} ${localize("out")}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </td>
        <td colSpan={2}>
          <span className="ov-conn__chips">
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
          </span>
        </td>
        <td className="ov-conn__act">
          <button
            type="button"
            className="ov-conn__more"
            aria-label={localize("Model actions")}
            aria-haspopup="menu"
            onClick={(event) => modelMenu.openFromEvent(event, row.name || row.model, modelActions(row), "button")}
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </button>
        </td>
      </tr>
    );
  };

  // Group by folder: every visible Model under its folder, then the ones in none (shared with the classic list).
  const [closedFolders, setClosedFolders] = useState<string[]>([]);
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
    return sections.map((section) => {
      const open = needle ? true : !closedFolders.includes(section.id);
      const flip = () =>
        setClosedFolders((current) =>
          current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id],
        );
      return (
        <Fragment key={section.id}>
          <tr
            className={cn("ov-conn__account", open && "is-open")}
            tabIndex={0}
            aria-expanded={open}
            onClick={flip}
            onContextMenu={
              section.folder
                ? (event) => modelMenu.openFromEvent(event, section.name, folderActions(section.folder!))
                : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flip();
              }
            }}
          >
            <td className="ov-conn__lead">
              {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </td>
            <td colSpan={2}>
              <span className="ov-conn__acct">
                <Folder size={15} aria-hidden="true" />
                <b>{section.name}</b>
              </span>
            </td>
            <td className="ov-conn__num">{section.rows.length}</td>
            <td colSpan={2} />
            <td className="ov-conn__act">
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
            </td>
          </tr>
          {open ? section.rows.map((entry) => renderModel(entry.row, entry.accountRows, entry.via)) : null}
        </Fragment>
      );
    });
  };

  const openMenu = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu((current) => (current?.id === id ? null : { id, x: rect.right, y: rect.bottom + 4 }));
  };

  const kindSelect = (
    <select
      className={cn("ov-select", ovMobile && "ovm-lp-filter")}
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

  // Phones: the grouping sits beside the kind filter on the header line; search and sort share the next line.
  const groupSelect = (
    <select
      className={cn("ov-select", ovMobile && "ovm-lp-filter ovm-conn-group")}
      value={groupBy}
      onChange={(event) => setGroupBy(event.target.value as "connection" | "folder")}
      aria-label={localize("Group")}
    >
      <option value="connection">{localize("By account")}</option>
      <option value="folder">{localize("By folder")}</option>
    </select>
  );

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
        {ovMobile && kindSelect}
        {ovMobile && groupSelect}
      </header>
      {!ovMobile && (
        <div className="ov-gallery__tools">
          {kindSelect}
          <span className="ov-gallery__spacer" />
          <span className="ov-conn__dim ov-conn__note">{localize("Balance shown where the service reports it")}</span>
        </div>
      )}
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize("Search accounts and models")}
          />
        </label>
        <select
          className="ov-select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label={localize("Sort")}
        >
          <option value="name">{localize("A to Z")}</option>
          <option value="models">{localize("Most models")}</option>
          <option value="recent">{localize("Recent")}</option>
        </select>
        {!ovMobile && groupSelect}
      </div>
      <DefaultsGrid connectionsList={rows} />
      {visible.groups.length === 0 && visible.standalone.length === 0 && (needle || kind !== "all") ? (
        <p className="ov-list__empty">
          {rows.length || accounts?.length ? localize("Nothing matches.") : localize("No accounts yet.")}
        </p>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table ov-conn__table">
            <thead>
              <tr>
                <th className="ov-conn__lead" aria-hidden="true" />
                <th>{localize(byFolder ? "Folder" : "Account")}</th>
                <th className="ov-conn__fill" aria-hidden="true" />
                <th className="ov-conn__num">{localize("Models")}</th>
                <th>{localize("Status")}</th>
                <th className="ov-conn__bal">{localize("Balance")}</th>
                <th className="ov-conn__act" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {byFolder ? (
                folderView()
              ) : (
                <>
                  {visible.groups.map(({ account, rows: models }) => {
                    const open = isOpen(account.id);
                    const host = hostOf(account.baseUrl) || PROVIDERS[account.provider as APIProvider]?.name || "";
                    return (
                      <Fragment key={account.id}>
                        <tr
                          className={cn("ov-conn__account", open && "is-open")}
                          tabIndex={0}
                          aria-expanded={open}
                          onClick={() => toggle(account.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggle(account.id);
                            }
                          }}
                        >
                          <td className="ov-conn__lead">
                            {open ? (
                              <ChevronDown size={14} aria-hidden="true" />
                            ) : (
                              <ChevronRight size={14} aria-hidden="true" />
                            )}
                          </td>
                          <td colSpan={2}>
                            <span className="ov-conn__acct">
                              <ProviderIcon
                                provider={account.provider}
                                baseUrl={account.baseUrl}
                                name={account.name}
                                icon={account.icon}
                                imagePath={account.imagePath}
                                size="sm"
                                dim={account.state !== "ok"}
                              />
                              <b>{account.name}</b>
                              {host && !account.name.includes(host) ? (
                                <span className="ov-conn__dim">{host}</span>
                              ) : null}
                            </span>
                          </td>
                          <td className="ov-conn__num">{models.length}</td>
                          <td>
                            <AccountStatus account={account} />
                          </td>
                          <td className="ov-conn__bal">
                            <AccountBalance account={account} />
                          </td>
                          <td className="ov-conn__act">
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
                          </td>
                        </tr>
                        {open ? (
                          models.length ? (
                            models.map((row) =>
                              renderModel(row, groups.find((g) => g.account.id === account.id)?.rows ?? []),
                            )
                          ) : (
                            <tr className="ov-conn__model ov-conn__model--empty">
                              <td className="ov-conn__lead" />
                              <td colSpan={6} className="ov-conn__dim">
                                {localize("No models starred yet.")}{" "}
                                <button
                                  type="button"
                                  className="ov-conn__link"
                                  onClick={() => openAddModels({ accountId: account.id })}
                                >
                                  {t("connections.accounts.addModel")}
                                </button>
                              </td>
                            </tr>
                          )
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {visible.standalone.length ? (
                    <>
                      <tr className="ov-conn__account is-open ov-conn__account--other">
                        <td className="ov-conn__lead" />
                        <td colSpan={6}>
                          <b>{localize("Other models")}</b>
                        </td>
                      </tr>
                      {visible.standalone.map((row) => renderModel(row, [row]))}
                    </>
                  ) : null}
                </>
              )}
              {!needle && kind === "all" ? (
                <DeviceRows onOpen={(item) => openConnectionDetail(`device:${item}`)} />
              ) : null}
            </tbody>
          </table>
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
          <div className="ov-menu ov-conn__menu" role="menu" style={{ top: menu.y, left: menu.x }}>
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
