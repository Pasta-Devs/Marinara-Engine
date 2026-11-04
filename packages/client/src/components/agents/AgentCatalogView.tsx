import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  MoreHorizontal,
  Check,
  Download,
  ExternalLink,
  GitFork,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { compareCapabilityPackageVersions, type CapabilityCatalogPackage } from "@marinara-engine/shared";
import { toast } from "sonner";
import {
  isAppCapabilityPackage,
  useCapabilityCatalog,
  useInstallAllCapabilityPackages,
  useInstallCapabilityPackage,
  useInstalledCapabilityPackages,
  useUninstallAllCapabilityPackages,
  useUninstallCapabilityPackage,
} from "../../hooks/use-capability-packages";
import { useCustomAgentRepositories } from "../../hooks/use-custom-agent-repositories";
import { ApiError, getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { isAgentCatalogKindBadgeVisible } from "../../lib/agent-catalog-kind-badges";
import { AgentVersionHistory } from "./AgentVersionHistory";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { notifyDecisionImport } from "../../lib/decision-import-notice";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulLook, useOverhaulStore } from "../../stores/overhaul.store";
import { AgentArtwork } from "./AgentArtwork";
import { AgentModeFilter, type AgentModeFilterValue } from "./AgentModeFilter";
import { CustomAgentRepositoriesModal } from "./CustomAgentRepositoriesModal";
import { useTranslation as useUiTranslation } from "react-i18next";

const CATEGORY_SECTIONS = [
  { id: "app", labelKey: "ui.agents.agentcatalogview.apps" },
  { id: "writer", labelKey: "ui.agents.agentcatalogview.writerAgents" },
  { id: "tracker", labelKey: "ui.agents.agentcatalogview.trackerAgents" },
  { id: "misc", labelKey: "ui.agents.agentcatalogview.miscAgents" },
] as const;

/** Standalone apps get their own section, whatever category their catalog entry names. */
function catalogCategory({ manifest, category }: Pick<CapabilityCatalogPackage, "manifest" | "category">) {
  return isAppCapabilityPackage(manifest) ? "app" : category;
}

type CatalogMode = "conversation" | "roleplay" | "game";

const OFFICIAL_PACKAGE_MODES: Readonly<Record<string, readonly CatalogMode[]>> = Object.freeze({
  beholder: ["roleplay"],
  "card-evolution-auditor": ["roleplay"],
  continuity: ["roleplay"],
  "knowledge-retrieval": ["roleplay"],
  "knowledge-router": ["roleplay"],
  director: ["roleplay"],
  "prose-guardian": ["roleplay"],
  background: ["roleplay"],
  "character-tracker": ["roleplay"],
  "custom-tracker": ["roleplay"],
  "inventory-tracker": ["roleplay"],
  quartermaster: ["roleplay"],
  "relationship-tracker": ["roleplay"],
  "memory-nag": ["roleplay"],
  "long-term-memory": ["conversation", "roleplay", "game"],
  expression: ["roleplay"],
  "gacha-forge": ["conversation", "roleplay", "game"],
  "hierarchical-maps": ["roleplay", "game"],
  "persona-stats": ["roleplay"],
  quest: ["roleplay"],
  "world-state": ["roleplay"],
  "2d-avatars": ["roleplay", "game"],
  "3d-avatars": ["roleplay", "game"],
  eightball: ["conversation"],
  chess: ["conversation"],
  combat: ["roleplay"],
  "conversation-calls": ["conversation"],
  cyoa: ["roleplay"],
  "echo-chamber": ["roleplay"],
  haptic: ["conversation", "roleplay", "game"],
  illustrator: ["conversation", "roleplay", "game"],
  storyboard: ["roleplay", "game"],
  html: ["roleplay"],
  "lorebook-keeper": ["roleplay", "game"],
  noodle: ["conversation", "roleplay", "game"],
  slurp: ["conversation", "roleplay", "game"],
  spotify: ["conversation", "roleplay", "game"],
  poker: ["conversation"],
  "rock-paper-scissors": ["conversation"],
  "ruleset-5e-2014": ["game"],
  "tic-tac-toe": ["conversation"],
  uno: ["conversation"],
});

const MODE_BADGES: Record<CatalogMode, { labelKey: string; className: string }> = {
  conversation: {
    labelKey: "ui.agents.agentcatalogview.conversationMode",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-cyan)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-cyan)_18%,transparent)]",
  },
  roleplay: {
    labelKey: "ui.agents.agentcatalogview.roleplayMode",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-orange)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-orange)_18%,transparent)]",
  },
  game: {
    labelKey: "ui.agents.agentcatalogview.gameMode",
    className:
      "border-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_55%,var(--border))] bg-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_18%,transparent)]",
  },
};

const DETAIL_ACTION_CLASS = "mari-chrome-control mari-chrome-control--primary px-4 py-2.5 max-sm:flex-1";

