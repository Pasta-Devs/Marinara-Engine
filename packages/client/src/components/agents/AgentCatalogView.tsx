import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  GitFork,
  Home,
  Info,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { CapabilityCatalogPackage } from "@marinara-engine/shared";
import {
  useCapabilityAgentRegistry,
  useCapabilityCatalog,
  useInstallAllCapabilityPackages,
  useInstallCapabilityPackage,
  useInstalledCapabilityPackages,
  useUninstallAllCapabilityPackages,
  useUninstallCapabilityPackage,
} from "../../hooks/use-capability-packages";
import { useCustomAgentRepositories } from "../../hooks/use-custom-agent-repositories";
import { useChats } from "../../hooks/use-chats";
import { parseChatMetadata } from "../../lib/chat-display";
import { ApiError, getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { notifyDecisionImport } from "../../lib/decision-import-notice";
import { executeStateNavigation } from "../../lib/state-navigation";
import { useUIStore } from "../../stores/ui.store";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { AgentModeFilter, type AgentModeFilterValue } from "./AgentModeFilter";
import { CustomAgentRepositoriesModal } from "./CustomAgentRepositoriesModal";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  checkReasonOf,
  hasUpdate,
  ORGANIZER_SECTIONS,
  packageModes,
  sectionLabelKey,
  sectionOf,
  taglineOf,
  type OrganizerEntry,
  type OrganizerPage,
} from "./organizer/organizer-model";
import { AgentIcon, IconStack, OrganizerContext, type OrganizerActions } from "./organizer/OrganizerParts";
import { OrganizerHome } from "./organizer/OrganizerHome";
import { InstalledPage, SearchResults, SectionPage, UpdatesPage, type UpdateRun } from "./organizer/OrganizerLists";
import type { AgentUpdateResult } from "./AgentUpdateDialog";
import { AgentPage } from "./organizer/AgentPage";

type BulkActionProgress = {
  action: "install" | "uninstall";
  completed: number;
  total: number;
};

function catalogErrorDescription(error: unknown) {
  const offlineSuffix = "Installed agents remain available offline.";
  if (error instanceof ApiError) {
    return `Marinara Engine returned HTTP ${error.status}: ${error.message}. ${offlineSuffix}`;
  }
  if (error instanceof Error && error.message) return `${error.message}. ${offlineSuffix}`;
  return `Marinara Engine could not load the official catalog. ${offlineSuffix}`;
}

