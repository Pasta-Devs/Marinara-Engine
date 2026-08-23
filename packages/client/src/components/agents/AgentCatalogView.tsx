import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
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
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { AgentArtwork } from "./AgentArtwork";
import { CustomAgentRepositoriesModal } from "./CustomAgentRepositoriesModal";
import { useTranslation as useUiTranslation } from "react-i18next";

const CATEGORY_SECTIONS = [
  { id: "writer", label: "Writer Agents" },
  { id: "tracker", label: "Tracker Agents" },
  { id: "misc", label: "Misc Agents" },
] as const;

type CatalogMode = "conversation" | "roleplay" | "game";

const OFFICIAL_PACKAGE_MODES: Readonly<Record<string, readonly CatalogMode[]>> = Object.freeze({
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
  "memory-nag": ["roleplay"],
  expression: ["roleplay"],
  "hierarchical-maps": ["roleplay", "game"],
  "persona-stats": ["roleplay"],
  quest: ["roleplay"],
  "world-state": ["roleplay"],
  eightball: ["conversation"],
  chess: ["conversation"],
  combat: ["roleplay"],
  "conversation-calls": ["conversation"],
  cyoa: ["roleplay"],
  "echo-chamber": ["roleplay"],
  haptic: ["conversation", "roleplay"],
  illustrator: ["conversation", "roleplay", "game"],
  storyboard: ["roleplay", "game"],
  html: ["roleplay"],
  "lorebook-keeper": ["roleplay", "game"],
  noodle: ["conversation", "roleplay", "game"],
  spotify: ["conversation", "roleplay", "game"],
  poker: ["conversation"],
  "rock-paper-scissors": ["conversation"],
  "tic-tac-toe": ["conversation"],
  uno: ["conversation"],
});

const MODE_BADGES: Record<CatalogMode, { label: string; className: string }> = {
  conversation: {
    label: "Conversation",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-cyan)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-cyan)_18%,transparent)]",
  },
  roleplay: {
    label: "Roleplay",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-orange)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-orange)_18%,transparent)]",
  },
  game: {
    label: "Game",
    className:
      "border-[color-mix(in_srgb,var(--mari-logo-pink)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mari-logo-pink)_18%,transparent)]",
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
  return "Agent";
}

function packageModes(packageId: string): readonly CatalogMode[] {
  return OFFICIAL_PACKAGE_MODES[packageId] ?? [];
}

export function AgentCatalogView() {
  const { t: localizeUi } = useUiTranslation();
  const closeAgentCatalog = useUIStore((state) => state.closeAgentCatalog);
  const catalog = useCapabilityCatalog();
  const installed = useInstalledCapabilityPackages();
  const install = useInstallCapabilityPackage();
  const uninstall = useUninstallCapabilityPackage();
  const installAll = useInstallAllCapabilityPackages();
  const uninstallAll = useUninstallAllCapabilityPackages();
  const customRepositories = useCustomAgentRepositories();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkActionProgress | null>(null);
  const [customRepositoriesOpen, setCustomRepositoriesOpen] = useState(false);

  const installedById = useMemo(() => new Map((installed.data ?? []).map((item) => [item.id, item])), [installed.data]);
  const packages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog.data?.packages ?? []).filter(
      ({ manifest, category }) =>
        !needle ||
        [
          manifest.name,
          manifest.description,
          manifest.id,
          category,
          ...manifest.kind.map(kindLabel),
          ...packageModes(manifest.id).map((mode) => MODE_BADGES[mode].label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    );
  }, [catalog.data, query]);
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
  const selectedVersionComparison = selectedInstalled
    ? compareCapabilityPackageVersions(selected.manifest.version, selectedInstalled.version)
    : 0;

  useEffect(() => {
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
                  {query
                    ? localizeUi("ui.agents.agentcatalogview.noMatchingAgents")
                    : localizeUi("ui.agents.agentcatalogview.theOfficialCatalogIsEmpty")}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {query
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
                          const entries = group.entries.filter((entry) => entry.category === category.id);
                          if (entries.length === 0) return null;
                          return (
                            <div key={category.id}>
                              <h3 className="mb-1 px-2 text-[0.6875rem] font-semibold text-[var(--foreground)]/75">
                                {category.label}
                              </h3>
                              <div className="space-y-1">
                                {entries.map((entry) => {
                                  const active = entry.manifest.id === selected?.manifest.id;
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
                                            <span className="rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[var(--marinara-chat-chrome-highlight-text)]">
                                              {localizeUi("ui.agents.agentcatalogview.installed_7bb4405")}
                                            </span>
                                          )}
                                        </span>
                                        <span className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                                          {entry.manifest.description}
                                        </span>
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
                    {CATEGORY_SECTIONS.find((category) => category.id === selected.category)?.label ?? "Misc Agents"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold md:text-2xl">{selected.manifest.name}</h2>
                  <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)]">
                    {selected.manifest.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.manifest.kind.filter(isAgentCatalogKindBadgeVisible).map((kind) => (
                      <span
                        key={kind}
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[0.68rem]"
                      >
                        {kindLabel(kind)}
                      </span>
                    ))}
                    {packageModes(selected.manifest.id).map((mode) => (
                      <span
                        key={mode}
                        data-chat-mode={mode}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold text-[var(--foreground)]",
                          MODE_BADGES[mode].className,
                        )}
                      >
                        {MODE_BADGES[mode].label}
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
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
                    {localizeUi("ui.agents.agentcatalogview.trustedCodeAccessNotice")}
                  </p>
                )}
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selected.manifest.permissions.map((permission) => (
                    <li key={permission} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <Check size="0.85rem" className="text-[var(--marinara-chat-chrome-highlight-text)]" />
                      {permission.replaceAll("-", " ")}
                    </li>
                  ))}
                </ul>
              </section>

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