type BulkActionProgress = {
  action: "install" | "uninstall";
  completed: number;
  total: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function catalogErrorDescription(error: unknown) {
  const offlineSuffix = "Installed agents remain available offline.";
  if (error instanceof ApiError) {
    return `Marinara Engine returned HTTP ${error.status}: ${error.message}. ${offlineSuffix}`;
  }
  if (error instanceof Error && error.message) return `${error.message}. ${offlineSuffix}`;
  return `Marinara Engine could not load the official catalog. ${offlineSuffix}`;
}

function kindLabel(kind: CapabilityCatalogPackage["manifest"]["kind"][number]) {
  if (kind === "conversation-calls") return "Calls";
  if (kind === "turn-game") return "Conversation Game";
  if (kind === "maps") return "Maps";
  if (kind === "ruleset") return "Rules";
  return "Agent";
}

function packageModes(packageId: string): readonly CatalogMode[] {
  return OFFICIAL_PACKAGE_MODES[packageId] ?? [];
}

export function AgentCatalogView() {
  const { t: localizeUi } = useUiTranslation();
  const closeAgentCatalog = useUIStore((state) => state.closeAgentCatalog);
  const initialPackageId = useUIStore((state) => state.agentCatalogInitialPackageId);
  const catalog = useCapabilityCatalog();
  const installed = useInstalledCapabilityPackages();
  const install = useInstallCapabilityPackage();
  const uninstall = useUninstallCapabilityPackage();
  const installAll = useInstallAllCapabilityPackages();
  const uninstallAll = useUninstallAllCapabilityPackages();
  const customRepositories = useCustomAgentRepositories();
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<AgentModeFilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialPackageId);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialPackageId));
  const [bulkProgress, setBulkProgress] = useState<BulkActionProgress | null>(null);
  const [customRepositoriesOpen, setCustomRepositoriesOpen] = useState(false);
  const hasActiveFilters = Boolean(query.trim()) || modeFilter !== "all";
  const overhaulActive = useOverhaulLook();
  const [ovMenuOpen, setOvMenuOpen] = useState(false);
  const [ovClosed, setOvClosed] = useState<Record<string, boolean>>({});
  const ovMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ovMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!ovMenuRef.current?.contains(event.target as Node)) setOvMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [ovMenuOpen]);

  const installedById = useMemo(() => new Map((installed.data ?? []).map((item) => [item.id, item])), [installed.data]);
  const packages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog.data?.packages ?? []).filter(
      ({ manifest, category }) =>
        (modeFilter === "all" || packageModes(manifest.id).includes(modeFilter)) &&
        (!needle ||
          [
            manifest.name,
            manifest.description,
            manifest.id,
            catalogCategory({ manifest, category }),
            localizeUi(
              CATEGORY_SECTIONS.find((section) => section.id === catalogCategory({ manifest, category }))?.labelKey ??
                "",
            ),
            ...manifest.kind.map(kindLabel),
            ...packageModes(manifest.id).map((mode) => localizeUi(MODE_BADGES[mode].labelKey)),
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [catalog.data, localizeUi, modeFilter, query]);
  const packageGroups = useMemo(
    () => [
      {
        id: "installed",
        title: "Installed Agents",
        entries: packages.filter((entry) => installedById.has(entry.manifest.id)),
      },
      {
        id: "uninstalled",
        title: "Uninstalled Agents",
        entries: packages.filter((entry) => !installedById.has(entry.manifest.id)),
      },
    ],
    [installedById, packages],
  );
  const installablePackageIds = useMemo(
    () =>
      (catalog.data?.packages ?? [])
        .filter((entry) => !installedById.has(entry.manifest.id))
        .map((entry) => entry.manifest.id),
    [catalog.data, installedById],
  );
  const installedPackageIds = useMemo(() => (installed.data ?? []).map((entry) => entry.id), [installed.data]);
  const bulkActionPending = installAll.isPending || uninstallAll.isPending;
  const packageActionPending = install.isPending || uninstall.isPending || bulkActionPending;
  const selected =
    (catalog.data?.packages ?? []).find((item) => item.manifest.id === selectedId) ?? packages[0] ?? null;
  const selectedInstalled = selected ? installedById.get(selected.manifest.id) : undefined;
  const installedPermissions = selectedInstalled?.manifest.permissions;
  const permissionGroups = selected
    ? [
        ...(selectedInstalled
          ? [
              {
                kind: "installed",
                version: selectedInstalled.version,
                permissions: selectedInstalled.manifest.permissions,
              },
            ]
          : []),
        ...(!installedPermissions ||
        installedPermissions.length !== selected.manifest.permissions.length ||
        selected.manifest.permissions.some((permission) => !installedPermissions.includes(permission))
          ? [{ kind: "available", version: selected.manifest.version, permissions: selected.manifest.permissions }]
          : []),
      ]
    : [];
  const selectedVersionComparison = selectedInstalled
    ? compareCapabilityPackageVersions(selected.manifest.version, selectedInstalled.version)
    : 0;

  useEffect(() => {
    if (packages.length === 0) return;
    if (!selectedId && packages[0]) setSelectedId(packages[0].manifest.id);
    if (selectedId && !packages.some((item) => item.manifest.id === selectedId)) {
      setSelectedId(packages[0]?.manifest.id ?? null);
      setMobileDetail(false);
    }
  }, [packages, selectedId]);

  const handleInstall = async (entry: CapabilityCatalogPackage) => {
    const isUpdate = installedById.has(entry.manifest.id);
    try {
      const result = await install.mutateAsync({
        id: entry.manifest.id,
        expectedVersion: entry.manifest.version,
        expectedArtifactSha256: entry.artifact.sha256,
      });
      void notifyDecisionImport(result.usesDecisions ?? false, localizeUi);
      toast.success(
        result.status === "restart-required"
          ? localizeUi(
              isUpdate
                ? "ui.agents.agentcatalogview.agentUpdatedRestartRequired"
                : "ui.agents.agentcatalogview.agentInstalledRestartRequired",
            )
          : localizeUi(
              isUpdate
                ? "ui.agents.agentcatalogview.agentUpdatedReadyToUse"
                : "ui.agents.agentcatalogview.agentInstalledReadyToUse",
            ),
      );
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(error, localizeUi("ui.agents.agentcatalogview.agentInstallationFailed")),
      );
    }
  };

  const handleUninstall = async (entry: CapabilityCatalogPackage) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.agents.agentcatalogview.uninstallValue1", { value1: entry.manifest.name }),
      message: localizeUi("ui.agents.agentcatalogview.theDownloadedPackageActiveChatSelectionsAndAgentConfiguration"),
      confirmLabel: localizeUi("ui.agents.agentcatalogview.uninstall"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      const result = await uninstall.mutateAsync(entry.manifest.id);
      toast.success(
        result.restartRequired
          ? localizeUi("ui.agents.agentcatalogview.value1UninstalledRestartMarinaraEngineToFinishRemoval", {
              value1: entry.manifest.name,
            })
          : localizeUi("ui.agents.agentcatalogview.value1Uninstalled", { value1: entry.manifest.name }),
      );
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(error, localizeUi("ui.agents.agentcatalogview.agentUninstallFailed")),
      );
    }
  };

  const handleInstallAll = async () => {
    if (installablePackageIds.length === 0 || packageActionPending) return;
    const total = installablePackageIds.length;
    setBulkProgress({ action: "install", completed: 0, total });
    try {
      const result = await installAll.mutateAsync({
        packages: (catalog.data?.packages ?? []).filter((entry) => installablePackageIds.includes(entry.manifest.id)),
        onProgress: (completed) => setBulkProgress({ action: "install", completed, total }),
      });
      void notifyDecisionImport(result.usesDecisions, localizeUi);
      if (result.failures.length === 0) {
        toast.success(
          result.restartRequired
            ? localizeUi("ui.agents.agentcatalogview.value1AgentsInstalledRestartMarinaraEngineToFinishSetup", {
                value1: result.succeeded.length,
              })
            : localizeUi("ui.agents.agentcatalogview.value1AgentsInstalledAndReadyToUse", {
                value1: result.succeeded.length,
              }),
        );
      } else {
        const firstFailure = result.failures[0];
        const description = firstFailure
          ? getPrivilegedActionErrorMessage(firstFailure.error, `${firstFailure.id} could not be installed.`)
          : undefined;
        const message = `${result.succeeded.length} of ${total} agents installed. ${result.failures.length} failed.`;
        if (result.succeeded.length === 0) toast.error(message, { description });
        else toast.warning(message, { description });
      }
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(error, localizeUi("ui.agents.agentcatalogview.bulkAgentInstallationFailed")),
      );
    } finally {
      setBulkProgress(null);
    }
  };

  const handleUninstallAll = async () => {
    if (installedPackageIds.length === 0 || packageActionPending) return;
    const total = installedPackageIds.length;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.agents.agentcatalogview.uninstallAllValue1Agents", { value1: total }),
      message: localizeUi("ui.agents.agentcatalogview.everyDownloadedPackageActiveChatSelectionAndAgentConfiguration"),
      confirmLabel: localizeUi("ui.agents.agentcatalogview.uninstallAll"),
      tone: "destructive",
    });
    if (!confirmed) return;

    setBulkProgress({ action: "uninstall", completed: 0, total });
    try {
      const result = await uninstallAll.mutateAsync({
        ids: installedPackageIds,
        onProgress: (completed) => setBulkProgress({ action: "uninstall", completed, total }),
      });
      if (result.failures.length === 0) {
        toast.success(
          result.restartRequired
            ? localizeUi("ui.agents.agentcatalogview.value1AgentsUninstalledRestartMarinaraEngineToFinishRemoval", {
                value1: result.succeeded.length,
              })
            : localizeUi("ui.agents.agentcatalogview.value1AgentsUninstalled", { value1: result.succeeded.length }),
        );
      } else {
        const firstFailure = result.failures[0];
        const description = firstFailure
          ? getPrivilegedActionErrorMessage(firstFailure.error, `${firstFailure.id} could not be uninstalled.`)
          : undefined;
        const message = `${result.succeeded.length} of ${total} agents uninstalled. ${result.failures.length} failed.`;
        if (result.succeeded.length === 0) toast.error(message, { description });
        else toast.warning(message, { description });
      }
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(error, localizeUi("ui.agents.agentcatalogview.bulkAgentUninstallFailed")),
      );
    } finally {
      setBulkProgress(null);
    }
  };

  if (overhaulActive) {
    const categoryLabel = (entry: CapabilityCatalogPackage) =>
      localizeUi(
        CATEGORY_SECTIONS.find((category) => category.id === catalogCategory(entry))?.labelKey ??
          "ui.agents.agentcatalogview.miscAgents",
      );
    const hasUpdate = (entry: CapabilityCatalogPackage) => {
      const current = installedById.get(entry.manifest.id);
      return current ? compareCapabilityPackageVersions(entry.manifest.version, current.version) > 0 : false;
    };
    const modeChips = (entry: CapabilityCatalogPackage) =>
      packageModes(entry.manifest.id).map((mode) => (
        <span key={mode} className={cn("ov-dl__mode", `is-${mode}`)} title={localizeUi(MODE_BADGES[mode].labelKey)}>
          {localizeUi(MODE_BADGES[mode].labelKey).slice(0, 1)}
        </span>
      ));
    const renderRow = (entry: CapabilityCatalogPackage, isInstalled: boolean) => {
      const active = entry.manifest.id === selected?.manifest.id;
      const update = isInstalled && hasUpdate(entry);
      return (
        <div
          key={entry.manifest.id}
          role="option"
          tabIndex={0}
          aria-selected={active}
          className={cn("ov-vw__row", active && "is-on")}
          onClick={() => setSelectedId(entry.manifest.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedId(entry.manifest.id);
            }
          }}
        >
          <span className="ov-vw__lead">
            <span className="ov-dl__icon">
              <AgentArtwork imageUrl={entry.iconUrl} alt="" iconSize="0.85rem" />
            </span>
          </span>
          <span className="ov-vw__text">
            <span className="ov-vw__name">{entry.manifest.name}</span>
            <small>{isInstalled ? categoryLabel(entry) : entry.manifest.description}</small>
          </span>
          <span className="ov-vw__trail ov-dl__trail">
            {modeChips(entry)}
            {isInstalled ? (
              <span className={cn("ov-dl__state", update && "is-update")}>
                {update
                  ? localizeUi("ui.agents.agentcatalogview.update")
                  : localizeUi("ui.agents.agentcatalogview.installed_7bb4405")}
              </span>
            ) : null}
          </span>
        </div>
      );
    };
    const [installedGroup, availableGroup] = packageGroups;
    const selectedUpdate = selected ? hasUpdate(selected) : false;
    const busyInstall = install.isPending && install.variables?.id === selected?.manifest.id;
    return (
      <div data-component="AgentCatalogView" className="ov-dl">
        <header className="ov-dl__head">
          <div className="ov-dl__title">
            <p className="ov-vw__crumb">
              <button
                type="button"
                onClick={() => {
                  closeAgentCatalog();
                  useOverhaulStore.getState().setLibraryPage(null);
                }}
              >
                Library
              </button>
              <span aria-hidden="true">›</span>
              <button type="button" onClick={closeAgentCatalog}>
                Agents
              </button>
              <span aria-hidden="true">›</span>
              <span className="ov-dl__here">{localizeUi("ui.agents.agentcatalogview.downloadAgents")}</span>
            </p>
            <div className="ov-dl__titleline">
              <h1>{localizeUi("ui.agents.agentcatalogview.downloadAgents")}</h1>
              <small>
                {catalog.data?.packages.length ?? 0} available · {installed.data?.length ?? 0} installed
              </small>
            </div>
          </div>
          <div className="ov-dl__actions">
            {customRepositories.data?.enabled && (
              <button type="button" className="ov-dl__act" onClick={() => setCustomRepositoriesOpen(true)}>
                <GitFork size={13} aria-hidden="true" />
                {localizeUi("ui.agents.agentcatalogview.customSources")}
              </button>
            )}
            <button
              type="button"
              className="ov-dl__act"
              onClick={() => void Promise.all([catalog.refetch(), installed.refetch()])}
              disabled={catalog.isFetching || installed.isFetching || packageActionPending}
            >
              <RefreshCw
                size={13}
                aria-hidden="true"
                className={cn((catalog.isFetching || installed.isFetching) && "animate-spin")}
              />
              {localizeUi("ui.noodle.noodlehome.refresh")}
            </button>
            <div className="ov-menu-wrap" ref={ovMenuRef}>
              <button
                type="button"
                className="ov-dl__act"
                aria-label="More actions"
                aria-expanded={ovMenuOpen}
                onClick={() => setOvMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
              {ovMenuOpen ? (
                <div className="ov-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      installablePackageIds.length === 0 ||
                      packageActionPending ||
                      catalog.isLoading ||
                      installed.isLoading
                    }
                    onClick={() => {
                      setOvMenuOpen(false);
                      void handleInstallAll();
                    }}
                  >
                    <Download size={14} aria-hidden="true" />
                    {localizeUi("ui.agents.agentcatalogview.installAll")}
                    <small>{installablePackageIds.length}</small>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    disabled={
                      installedPackageIds.length === 0 ||
                      packageActionPending ||
                      catalog.isLoading ||
                      installed.isLoading
                    }
                    onClick={() => {
                      setOvMenuOpen(false);
                      void handleUninstallAll();
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {localizeUi("ui.agents.agentcatalogview.uninstallAll")}
                    <small>{installedPackageIds.length}</small>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="ov-dl__body">
          <aside className="ov-vw__left" aria-label={localizeUi("ui.agents.agentcatalogview.downloadAgents")}>
            <div className="ov-dl__filters">
              <label className="ov-vw__search">
                <Search size={13} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={localizeUi("ui.agents.agentcatalogview.searchAgents")}
                  aria-label={localizeUi("ui.agents.agentcatalogview.searchDownloadableAgents")}
                />
              </label>
              <AgentModeFilter className="ov-dl__modes" value={modeFilter} onChange={setModeFilter} />
              {bulkProgress && (
                <p className="ov-dl__progress" role="status" aria-live="polite">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  {bulkProgress.action === "install"
                    ? localizeUi("ui.agents.agentcatalogview.installingValue1Value2", {
                        value1: bulkProgress.completed,
                        value2: bulkProgress.total,
                      })
                    : localizeUi("ui.agents.agentcatalogview.uninstallingValue1Value2", {
                        value1: bulkProgress.completed,
                        value2: bulkProgress.total,
                      })}
                </p>
              )}
            </div>
            <div className="ov-vw__list" role="listbox">
              {catalog.isLoading ? (
                <p className="ov-vw__empty">
                  <Loader2 size={13} className="mr-1.5 inline animate-spin" aria-hidden="true" />
                  {localizeUi("ui.agents.agentcatalogview.loadingTheOfficialCatalog")}
                </p>
              ) : catalog.isError ? (
                <div className="ov-vw__empty">
                  <p className="ov-dl__err">{localizeUi("ui.agents.agentcatalogview.theAgentCatalogIsUnavailable")}</p>
                  <p>{catalogErrorDescription(catalog.error)}</p>
                  <button type="button" className="ov-dl__link" onClick={() => void catalog.refetch()}>
                    {localizeUi("capabilities.actions.tryAgain")}
                  </button>
                </div>
              ) : packages.length === 0 ? (
                <p className="ov-vw__empty">
                  {hasActiveFilters
                    ? localizeUi("ui.agents.agentcatalogview.noMatchingAgents")
                    : localizeUi("ui.agents.agentcatalogview.theOfficialCatalogIsEmpty")}
                </p>
              ) : (
                <>
                  <p className="ov-vw__label ov-dl__label">
                    Installed<small>{installedGroup.entries.length}</small>
                  </p>
                  {installedGroup.entries.length ? (
                    installedGroup.entries.map((entry) => renderRow(entry, true))
                  ) : (
                    <p className="ov-vw__empty">
                      {localizeUi("ui.agents.agentcatalogview.noAgentsInstalledInThisView")}
                    </p>
                  )}
                  <p className="ov-vw__label ov-dl__label">
                    Available<small>{availableGroup.entries.length}</small>
                  </p>
                  {availableGroup.entries.length === 0 ? (
                    <p className="ov-vw__empty">
                      {localizeUi("ui.agents.agentcatalogview.everyMatchingAgentIsInstalled")}
                    </p>
                  ) : (
                    CATEGORY_SECTIONS.map((category) => {
                      const entries = availableGroup.entries.filter((entry) => catalogCategory(entry) === category.id);
                      if (!entries.length) return null;
                      const isClosed = ovClosed[category.id] && !query.trim();
                      return (
                        <section key={category.id} className="ov-vw__group">
                          <button
                            type="button"
                            className="ov-vw__ghead"
                            aria-expanded={!isClosed}
                            onClick={() =>
                              setOvClosed((current) => ({ ...current, [category.id]: !current[category.id] }))
                            }
                          >
                            <ChevronDown size={13} className={cn(isClosed && "-rotate-90")} aria-hidden="true" />
                            <span>{localizeUi(category.labelKey)}</span>
                            <small>{entries.length}</small>
                          </button>
                          {isClosed ? null : entries.map((entry) => renderRow(entry, false))}
                        </section>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </aside>
          {selected ? (
            <main className="ov-dl__detail">
              <div className="ov-dl__top">
                <span className="ov-dl__art">
                  <AgentArtwork
                    imageUrl={selected.iconUrl}
                    alt={localizeUi("ui.agents.agentcatalogview.value1Artwork", { value1: selected.manifest.name })}
                    iconSize="1.75rem"
                  />
                </span>
                <div className="ov-dl__id">
                  <small>{categoryLabel(selected)}</small>
                  <h2>{selected.manifest.name}</h2>
                  <div className="ov-dl__badges">
                    {packageModes(selected.manifest.id).map((mode) => (
                      <span key={mode} className={cn("ov-dl__badge", `is-${mode}`)}>
                        {localizeUi(MODE_BADGES[mode].labelKey)}
                      </span>
                    ))}
                    {selected.manifest.kind.filter(isAgentCatalogKindBadgeVisible).map((kind) => (
                      <span key={kind} className="ov-dl__badge">
                        {kindLabel(kind)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ov-dl__cta">
                  {selected.documentationUrl && (
                    <a href={selected.documentationUrl} target="_blank" rel="noreferrer" className="ov-dl__act">
                      <ExternalLink size={13} aria-hidden="true" />
                      How it works
                    </a>
                  )}
                  {selectedInstalled ? (
                    <button
                      type="button"
                      className="ov-dl__act"
                      disabled={packageActionPending}
                      onClick={() => void handleUninstall(selected)}
                    >
                      {uninstall.isPending ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 size={13} aria-hidden="true" />
                      )}
                      {localizeUi("ui.agents.agentcatalogview.uninstall")}
                    </button>
                  ) : null}
                  {!selectedInstalled || selectedUpdate ? (
                    <button
                      type="button"
                      className="ov-dl__primary"
                      disabled={packageActionPending}
                      onClick={() => void handleInstall(selected)}
                    >
                      {busyInstall ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Download size={14} aria-hidden="true" />
                      )}
                      {selectedUpdate
                        ? `${localizeUi("ui.agents.agentcatalogview.update")} to v${selected.manifest.version}`
                        : localizeUi("ui.agents.agentcatalogview.install")}
                    </button>
                  ) : (
                    <span className="ov-dl__state">{localizeUi("ui.agents.agentcatalogview.installed_7bb4405")}</span>
                  )}
                </div>
              </div>
              <p className="ov-dl__desc">{selected.manifest.description}</p>
              <div className="ov-dl__meta">
                <span>
                  <ShieldCheck size={13} aria-hidden="true" />
                  {catalog.data?.provenance?.kind === "custom" ? "Custom package" : "Official package"}, checksum
                  verified on install
                </span>
                <span>
                  {selectedInstalled ? (
                    <>
                      Installed v{selectedInstalled.version}
                      {selectedVersionComparison !== 0 ? ` · catalog v${selected.manifest.version}` : ""}
                    </>
                  ) : (
                    <>v{selected.manifest.version}</>
                  )}
                </span>
                <span>
                  <HardDrive size={13} aria-hidden="true" />
                  {formatBytes(selected.artifact.bytes)}
                </span>
                <span>Needs Engine v{selected.manifest.engine.min}+</span>
              </div>
              <section className="ov-dl__sec">
                <h3>
                  {localizeUi("ui.agents.agentcatalogview.permissions")}
                  <small>what this agent can access</small>
                </h3>
                {(selected.manifest.entrypoints.server || selected.manifest.entrypoints.client) && (
                  <p className="ov-dl__note is-warn">
                    {localizeUi("ui.agents.agentcatalogview.trustedCodeAccessNotice")}
                  </p>
                )}
                {permissionGroups.map((group) => (
                  <div key={group.kind}>
                    {permissionGroups.length > 1 ? (
                      <p className="ov-dl__sub">
                        {localizeUi(
                          group.kind === "installed"
                            ? "ui.agents.agentcatalogview.installedPermissions"
                            : "ui.agents.agentcatalogview.availablePermissions",
                          { version: group.version },
                        )}
                      </p>
                    ) : null}
                    {group.permissions.length > 0 ? (
                      <ul className="ov-dl__perms">
                        {group.permissions.map((permission) => (
                          <li key={permission}>
                            <Check size={12} aria-hidden="true" />
                            {permission === "ui" ? "UI" : permission.replaceAll("-", " ")}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ov-dl__note">{localizeUi("ui.agents.agentcatalogview.noPermissions")}</p>
                    )}
                  </div>
                ))}
                <p className="ov-dl__note">{localizeUi("ui.agents.agentcatalogview.permissionScopeNotice")}</p>
              </section>
              <div className="ov-dl__history">
                <AgentVersionHistory packageId={selected.manifest.id} />
              </div>
            </main>
          ) : (
            <main className="ov-dl__detail">
              <p className="ov-vw__pick">{localizeUi("ui.agents.agentcatalogview.selectAnAgentToSeeItsDetails")}</p>
            </main>
          )}
        </div>
        <CustomAgentRepositoriesModal open={customRepositoriesOpen} onClose={() => setCustomRepositoriesOpen(false)} />
      </div>
    );
  }

  return (
    <div
      data-component="AgentCatalogView"
      className="mari-chrome-token-scope flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)]"
    >
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-[var(--border)]/50 bg-[var(--card)]/90 px-3 py-2 backdrop-blur-md md:px-6 md:py-3">
        <button
          type="button"
          onClick={closeAgentCatalog}
          className="mari-chrome-control h-9 w-9 shrink-0 rounded-xl p-0 md:h-10 md:w-10"
          title={localizeUi("capabilities.actions.backToAgents")}
          aria-label={localizeUi("capabilities.actions.backToAgents")}
        >
          <ArrowLeft size="1rem" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agentcatalogview.agentLibrary")}
          </p>
          <h1 className="truncate text-base font-semibold text-[var(--foreground)] md:text-xl">
            {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
          </h1>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agentcatalogview.catalogSummary", {
              availableCount: catalog.data?.packages.length ?? 0,
              installedCount: installed.data?.length ?? 0,
            })}
          </p>
        </div>
        {customRepositories.data?.enabled && (
          <button
            type="button"
            className="mari-chrome-control h-9 shrink-0 px-3 text-xs md:h-10 md:px-4"
            onClick={() => setCustomRepositoriesOpen(true)}
            aria-label={localizeUi("ui.agents.agentcatalogview.customSources")}
          >
            <GitFork size="0.85rem" />
            <span className="max-sm:hidden">{localizeUi("ui.agents.agentcatalogview.customSources")}</span>
          </button>
        )}
        <button
          type="button"
          className="mari-chrome-control h-9 shrink-0 px-3 text-xs md:h-10 md:px-4"
          onClick={() => void Promise.all([catalog.refetch(), installed.refetch()])}
          disabled={catalog.isFetching || installed.isFetching || packageActionPending}
        >
          <RefreshCw size="0.85rem" className={cn((catalog.isFetching || installed.isFetching) && "animate-spin")} />
          <span className="max-sm:hidden">{localizeUi("ui.noodle.noodlehome.refresh")}</span>
        </button>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-[var(--border)] bg-[var(--card)]/35 md:border-r",
            mobileDetail && "max-md:hidden",
          )}
        >
          <div className="border-b border-[var(--border)]/50 p-3 md:p-4">
            <div className="relative">
              <Search
                size="0.9rem"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                className="mari-chrome-field h-10 w-full pl-9 pr-3 text-sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={localizeUi("ui.agents.agentcatalogview.searchAgents")}
                aria-label={localizeUi("ui.agents.agentcatalogview.searchDownloadableAgents")}
              />
            </div>
            <AgentModeFilter className="mt-2" value={modeFilter} onChange={setModeFilter} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="mari-chrome-control mari-chrome-control--primary h-9 min-h-9! min-w-0 px-2! text-xs"
                onClick={() => void handleInstallAll()}
                disabled={
                  installablePackageIds.length === 0 || packageActionPending || catalog.isLoading || installed.isLoading
                }
                title={
                  installablePackageIds.length === 0
                    ? localizeUi("ui.agents.agentcatalogview.allAvailableAgentsAreInstalled")
                    : undefined
                }
              >
                {bulkProgress?.action === "install" ? (
                  <Loader2 size="0.8rem" className="shrink-0 animate-spin" />
                ) : (
                  <Download size="0.8rem" className="shrink-0" />
                )}
                <span className="truncate">
                  {bulkProgress?.action === "install"
                    ? localizeUi("ui.agents.agentcatalogview.installingValue1Value2", {
                        value1: bulkProgress.completed,
                        value2: bulkProgress.total,
                      })
                    : localizeUi("ui.agents.agentcatalogview.installAll")}
                </span>
              </button>
              <button
                type="button"
                className="mari-chrome-control h-9 min-w-0 px-2 text-xs"
                onClick={() => void handleUninstallAll()}
                disabled={
                  installedPackageIds.length === 0 || packageActionPending || catalog.isLoading || installed.isLoading
                }
                title={
                  installedPackageIds.length === 0
                    ? localizeUi("ui.agents.agentcatalogview.noAgentsAreInstalled")
                    : undefined
                }
              >
                {bulkProgress?.action === "uninstall" ? (
                  <Loader2 size="0.8rem" className="shrink-0 animate-spin" />
                ) : (
                  <Trash2 size="0.8rem" className="shrink-0" />
                )}
                <span className="truncate">
                  {bulkProgress?.action === "uninstall"
                    ? localizeUi("ui.agents.agentcatalogview.uninstallingValue1Value2", {
                        value1: bulkProgress.completed,
                        value2: bulkProgress.total,
                      })
                    : localizeUi("ui.agents.agentcatalogview.uninstallAll")}
                </span>
              </button>
            </div>
            {bulkProgress && (
              <p
                className="mt-2 text-center text-[0.6875rem] text-[var(--muted-foreground)]"
                role="status"
                aria-live="polite"
              >
                {bulkProgress.action === "install"
                  ? localizeUi("ui.agents.agentcatalogview.installing")
                  : localizeUi("ui.agents.agentcatalogview.uninstalling")}{" "}
                {localizeUi("ui.agents.agentcatalogview.agent")} {bulkProgress.completed}{" "}
                {localizeUi("ui.noodle.noodlehome.of")} {bulkProgress.total}
                {localizeUi("ui.agents.agentcatalogview.keepMarinaraEngineOpenUntilThisFinishes")}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
            {catalog.isLoading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="animate-spin" size="1rem" />{" "}
                {localizeUi("ui.agents.agentcatalogview.loadingTheOfficialCatalog")}
              </div>
            ) : catalog.isError ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center">
                <TriangleAlert size="2rem" className="text-[var(--muted-foreground)]" />
                <div>
                  <p className="font-semibold">
                    {localizeUi("ui.agents.agentcatalogview.theAgentCatalogIsUnavailable")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {catalogErrorDescription(catalog.error)}
                  </p>
                </div>
                <button
                  className="mari-chrome-control mari-chrome-control--primary px-4 py-2"
                  onClick={() => void catalog.refetch()}
                >
                  {localizeUi("capabilities.actions.tryAgain")}
                </button>
              </div>
            ) : packages.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-4 text-center">
                <Sparkles size="2rem" className="text-[var(--muted-foreground)]" />
                <p className="font-semibold">
                  {hasActiveFilters
                    ? localizeUi("ui.agents.agentcatalogview.noMatchingAgents")
                    : localizeUi("ui.agents.agentcatalogview.theOfficialCatalogIsEmpty")}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {hasActiveFilters
                    ? localizeUi("ui.noodle.noodlehome.tryADifferentSearch")
                    : localizeUi("ui.agents.agentcatalogview.publishedAgentsWillAppearHereAutomatically")}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {packageGroups.map((group) => (
                  <section key={group.id} aria-labelledby={`agent-catalog-${group.id}`}>
                    <div className="mb-2 flex items-center justify-between gap-2 px-2">
                      <h2
                        id={`agent-catalog-${group.id}`}
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]"
                      >
                        {group.title}
                      </h2>
                      <span className="text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
                        {group.entries.length}
                      </span>
                    </div>
                    {group.entries.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-[var(--muted-foreground)]">
                        {group.id === "installed"
                          ? localizeUi("ui.agents.agentcatalogview.noAgentsInstalledInThisView")
                          : localizeUi("ui.agents.agentcatalogview.everyMatchingAgentIsInstalled")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {CATEGORY_SECTIONS.map((category) => {
                          const entries = group.entries.filter((entry) => catalogCategory(entry) === category.id);
                          if (entries.length === 0) return null;
                          return (
                            <div key={category.id}>
                              <h3 className="mb-1 px-2 text-[0.6875rem] font-semibold text-[var(--foreground)]/75">
                                {localizeUi(category.labelKey)}
                              </h3>
                              <div className="space-y-1">
                                {entries.map((entry) => {
                                  const active = entry.manifest.id === selected?.manifest.id;
                                  const modes = packageModes(entry.manifest.id);
                                  return (
                                    <button
                                      key={entry.manifest.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedId(entry.manifest.id);
                                        setMobileDetail(true);
                                      }}
                                      className={cn(
                                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-accent)]",
                                        active &&
                                          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-inset ring-[var(--border)]",
                                      )}
                                    >
                                      <span className="mari-panel-gradient-surface mari-panel-gradient--agents flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                                        <AgentArtwork
                                          imageUrl={entry.iconUrl}
                                          alt={localizeUi("ui.agents.agentcatalogview.value1Artwork", {
                                            value1: entry.manifest.name,
                                          })}
                                          iconSize="1.15rem"
                                        />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                          <span className="truncate text-sm font-semibold">{entry.manifest.name}</span>
                                          {group.id === "installed" && (
                                            <span className="mari-chrome-tag bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[var(--marinara-chat-chrome-highlight-text)]">
                                              {localizeUi("ui.agents.agentcatalogview.installed_7bb4405")}
                                            </span>
                                          )}
                                        </span>
                                        <span className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                                          {entry.manifest.description}
                                        </span>
                                        {modes.length > 0 && (
                                          <span data-agent-catalog-mode-badges className="mt-1 flex flex-wrap gap-1">
                                            {modes.map((mode) => (
                                              <span
                                                key={mode}
                                                className={cn(
                                                  "rounded-md border px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--foreground)]",
                                                  MODE_BADGES[mode].className,
                                                )}
                                              >
                                                {localizeUi(MODE_BADGES[mode].labelKey)}
                                              </span>
                                            ))}
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        </aside>

        {selected ? (
          <main className={cn("min-h-0 overflow-y-auto", !mobileDetail && "max-md:hidden")}>
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-4 py-4 md:px-8 md:py-8 lg:px-12">
              <button
                type="button"
                className="mari-chrome-control mb-1 w-fit px-3 py-2 text-sm md:!hidden"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft size="0.9rem" /> {localizeUi("ui.agents.agentcatalogview.allAgents")}
              </button>

              <div className="flex items-start gap-4 md:gap-5">
                <div className="mari-panel-gradient-surface mari-panel-gradient--agents flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl md:h-24 md:w-24">
                  <AgentArtwork
                    imageUrl={selected.iconUrl}
                    alt={localizeUi("ui.agents.agentcatalogview.value1Artwork", { value1: selected.manifest.name })}
                    iconSize="2rem"
                  />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {localizeUi(
                      CATEGORY_SECTIONS.find((category) => category.id === catalogCategory(selected))?.labelKey ??
                        "ui.agents.agentcatalogview.miscAgents",
                    )}
                  </p>
                  <h2 className="mt-1 text-xl font-bold md:text-2xl">{selected.manifest.name}</h2>
                  <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)]">
                    {selected.manifest.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.manifest.kind.filter(isAgentCatalogKindBadgeVisible).map((kind) => (
                      <span
                        key={kind}
                        className="mari-chrome-tag border border-[var(--border)] px-2.5 py-1 text-[0.68rem]"
                      >
                        {kindLabel(kind)}
                      </span>
                    ))}
                    {packageModes(selected.manifest.id).map((mode) => (
                      <span
                        key={mode}
                        data-chat-mode={mode}
                        className={cn(
                          "mari-chrome-tag border px-2.5 py-1 text-[0.68rem] font-semibold text-[var(--foreground)]",
                          MODE_BADGES[mode].className,
                        )}
                      >
                        {localizeUi(MODE_BADGES[mode].labelKey)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3 border-y border-[var(--border)] py-4 text-xs text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5">
                  <HardDrive size="0.8rem" /> {formatBytes(selected.artifact.bytes)}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size="0.8rem" />
                  {localizeUi(
                    catalog.data?.provenance?.kind === "custom"
                      ? "ui.agents.agentcatalogview.customChecksumWillBeVerifiedDuringInstallation"
                      : "ui.agents.agentcatalogview.officialChecksumWillBeVerifiedDuringInstallation",
                  )}
                </span>
                {selectedInstalled ? (
                  <>
                    <span>
                      {localizeUi("ui.agents.agentcatalogview.installedV")}
                      {selectedInstalled.version}
                    </span>
                    {selectedVersionComparison > 0 && (
                      <span>
                        {localizeUi("ui.agents.agentcatalogview.catalogV")}
                        {selected.manifest.version} {localizeUi("ui.agents.agentcatalogview.available_7b231a5")}
                      </span>
                    )}
                    {selectedVersionComparison < 0 && (
                      <span>
                        {localizeUi("ui.agents.agentcatalogview.catalogV")}
                        {selected.manifest.version} {localizeUi("ui.agents.agentcatalogview.older")}
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    {localizeUi("ui.agents.agentcatalogview.agentV")}
                    {selected.manifest.version}
                  </span>
                )}
                <span>
                  {localizeUi("ui.agents.agentcatalogview.marinaraEngineV")}
                  {selected.manifest.engine.min}+
                </span>
              </div>

              <section>
                <h3 className="text-sm font-semibold">{localizeUi("ui.agents.agentcatalogview.permissions")}</h3>
                {(selected.manifest.entrypoints.server || selected.manifest.entrypoints.client) && (
                  <p className="mt-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
                    {localizeUi("ui.agents.agentcatalogview.trustedCodeAccessNotice")}
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.agentcatalogview.permissionScopeNotice")}
                </p>
                {permissionGroups.map((group) => (
                  <div key={group.kind} className="mt-3">
                    <h4 className="text-xs font-medium">
                      {localizeUi(
                        group.kind === "installed"
                          ? "ui.agents.agentcatalogview.installedPermissions"
                          : "ui.agents.agentcatalogview.availablePermissions",
                        { version: group.version },
                      )}
                    </h4>
                    {group.permissions.length > 0 ? (
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => (
                          <li
                            key={permission}
                            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
                          >
                            <Check size="0.85rem" className="text-[var(--marinara-chat-chrome-highlight-text)]" />
                            {permission.replaceAll("-", " ")}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agentcatalogview.noPermissions")}
                      </p>
                    )}
                  </div>
                ))}
              </section>

              <AgentVersionHistory packageId={selected.manifest.id} />

              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
                {selected.documentationUrl && (
                  <a href={selected.documentationUrl} target="_blank" rel="noreferrer" className={DETAIL_ACTION_CLASS}>
                    <ExternalLink size="0.85rem" /> {localizeUi("ui.agents.agentcatalogview.readHowThisAgentWorks")}
                  </a>
                )}
                <div className="ml-auto flex flex-wrap gap-3 max-sm:ml-0 max-sm:w-full">
                  {installedById.has(selected.manifest.id) ? (
                    <>
                      <button
                        type="button"
                        className={DETAIL_ACTION_CLASS}
                        disabled={packageActionPending}
                        onClick={() => void handleUninstall(selected)}
                      >
                        {uninstall.isPending ? (
                          <Loader2 size="0.9rem" className="animate-spin" />
                        ) : (
                          <Trash2 size="0.9rem" />
                        )}
                        {localizeUi("ui.agents.agentcatalogview.uninstall")}
                      </button>
                      {selectedVersionComparison > 0 && (
                        <button
                          type="button"
                          className={DETAIL_ACTION_CLASS}
                          disabled={packageActionPending}
                          onClick={() => void handleInstall(selected)}
                        >
                          <Download size="0.9rem" /> {localizeUi("ui.agents.agentcatalogview.update")}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className={DETAIL_ACTION_CLASS}
                      disabled={packageActionPending}
                      onClick={() => void handleInstall(selected)}
                    >
                      {install.isPending ? (
                        <Loader2 size="0.9rem" className="animate-spin" />
                      ) : (
                        <Download size="0.9rem" />
                      )}
                      {localizeUi("ui.agents.agentcatalogview.install")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>
        ) : (
          <main className="hidden min-h-0 items-center justify-center text-sm text-[var(--muted-foreground)] md:flex">
            {localizeUi("ui.agents.agentcatalogview.selectAnAgentToSeeItsDetails")}
          </main>
        )}
      </div>
      <CustomAgentRepositoriesModal open={customRepositoriesOpen} onClose={() => setCustomRepositoriesOpen(false)} />
    </div>
  );
}