/** The Agent Organizer: browse, install, update and remove downloadable agents. */
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
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSection = (section: string) =>
    setOpenSections((current) => {
      const next = new Set(current);
      if (!next.delete(section)) next.add(section);
      return next;
    });
  const [page, setPage] = useState<OrganizerPage>(() =>
    initialPackageId ? { kind: "agent", id: initialPackageId } : { kind: "home" },
  );
  const [menu, setMenu] = useState<{ entry: OrganizerEntry | null; x: number; y: number } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkActionProgress | null>(null);
  const [updateRun, setUpdateRun] = useState<UpdateRun | null>(null);
  const [customRepositoriesOpen, setCustomRepositoriesOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const installedById = useMemo(() => new Map((installed.data ?? []).map((item) => [item.id, item])), [installed.data]);
  const chats = useChats();
  const capabilityAgents = useCapabilityAgentRegistry();
  // Chats that run each package: a chat lists agent ids (or the package id), and only counts with agents on.
  const chatCountById = useMemo(() => {
    const packageByAgent = new Map(
      (capabilityAgents.data ?? []).flatMap((agent) => (agent.packageId ? [[agent.id, agent.packageId] as const] : [])),
    );
    const counts = new Map<string, number>();
    for (const chat of chats.data ?? []) {
      const metadata = parseChatMetadata(chat.metadata);
      if (metadata.enableAgents !== true || !Array.isArray(metadata.activeAgentIds)) continue;
      const packageIds = new Set(
        metadata.activeAgentIds
          .filter((id: unknown): id is string => typeof id === "string")
          .map((id: string) => packageByAgent.get(id) ?? id),
      );
      for (const id of packageIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [capabilityAgents.data, chats.data]);
  const settingsAgentById = useMemo(() => {
    const ids = new Map<string, string>();
    for (const agent of capabilityAgents.data ?? []) {
      if (agent.packageId && !ids.has(agent.packageId)) ids.set(agent.packageId, agent.id);
    }
    return ids;
  }, [capabilityAgents.data]);
  const all = useMemo(() => catalog.data?.packages ?? [], [catalog.data]);
  const entries = useMemo(
    () => (modeFilter === "all" ? all : all.filter((entry) => packageModes(entry.manifest.id).includes(modeFilter))),
    [all, modeFilter],
  );
  const needle = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      needle
        ? entries.filter(({ manifest, ...entry }) =>
            [manifest.name, manifest.id, manifest.description, taglineOf({ manifest, ...entry })]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
        : null,
    [entries, needle],
  );
  const updates = useMemo(
    () => all.filter((entry) => hasUpdate(entry, installedById.get(entry.manifest.id))),
    [all, installedById],
  );
  const installablePackageIds = useMemo(
    // Until the installed list loads, every package would look installable.
    () =>
      installed.data
        ? all.filter((entry) => !installedById.has(entry.manifest.id)).map((entry) => entry.manifest.id)
        : [],
    [all, installed.data, installedById],
  );
  const installedPackageIds = useMemo(() => (installed.data ?? []).map((entry) => entry.id), [installed.data]);
  const bulkActionPending = installAll.isPending || uninstallAll.isPending;
  const packageActionPending =
    install.isPending || uninstall.isPending || bulkActionPending || (updateRun?.running ?? false);
  const busyId = install.isPending
    ? (install.variables?.id ?? null)
    : uninstall.isPending
      ? (uninstall.variables ?? null)
      : null;

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // A finished run stays on the Updates page until the user leaves it.
  useEffect(() => {
    if (page.kind !== "updates") setUpdateRun((current) => (current?.running ? current : null));
  }, [page, updateRun?.running]);

  useEffect(() => {
    if (!initialPackageId) return;
    setQuery("");
    setPage({ kind: "agent", id: initialPackageId });
  }, [initialPackageId]);

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

  /** Updates one by one so each row on the Updates page shows its own state; a retry reuses the open run. */
  const runUpdates = async (rows: OrganizerEntry[], retry = false) => {
    if (rows.length === 0 || packageActionPending) return;
    // go() also clears the search, which would otherwise hide the Updates page.
    if (page.kind !== "updates" || query) go({ kind: "updates" });
    setUpdateRun((current) =>
      retry && current
        ? {
            ...current,
            // A retry installs the live catalog entry, so the row shows that version too.
            rows: current.rows.map((row) => rows.find((next) => next.manifest.id === row.manifest.id) ?? row),
            running: true,
          }
        : {
            rows,
            from: Object.fromEntries(
              rows.map((entry) => [entry.manifest.id, installedById.get(entry.manifest.id)!.version]),
            ),
            results: {},
            running: true,
          },
    );
    let restartRequired = false;
    let usesDecisions = false;
    let failed = 0;
    for (const entry of rows) {
      const id = entry.manifest.id;
      const setResult = (result: AgentUpdateResult) =>
        setUpdateRun((current) => current && { ...current, results: { ...current.results, [id]: result } });
      setResult({ status: "running" });
      try {
        const result = await install.mutateAsync({
          id,
          expectedVersion: entry.manifest.version,
          expectedArtifactSha256: entry.artifact.sha256,
        });
        const needsRestart = result.status === "restart-required";
        restartRequired ||= needsRestart;
        usesDecisions ||= result.usesDecisions ?? false;
        setResult({ status: "updated", restartRequired: needsRestart });
      } catch (error) {
        failed += 1;
        setResult({
          status: "failed",
          error: getPrivilegedActionErrorMessage(
            error,
            localizeUi("ui.agents.agentupdateprompter.someUpdatesCouldNotBeApplied"),
          ),
        });
      }
    }
    setUpdateRun((current) => current && { ...current, running: false });
    void notifyDecisionImport(usesDecisions, localizeUi);
    if (failed > 0) toast.warning(localizeUi("ui.agents.agentupdateprompter.someUpdatesCouldNotBeApplied"));
    else
      toast.success(
        localizeUi(
          restartRequired
            ? "ui.agents.agentupdateprompter.updatesAppliedRestartRequired"
            : "ui.agents.agentupdateprompter.updatesAppliedReadyToUse",
        ),
      );
  };
  const handleUpdateAll = () => void runUpdates(updates);

  const handleInstallAll = async (
    packages: CapabilityCatalogPackage[] = all.filter((entry) => installablePackageIds.includes(entry.manifest.id)),
  ) => {
    if (!installed.data || packages.length === 0 || packageActionPending) return;
    const total = packages.length;
    setBulkProgress({ action: "install", completed: 0, total });
    try {
      const result = await installAll.mutateAsync({
        packages,
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

  const go = (next: OrganizerPage) => {
    setQuery("");
    setPage(next);
  };

  const openMenu = (entry: OrganizerEntry | null, event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ entry, x: rect.right - 192, y: rect.bottom + 4 });
  };

  const actions: OrganizerActions = {
    installedById,
    chatCountById,
    settingsAgentById,
    busyId,
    pending: packageActionPending,
    install: (entry) => void handleInstall(entry),
    open: (entry) => {
      closeAgentCatalog();
      executeStateNavigation({ kind: "package", packageId: entry.manifest.id });
    },
    go,
    menu: openMenu,
  };

  const menuItems = (entry: OrganizerEntry | null): ContextMenuItem[] => {
    if (entry) {
      const isInstalled = installedById.has(entry.manifest.id);
      return [
        {
          label: localizeUi("ui.agents.organizer.details"),
          icon: <Info size="0.85rem" />,
          onSelect: () => go({ kind: "agent", id: entry.manifest.id }),
        },
        isInstalled
          ? {
              label: localizeUi("ui.agents.agentcatalogview.uninstall"),
              icon: <Trash2 size="0.85rem" />,
              destructive: true,
              disabled: packageActionPending,
              onSelect: () => void handleUninstall(entry),
            }
          : {
              label: localizeUi("ui.agents.organizer.get"),
              icon: <Download size="0.85rem" />,
              disabled: packageActionPending,
              onSelect: () => void handleInstall(entry),
            },
      ];
    }
    return [
      ...(updates.length > 0
        ? [
            {
              label: localizeUi("ui.agents.organizer.updateAllCount", { count: updates.length }),
              icon: <RefreshCw size="0.85rem" />,
              disabled: packageActionPending,
              onSelect: () => void handleUpdateAll(),
            },
          ]
        : []),
      {
        label: localizeUi("ui.agents.organizer.installAllCount", { count: installablePackageIds.length }),
        icon: <Download size="0.85rem" />,
        disabled: installablePackageIds.length === 0 || packageActionPending,
        onSelect: () => void handleInstallAll(),
      },
      ...(customRepositories.data?.enabled
        ? [
            {
              label: localizeUi("ui.agents.agentcatalogview.customSources"),
              icon: <GitFork size="0.85rem" />,
              onSelect: () => setCustomRepositoriesOpen(true),
            },
          ]
        : []),
      {
        label: localizeUi("ui.agents.organizer.refresh"),
        icon: <RefreshCw size="0.85rem" />,
        disabled: catalog.isFetching || installed.isFetching,
        onSelect: () => void Promise.all([catalog.refetch(), installed.refetch()]),
      },
      {
        label: localizeUi("ui.agents.agentcatalogview.uninstallAll"),
        icon: <Trash2 size="0.85rem" />,
        destructive: true,
        disabled: installedPackageIds.length === 0 || packageActionPending,
        onSelect: () => void handleUninstallAll(),
      },
    ];
  };

  const agentEntry = page.kind === "agent" ? all.find((entry) => entry.manifest.id === page.id) : undefined;
  const sectionCounts = ORGANIZER_SECTIONS.map((section) => ({
    section,
    entries: entries.filter((entry) => sectionOf(entry) === section),
  })).filter((item) => item.entries.length > 0);
  const navItems = [
    { page: { kind: "home" } as const, label: localizeUi("ui.agents.organizer.home"), icon: Home, count: 0 },
    {
      page: { kind: "updates" } as const,
      label: localizeUi("ui.agents.organizer.updatesTitle"),
      icon: RefreshCw,
      count: updates.length,
    },
    {
      page: { kind: "installed" } as const,
      label: localizeUi("ui.agents.organizer.installedTitle"),
      icon: PackageCheck,
      count: installedById.size,
    },
  ];
  const isCurrent = (target: OrganizerPage) =>
    !results &&
    target.kind === page.kind &&
    (target.kind !== "section" || (page.kind === "section" && page.id === target.id));
  const showAside = page.kind !== "agent" || Boolean(results);
  const backLabel = agentEntry
    ? localizeUi("ui.agents.organizer.backToSection", {
        section: localizeUi(sectionLabelKey(sectionOf(agentEntry))),
      })
    : localizeUi("capabilities.actions.backToAgents");

  const searchField = (
    <div className="relative">
      <Search
        size="0.9rem"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        aria-hidden="true"
      />
      <input
        type="search"
        className="mari-chrome-field h-10 w-full pl-9 pr-3 text-sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={localizeUi("ui.agents.agentcatalogview.searchAgents")}
        aria-label={localizeUi("ui.agents.agentcatalogview.searchDownloadableAgents")}
      />
    </div>
  );

  let content;
  if (catalog.isLoading) {
    content = (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="animate-spin" size="1rem" />{" "}
        {localizeUi("ui.agents.agentcatalogview.loadingTheOfficialCatalog")}
      </div>
    );
  } else if (catalog.isError) {
    content = (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center">
        <TriangleAlert size="2rem" className="text-[var(--muted-foreground)]" />
        <div>
          <p className="font-semibold">{localizeUi("ui.agents.agentcatalogview.theAgentCatalogIsUnavailable")}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{catalogErrorDescription(catalog.error)}</p>
        </div>
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--primary px-4 py-2"
          onClick={() => void catalog.refetch()}
        >
          {localizeUi("capabilities.actions.tryAgain")}
        </button>
      </div>
    );
  } else if (all.length === 0) {
    content = (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-4 text-center">
        <Sparkles size="2rem" className="text-[var(--muted-foreground)]" />
        <p className="font-semibold">{localizeUi("ui.agents.agentcatalogview.theOfficialCatalogIsEmpty")}</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {localizeUi("ui.agents.agentcatalogview.publishedAgentsWillAppearHereAutomatically")}
        </p>
      </div>
    );
  } else if (results) {
    content = <SearchResults query={query.trim()} entries={results} />;
  } else if (page.kind === "agent") {
    content = agentEntry ? (
      <AgentPage
        key={agentEntry.manifest.id}
        entry={agentEntry}
        entries={all}
        customSource={catalog.data?.provenance?.kind === "custom"}
      />
    ) : (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        {localizeUi("ui.agents.organizer.agentMissing")}
      </p>
    );
  } else if (page.kind === "updates") {
    content = (
      <UpdatesPage
        entries={all}
        run={updateRun}
        onUpdateAll={handleUpdateAll}
        onRetry={(entry) =>
          void runUpdates([all.find((live) => live.manifest.id === entry.manifest.id) ?? entry], true)
        }
      />
    );
  } else if (page.kind === "installed") {
    content = <InstalledPage entries={all} />;
  } else if (page.kind === "section") {
    content = <SectionPage section={page.id} entries={entries.filter((entry) => sectionOf(entry) === page.id)} />;
  } else {
    content = (
      <OrganizerHome
        entries={entries}
        kits={(catalog.data?.kits ?? []).map((kit) => ({
          ...kit,
          entries: all.filter((entry) => kit.packages.includes(entry.manifest.id)),
        }))}
        onUpdateAll={() => void handleUpdateAll()}
        onInstallKit={(kitEntries) =>
          void handleInstallAll(kitEntries.filter((entry) => !installedById.has(entry.manifest.id)))
        }
      />
    );
  }

  return (
    <OrganizerContext.Provider value={actions}>
      <div
        data-component="AgentCatalogView"
        className="mari-chrome-token-scope flex h-full min-h-0 flex-col overflow-hidden bg-[var(--marinara-editor-bg)]"
      >
        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-[var(--border)]/50 bg-[var(--card)]/90 px-3 py-2 backdrop-blur-md md:px-6 md:py-3">
          <button
            type="button"
            onClick={agentEntry ? () => go({ kind: "section", id: sectionOf(agentEntry) }) : closeAgentCatalog}
            className="mari-chrome-control h-9 w-9 shrink-0 rounded-xl p-0 md:h-10 md:w-10"
            title={backLabel}
            aria-label={backLabel}
          >
            <ArrowLeft size="1rem" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.organizer.eyebrow")}
            </p>
            <h1 className="truncate text-base font-semibold text-[var(--foreground)] md:text-xl">
              {localizeUi("ui.agents.organizer.title")}
            </h1>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.organizer.summary", {
                count: all.length,
                installed: installedById.size,
                updates: updates.length,
              })}
            </p>
          </div>
          <button
            type="button"
            className="mari-chrome-control h-9 w-9 shrink-0 p-0 md:h-10 md:w-10"
            aria-label={localizeUi("ui.agents.organizer.moreActions")}
            aria-haspopup="menu"
            aria-expanded={menu?.entry === null}
            onClick={(event) => openMenu(null, event)}
          >
            {bulkActionPending ? (
              <Loader2 size="0.95rem" className="animate-spin" aria-hidden="true" />
            ) : (
              <MoreHorizontal size="0.95rem" aria-hidden="true" />
            )}
          </button>
        </header>

        {bulkProgress && (
          <p
            className="shrink-0 border-b border-[var(--border)]/50 px-4 py-1.5 text-center text-[0.6875rem] text-[var(--muted-foreground)]"
            role="status"
            aria-live="polite"
          >
            {bulkProgress.action === "install"
              ? localizeUi("ui.agents.agentcatalogview.installingValue1Value2", {
                  value1: bulkProgress.completed,
                  value2: bulkProgress.total,
                })
              : localizeUi("ui.agents.agentcatalogview.uninstallingValue1Value2", {
                  value1: bulkProgress.completed,
                  value2: bulkProgress.total,
                })}{" "}
            {localizeUi("ui.agents.agentcatalogview.keepMarinaraEngineOpenUntilThisFinishes")}
          </p>
        )}

        <div className="flex min-h-0 flex-1">
          {showAside && (
            <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)]/35 p-4 md:flex">
              {searchField}
              <AgentModeFilter value={modeFilter} onChange={setModeFilter} />
              <nav className="space-y-0.5" aria-label={localizeUi("ui.agents.organizer.title")}>
                {navItems.map((item) => (
                  <button
                    key={item.page.kind}
                    type="button"
                    onClick={() => go(item.page)}
                    aria-current={isCurrent(item.page) ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--sidebar-accent)]",
                      isCurrent(item.page) && "bg-[var(--marinara-chat-chrome-highlight-bg)] font-semibold",
                    )}
                  >
                    <item.icon size="0.95rem" className="text-[var(--muted-foreground)]" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.count > 0 && (
                      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{item.count}</span>
                    )}
                  </button>
                ))}
              </nav>
              <div>
                <h2 className="mb-1 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.organizer.sectionsHeading")}
                </h2>
                <div className="space-y-0.5">
                  {sectionCounts.map(({ section, entries: sectionEntries }) => {
                    const target = { kind: "section", id: section } as const;
                    const expanded = openSections.has(section);
                    const sectionLabel = localizeUi(sectionLabelKey(section));
                    return (
                      <div key={section}>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => go(target)}
                            aria-current={isCurrent(target) ? "page" : undefined}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--sidebar-accent)]",
                              isCurrent(target) && "bg-[var(--marinara-chat-chrome-highlight-bg)] font-semibold",
                            )}
                          >
                            <IconStack entries={sectionEntries} />
                            <span className="min-w-0 flex-1 truncate">{sectionLabel}</span>
                            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                              {sectionEntries.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSection(section)}
                            aria-expanded={expanded}
                            aria-label={localizeUi("ui.agents.organizer.showSectionAgents", { section: sectionLabel })}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)]"
                          >
                            <ChevronRight
                              size="0.9rem"
                              aria-hidden="true"
                              className={cn("transition-transform", expanded && "rotate-90")}
                            />
                          </button>
                        </div>
                        {expanded && (
                          <ul className="mb-1 ml-5 space-y-0.5 border-l border-[var(--border)] pl-2">
                            {sectionEntries.map((entry) => {
                              const installed = installedById.get(entry.manifest.id);
                              return (
                                <li key={entry.manifest.id}>
                                  <button
                                    type="button"
                                    onClick={() => go({ kind: "agent", id: entry.manifest.id })}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--sidebar-accent)]"
                                  >
                                    <AgentIcon entry={entry} className="h-7 w-7 rounded-lg" />
                                    <span className="min-w-0 flex-1 truncate">{entry.manifest.name}</span>
                                    {checkReasonOf(installed) !== null ? (
                                      <span className="text-xs font-semibold text-[var(--marinara-app-accent-static)]">
                                        {localizeUi("ui.agents.organizer.needsCheck")}
                                      </span>
                                    ) : hasUpdate(entry, installed) ? (
                                      <span className="text-xs font-semibold text-[var(--marinara-chat-chrome-highlight-text,var(--primary))]">
                                        {localizeUi("ui.agents.agentcatalogview.update")}
                                      </span>
                                    ) : installed ? (
                                      <Check
                                        size="0.85rem"
                                        className="text-[var(--muted-foreground)]"
                                        aria-label={localizeUi("ui.agents.organizer.installed")}
                                      />
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn("space-y-2 border-b border-[var(--border)]/50 p-3 md:hidden", !showAside && "hidden")}>
              {searchField}
              <AgentModeFilter value={modeFilter} onChange={setModeFilter} />
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
                {[
                  ...navItems.map((item) => ({
                    target: item.page as OrganizerPage,
                    label: item.label,
                    count: item.count,
                  })),
                  ...sectionCounts.map(({ section, entries: sectionEntries }) => ({
                    target: { kind: "section", id: section } as OrganizerPage,
                    label: localizeUi(sectionLabelKey(section)),
                    count: sectionEntries.length,
                  })),
                ].map((chip) => (
                  <button
                    key={chip.target.kind === "section" ? chip.target.id : chip.target.kind}
                    type="button"
                    onClick={() => go(chip.target)}
                    aria-pressed={isCurrent(chip.target)}
                    className={cn(
                      "mari-chrome-control h-8 shrink-0 px-3 text-xs",
                      isCurrent(chip.target) && "mari-chrome-control--selected",
                    )}
                  >
                    {chip.label}
                    {chip.count > 0 && chip.target.kind !== "home" && (
                      <span className="ml-1 tabular-nums text-[var(--muted-foreground)]">{chip.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn(page.kind !== "agent" && "mx-auto w-full max-w-6xl p-4 md:p-6")}>{content}</div>
          </main>
        </div>

        {menu && (
          <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.entry)} onClose={() => setMenu(null)} autoFocus />
        )}
        <CustomAgentRepositoriesModal open={customRepositoriesOpen} onClose={() => setCustomRepositoriesOpen(false)} />
      </div>
    </OrganizerContext.Provider>
  );
}
