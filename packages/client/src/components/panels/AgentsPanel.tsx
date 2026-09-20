// ──────────────────────────────────────────────
// Panel: Agents
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Sparkles,
  Copy,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Search,
  PenLine,
  Radar,
  Puzzle,
  Camera,
  Download,
  Check,
  FolderPlus,
  Loader2,
  ArrowUpDown,
  ShieldCheck,
  TriangleAlert,
  Dices,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore, type ResourcePanelSort } from "../../stores/ui.store";
import {
  useAgentConfigs,
  useCreateAgent,
  useDeleteAgent,
  useAgentImportPolicy,
  useImportAgent,
  useUpdateAgent,
  useUpdateAgentByType,
  useUploadAgentImage,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import { useConnections } from "../../hooks/use-connections";
import { appendLocalSidecarConnectionOption, type ConnectionProviderLike } from "../../lib/connection-filters";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  useCapabilityAgentRegistry,
  useCapabilityCatalog,
  useImportRuleset,
  useInstalledRulesets,
  useRemoveRuleset,
  useUninstallCapabilityPackage,
} from "../../hooks/use-capability-packages";
import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  communityRulesetId,
  getDefaultBuiltInAgentSettings,
  getFolderImportEntries,
  isAgentConfigDeleted,
  isRetiredBuiltInAgentId,
  normalizeAgentPhaseForType,
  parseRulesetDefinition,
  RULESET_LOCAL_NAMESPACE,
  RULESET_MAX_BYTES,
  type CustomAgentCapability,
  type AgentCategory,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { confirmNonEmptyFolderDelete, showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { rulesetRepositoryLabel } from "../../lib/ruleset-source";
import { sortBasicPanelItems } from "../../lib/panel-sort";
import { downloadZipFile } from "../../lib/download-zip";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { TouchDragHandle } from "../ui/TouchDragHandle";
import {
  countSkippedAgentImportFunctions,
  createAgentFolderPackageFilename,
  createAgentFolderPackageFiles,
  normalizeAgentImportEntry,
  sanitizeAgentSettingsForTransfer,
  type AgentTransferConfig,
} from "../../lib/agent-transfer";
import {
  collectFolderPackageEntries,
  readTextFilesFromFileList,
  type FolderPackageImportEntry,
} from "../../lib/folder-package-transfer";
import { isZipFile, readTextFilesFromZip } from "../../lib/read-zip-text";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { AgentArtwork } from "../agents/AgentArtwork";
import { AgentRoutingModal } from "../agents/AgentRoutingModal";
import { AgentModeFilter, type AgentModeFilterValue } from "../agents/AgentModeFilter";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Modal } from "../ui/Modal";
import { RulesetImportReviewModal } from "../agents/RulesetImportReviewModal";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { ChatResourceActionButton } from "../chat/ChatResourceActionButton";
import { ApiError } from "../../lib/api-client";
import { settleAgentConnectionAssignments } from "../../lib/agent-routing-bulk";

type JsonRecord = Record<string, unknown>;
type NormalizedAgentImport = NonNullable<ReturnType<typeof normalizeAgentImportEntry>>;
type PendingAgentImport = {
  agents: NormalizedAgentImport[];
  source: "file" | "folder";
  skippedFunctionCount: number;
};
/** A ruleset file waiting for the user to confirm it. The text is kept verbatim, because the server
 *  stores the bytes the user actually chose, not a re-serialization of the parsed document. */
type PendingRulesetImport = { definition: RulesetDefinition; rulesetId: string; text: string };
const AGENT_GRADIENT_SURFACE =
  "mari-panel-gradient-surface mari-panel-gradient--agents text-[var(--mari-panel-gradient-text)]";
const AGENT_GRADIENT_BUTTON = "mari-panel-gradient-button mari-panel-gradient--agents";

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseAgentSettings(value: unknown): JsonRecord {
  if (isJsonRecord(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isJsonRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getAgentImportEntries(parsed: unknown) {
  return getFolderImportEntries(parsed, ["agents"]);
}

function serializeAgentConfig(agent: AgentConfigRow): AgentTransferConfig {
  const settings = sanitizeAgentSettingsForTransfer(parseAgentSettings(agent.settings));
  if (typeof settings.author !== "string" || !settings.author.trim()) {
    settings.author = "Unknown";
  }
  const resultType = typeof settings.resultType === "string" ? settings.resultType : undefined;
  return {
    type: agent.type,
    name: agent.name,
    description: agent.description,
    phase: normalizeAgentPhaseForType(agent.type, agent.phase),
    enabled: true,
    connectionId: null,
    imagePath: null,
    promptTemplate: agent.promptTemplate,
    settings,
    ...(resultType ? { resultType } : {}),
  };
}

function useTouchSafeAgentDragMode() {
  const readTouchSafeMode = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches;
  }, []);
  const [touchSafeMode, setTouchSafeMode] = useState(readTouchSafeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const mobileViewportQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setTouchSafeMode(readTouchSafeMode());

    update();
    coarsePointerQuery.addEventListener("change", update);
    mobileViewportQuery.addEventListener("change", update);
    return () => {
      coarsePointerQuery.removeEventListener("change", update);
      mobileViewportQuery.removeEventListener("change", update);
    };
  }, [readTouchSafeMode]);

  return touchSafeMode;
}

function createBuiltInAgentConfigRow(
  agent: (typeof BUILT_IN_AGENTS)[number],
  config: AgentConfigRow | null | undefined,
): AgentConfigRow {
  const defaultSettings = {
    ...getDefaultBuiltInAgentSettings(agent.id),
    ...(DEFAULT_AGENT_TOOLS[agent.id]?.length ? { enabledTools: DEFAULT_AGENT_TOOLS[agent.id] } : {}),
  };
  return {
    id: agent.id,
    type: agent.id,
    name: agent.name,
    description: config?.description ?? agent.description,
    phase: normalizeAgentPhaseForType(agent.id, config?.phase ?? agent.phase),
    enabled: "true",
    connectionId: config?.connectionId ?? null,
    imagePath: config?.imagePath ?? null,
    promptTemplate: config?.promptTemplate ?? "",
    settings: config?.settings ?? JSON.stringify(defaultSettings),
    createdAt: config?.createdAt ?? "",
    updatedAt: config?.updatedAt ?? "",
  };
}

function getAgentLibraryDisplayName(agent: AgentConfigRow) {
  return BUILT_IN_AGENTS.find((entry) => entry.id === agent.type)?.name ?? agent.name;
}

function createDuplicateAgentInput(agent: AgentConfigRow) {
  const settings = sanitizeAgentSettingsForTransfer(parseAgentSettings(agent.settings));
  if (typeof settings.author !== "string" || !settings.author.trim()) {
    settings.author = "Unknown";
  }
  const resultType = typeof settings.resultType === "string" ? settings.resultType : undefined;

  return {
    type: `${agent.type}-copy`,
    name: `${getAgentLibraryDisplayName(agent)} (Copy)`,
    description: agent.description,
    phase: normalizeAgentPhaseForType(agent.type, agent.phase),
    enabled: true,
    connectionId: agent.connectionId,
    imagePath: agent.imagePath,
    promptTemplate: agent.promptTemplate,
    settings,
    ...(resultType ? { resultType } : {}),
  };
}

export function AgentsPanel() {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const { data: agentConfigs, isLoading } = useAgentConfigs();
  const { data: capabilityAgents, isLoading: capabilityAgentsLoading } = useCapabilityAgentRegistry();
  const { data: capabilityCatalog } = useCapabilityCatalog();
  const { data: installedRulesets = [], isLoading: rulesetsLoading } = useInstalledRulesets();
  const createAgent = useCreateAgent();
  const importAgent = useImportAgent();
  const importRuleset = useImportRuleset();
  const removeRuleset = useRemoveRuleset();
  const updateAgent = useUpdateAgent();
  const updateAgentByType = useUpdateAgentByType();
  const { data: connectionsList } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const [bulkConnectionId, setBulkConnectionId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [routingOpen, setRoutingOpen] = useState(false);
  const { data: agentImportPolicy, isLoading: agentImportPolicyLoading } = useAgentImportPolicy();
  const deleteAgent = useDeleteAgent();
  const uninstallCapabilityPackage = useUninstallCapabilityPackage();
  const uploadAgentImage = useUploadAgentImage();
  const { data: agentFolders = [] } = useLibraryFolders("agents");
  const createAgentFolder = useCreateLibraryFolder("agents");
  const updateAgentFolder = useUpdateLibraryFolder("agents");
  const deleteAgentFolder = useDeleteLibraryFolder("agents");
  const moveAgentItem = useMoveLibraryItem("agents");
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const sort = useUIStore((s) => s.agentPanelSort);
  const setSort = useUIStore((s) => s.setAgentPanelSort);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentModeFilter, setAgentModeFilter] = useState<AgentModeFilterValue>("all");
  const agentImageInputRef = useRef<HTMLInputElement>(null);
  const agentImportInputRef = useRef<HTMLInputElement>(null);
  const agentFolderImportInputRef = useRef<HTMLInputElement>(null);
  const rulesetImportInputRef = useRef<HTMLInputElement>(null);
  const imageTargetAgentIdRef = useRef<string | null>(null);
  const [agentImportError, setAgentImportError] = useState<string | null>(null);
  const [agentImportSuccess, setAgentImportSuccess] = useState<string | null>(null);
  const [pendingAgentImport, setPendingAgentImport] = useState<PendingAgentImport | null>(null);
  const [pendingRulesetImport, setPendingRulesetImport] = useState<PendingRulesetImport | null>(null);
  const [rulesetImportFailure, setRulesetImportFailure] = useState<string | null>(null);
  const [approvedImportCapabilities, setApprovedImportCapabilities] = useState<Record<string, CustomAgentCapability[]>>(
    {},
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const suppressAgentClickRef = useRef(false);
  const handleFolderRenameGesture = useFolderRenameGesture();
  const touchSafeAgentDragMode = useTouchSafeAgentDragMode();
  const nativeAgentDragEnabled = !touchSafeAgentDragMode;
  const agentImportsEnabled = agentImportPolicy?.enabled === true;
  const agentImportsDisabledHelp = localizeUi("settings.agentImports.enableFirst");

  const openAgentImportPicker = useCallback(
    (kind: "file" | "folder" | "ruleset") => {
      if (!agentImportsEnabled) {
        toast.info(agentImportsDisabledHelp);
        return;
      }
      if (kind === "file") agentImportInputRef.current?.click();
      else if (kind === "folder") agentFolderImportInputRef.current?.click();
      else rulesetImportInputRef.current?.click();
    },
    [agentImportsDisabledHelp, agentImportsEnabled],
  );

  const chooseAgentImportSource = useCallback(async () => {
    if (!agentImportsEnabled) {
      openAgentImportPicker("file");
      return;
    }

    const source = await showChoiceDialog({
      title: localizeUi("ui.panels.agentspanel.importAgents"),
      message: localizeUi("ui.panels.agentspanel.chooseAgentFilesOrFolder"),
      choices: [
        { key: "file", label: localizeUi("ui.panels.gameassetssettings.chooseFiles"), tone: "accent" },
        { key: "folder", label: localizeUi("ui.chat.musicdjsetupfields.chooseFolder"), tone: "accent" },
        { key: "ruleset", label: localizeUi("game.ruleset.import.choice"), tone: "accent" },
      ],
    });
    if (source === "file" || source === "folder" || source === "ruleset") openAgentImportPicker(source);
  }, [agentImportsEnabled, localizeUi, openAgentImportPicker]);

  const agentConfigRows = useMemo(() => (agentConfigs ?? []) as AgentConfigRow[], [agentConfigs]);
  const availableBuiltInAgents = useMemo(() => {
    if (!capabilityAgents) return [...BUILT_IN_AGENTS];
    const availableIds = new Set(capabilityAgents.map((agent) => agent.id));
    return BUILT_IN_AGENTS.filter((agent) => availableIds.has(agent.id));
  }, [capabilityAgents]);
  const builtInAgentIds = useMemo(
    () => new Set(availableBuiltInAgents.map((agent) => agent.id)),
    [availableBuiltInAgents],
  );
  const packageIdByAgentType = useMemo(
    () =>
      new Map(
        (capabilityAgents ?? []).flatMap((agent) => (agent.packageId ? ([[agent.id, agent.packageId]] as const) : [])),
      ),
    [capabilityAgents],
  );
  const capabilityAgentRegistryReady = !capabilityAgentsLoading && capabilityAgents !== undefined;
  const catalogArtworkByAgentId = useMemo(
    () =>
      new Map((capabilityCatalog?.packages ?? []).map((entry) => [entry.manifest.id, entry.iconUrl ?? null] as const)),
    [capabilityCatalog],
  );
  const visibleAgentConfigs = useMemo(
    () => agentConfigRows.filter((config) => !isAgentConfigDeleted(config.settings)),
    [agentConfigRows],
  );
  const deletedBuiltInTypes = useMemo(
    () =>
      new Set(
        agentConfigRows
          .filter((config) => builtInAgentIds.has(config.type))
          .filter((config) => isAgentConfigDeleted(config.settings))
          .map((config) => config.type),
      ),
    [agentConfigRows, builtInAgentIds],
  );
  const visibleBuiltInAgents = useMemo(
    // The management pane lists every installed package, including feature-only
    // Agents such as Noodle. `libraryHidden` still keeps those manifests out of
    // chat pickers and runtime Agent menus.
    () => availableBuiltInAgents.filter((agent) => !deletedBuiltInTypes.has(agent.id)),
    [availableBuiltInAgents, deletedBuiltInTypes],
  );
  const bulkConnectionOptions = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        (connectionsList ?? []) as ConnectionProviderLike[],
        import.meta.env.VITE_MARINARA_LITE !== "true" && sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [connectionsList, sidecarModelDownloaded, sidecarModelDisplayName],
  );
  const customAgentConfigs = useMemo(
    () => visibleAgentConfigs.filter((config) => !builtInAgentIds.has(config.type)),
    [visibleAgentConfigs, builtInAgentIds],
  );
  const bulkAssignTargetCount = visibleBuiltInAgents.length + customAgentConfigs.length;
  const handleBulkAssignConnection = async () => {
    if (bulkAssigning || bulkAssignTargetCount === 0) return;
    const nextConnectionId = bulkConnectionId || null;
    const optionName = bulkConnectionId
      ? (bulkConnectionOptions.find((option) => option.id === bulkConnectionId)?.name ?? bulkConnectionId)
      : localizeUi("ui.panels.agentspanel.bulkConnectionAgentDefault");
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.panels.agentspanel.bulkConnectionApply"),
      message: localizeUi("ui.panels.agentspanel.bulkConnectionConfirm", {
        value1: String(bulkAssignTargetCount),
        value2: optionName,
      }),
    });
    if (!confirmed) return;
    setBulkAssigning(true);
    try {
      const assignments = [
        ...visibleBuiltInAgents.map((agent) => ({
          name: agent.name,
          apply: () => updateAgentByType.mutateAsync({ agentType: agent.id, connectionId: nextConnectionId }),
        })),
        ...customAgentConfigs.map((config) => ({
          name: config.name,
          apply: () => updateAgent.mutateAsync({ id: config.id, connectionId: nextConnectionId }),
        })),
      ];
      const { failedNames } = await settleAgentConnectionAssignments(assignments);
      if (failedNames.length) {
        toast.error(localizeUi("agentRouting.saveFailed", { names: failedNames.join(", ") }));
      } else {
        toast.success(
          localizeUi("ui.panels.agentspanel.bulkConnectionDone", {
            value1: String(bulkAssignTargetCount),
            value2: optionName,
          }),
        );
      }
    } catch {
      toast.error(localizeUi("ui.panels.agentspanel.bulkConnectionFailed"));
    } finally {
      setBulkAssigning(false);
    }
  };
  // Custom agents = DB entries whose type doesn't match any built-in
  const customAgents = useMemo(
    () =>
      visibleAgentConfigs.filter(
        (config) => !builtInAgentIds.has(config.type) && !isRetiredBuiltInAgentId(config.type),
      ),
    [builtInAgentIds, visibleAgentConfigs],
  );
  const configByType = useMemo(
    () => new Map(visibleAgentConfigs.map((config) => [config.type, config])),
    [visibleAgentConfigs],
  );
  const visibleBuiltInDisplayAgents = useMemo(
    () =>
      visibleBuiltInAgents.map((agent) => {
        const config = configByType.get(agent.id);
        return {
          ...agent,
          name: agent.name,
          description: config?.description ?? agent.description,
          createdAt: config?.createdAt ?? "",
          updatedAt: config?.updatedAt ?? "",
        };
      }),
    [configByType, visibleBuiltInAgents],
  );
  const builtInExportRows = useMemo(
    () => visibleBuiltInAgents.map((agent) => createBuiltInAgentConfigRow(agent, configByType.get(agent.id))),
    [configByType, visibleBuiltInAgents],
  );
  const selectableAgents = useMemo(() => [...builtInExportRows, ...customAgents], [builtInExportRows, customAgents]);
  const hasInstalledAgents = selectableAgents.length > 0;
  const selectableAgentById = useMemo(
    () => new Map(selectableAgents.map((agent) => [agent.id, agent])),
    [selectableAgents],
  );
  const folderedAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of agentFolders) {
      for (const id of folder.itemIds) ids.add(id);
    }
    return ids;
  }, [agentFolders]);

  const agentSearchQuery = agentSearch.trim().toLowerCase();
  const agentSearchActive = agentSearchQuery.length > 0;
  const agentFilterActive = agentSearchActive || agentModeFilter !== "all";
  const modeAllowlistByAgentType = useMemo(
    () => new Map(availableBuiltInAgents.map((agent) => [agent.id, agent.modeAllowlist] as const)),
    [availableBuiltInAgents],
  );
  const matchesAgentFilters = (agent: { type: string; name: string; description: string; category: string }) => {
    const modeAllowlist = modeAllowlistByAgentType.get(agent.type);
    const matchesMode = agentModeFilter === "all" || !modeAllowlist?.length || modeAllowlist.includes(agentModeFilter);
    const matchesSearch =
      !agentSearchQuery ||
      agent.name.toLowerCase().includes(agentSearchQuery) ||
      agent.description.toLowerCase().includes(agentSearchQuery) ||
      agent.category.toLowerCase().includes(agentSearchQuery);
    return matchesMode && matchesSearch;
  };
  const getAgentFilterData = (agent: AgentConfigRow) => ({
    type: agent.type,
    name: agent.name,
    description: agent.description,
    category: builtInAgentIds.has(agent.type)
      ? (availableBuiltInAgents.find((entry) => entry.id === agent.type)?.category ?? "misc")
      : "custom",
  });
  const agentCategorySections: Array<{
    category: AgentCategory;
    title: string;
    emptyMessage: string;
    icon: ReactNode;
  }> = [
    {
      category: "writer",
      title: localizeUi("ui.panels.agentspanel.writingAgents"),
      emptyMessage: localizeUi("ui.panels.agentspanel.noWritingAgentsYet"),
      icon: <PenLine size="0.8125rem" />,
    },
    {
      category: "tracker",
      title: localizeUi("ui.panels.agentspanel.trackerAgents"),
      emptyMessage: localizeUi("ui.panels.agentspanel.noTrackerAgentsYet"),
      icon: <Radar size="0.8125rem" />,
    },
    {
      category: "misc",
      title: localizeUi("ui.panels.agentspanel.miscAgents"),
      emptyMessage: localizeUi("ui.panels.agentspanel.noMiscAgentsYet"),
      icon: <Puzzle size="0.8125rem" />,
    },
  ];
  const visibleCustomAgents = sortBasicPanelItems(
    customAgents.filter(
      (agent) =>
        !folderedAgentIds.has(agent.id) &&
        matchesAgentFilters({
          type: agent.type,
          name: agent.name,
          description: agent.description,
          category: "custom",
        }),
    ),
    sort,
    (agent) => agent.name,
    (agent) => agent.createdAt || agent.updatedAt,
  );
  const hasVisibleFolderAgents = agentFolders.some((folder) =>
    folder.itemIds.some((id) => {
      const agent = selectableAgentById.get(id);
      return agent ? matchesAgentFilters(getAgentFilterData(agent)) : false;
    }),
  );
  const hasVisibleAgents =
    agentCategorySections.some((section) =>
      visibleBuiltInDisplayAgents.some(
        (agent) =>
          !folderedAgentIds.has(agent.id) &&
          agent.category === section.category &&
          matchesAgentFilters({ ...agent, type: agent.id }),
      ),
    ) ||
    visibleCustomAgents.length > 0 ||
    hasVisibleFolderAgents;
  const selectedAgents = useMemo(
    () => selectableAgents.filter((agent) => selectedAgentIds.has(agent.id)),
    [selectableAgents, selectedAgentIds],
  );

  // A rules package adds no agent, so it is listed in its own section or it would be installed and
  // invisible here. Rulesets are Game Mode only, which is what the mode filter tests. The search and
  // mode controls only render while agents are installed, so without agents nothing is filtered:
  // a filter the user can no longer see or clear must not hide the rulesets.
  const visibleRulesets = installedRulesets.filter(
    ({ definition }) =>
      !hasInstalledAgents ||
      ((agentModeFilter === "all" || agentModeFilter === "game") &&
        (!agentSearchQuery ||
          definition.name.toLowerCase().includes(agentSearchQuery) ||
          definition.coverage.summary.toLowerCase().includes(agentSearchQuery))),
  );

  const confirmAndUninstallRuleset = async (packageId: string, name: string) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.agents.agentcatalogview.uninstallValue1", { value1: name }),
      message: localizeUi("ui.panels.agentspanel.uninstallRulesetMessage"),
      confirmLabel: localizeUi("ui.agents.agentcatalogview.uninstall"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await uninstallCapabilityPackage.mutateAsync(packageId);
      toast.success(localizeUi("ui.agents.agentcatalogview.value1Uninstalled", { value1: name }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.agents.agentcatalogview.agentUninstallFailed"),
      );
    }
  };

  const removeAgentResource = useCallback(
    (agent: AgentConfigRow) => {
      const packageId = packageIdByAgentType.get(agent.type);
      return packageId
        ? uninstallCapabilityPackage.mutateAsync(packageId)
        : deleteAgent.mutateAsync(builtInAgentIds.has(agent.type) ? agent.type : agent.id);
    },
    [builtInAgentIds, deleteAgent, packageIdByAgentType, uninstallCapabilityPackage],
  );

  const confirmAndRemoveAgent = useCallback(
    async (agent: AgentConfigRow) => {
      if (!capabilityAgentRegistryReady) return;
      const name = getAgentLibraryDisplayName(agent);
      const packageId = packageIdByAgentType.get(agent.type);
      const confirmed = await showConfirmDialog({
        title: packageId
          ? localizeUi("ui.agents.agentcatalogview.uninstallValue1", { value1: name })
          : localizeUi("ui.panels.agentspanel.deleteAgent"),
        message: packageId
          ? localizeUi("ui.agents.agentcatalogview.theDownloadedPackageActiveChatSelectionsAndAgentConfiguration")
          : builtInAgentIds.has(agent.type)
            ? localizeUi("ui.panels.agentspanel.deleteBuiltInValue1", { value1: name })
            : localizeUi("ui.panels.agentspanel.deleteValue1", { value1: name }),
        confirmLabel: packageId
          ? localizeUi("ui.agents.agentcatalogview.uninstall")
          : localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed) return;
      try {
        await removeAgentResource(agent);
        if (packageId) {
          toast.success(localizeUi("ui.agents.agentcatalogview.value1Uninstalled", { value1: name }));
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : packageId
              ? localizeUi("ui.agents.agentcatalogview.agentUninstallFailed")
              : localizeUi("ui.panels.agentspanel.failedToDeleteValue1AgentValue2", { value1: 1, value2: "" }),
        );
      }
    },
    [builtInAgentIds, capabilityAgentRegistryReady, localizeUi, packageIdByAgentType, removeAgentResource],
  );

  const handleCreateAgent = () => {
    // Create a new custom agent immediately in DB then open editor
    openAgentDetail("__new__");
  };

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedAgentIds(new Set());
  }, []);

  const toggleAgentSelection = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  const getDraggedAgentIds = useCallback(
    (agentId: string) => (selectionMode && selectedAgentIds.has(agentId) ? Array.from(selectedAgentIds) : [agentId]),
    [selectedAgentIds, selectionMode],
  );
  const getDraggedAgentTypes = useCallback(
    (agentId: string) =>
      getDraggedAgentIds(agentId)
        .map((id) => selectableAgentById.get(id)?.type)
        .filter((type): type is string => Boolean(type)),
    [getDraggedAgentIds, selectableAgentById],
  );

  const handleCreateFolder = useCallback(() => {
    createAgentFolder.mutate(
      { name: getNextUnnamedLibraryFolderName(agentFolders) },
      {
        onSuccess: (folder) => setExpandedFolderId(folder.id),
      },
    );
  }, [agentFolders, createAgentFolder]);

  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const name = editFolderName.trim();
      if (name) updateAgentFolder.mutate({ id: folderId, name });
      setEditingFolderId(null);
      setEditFolderName("");
    },
    [editFolderName, updateAgentFolder],
  );

  const handleAgentDrop = useCallback(
    (folderId: string | null, agentIds?: string[]) => {
      if (!draggedAgentId) return;
      moveAgentItem.mutate({ itemIds: agentIds ?? [draggedAgentId], folderId });
      setDraggedAgentId(null);
    },
    [draggedAgentId, moveAgentItem],
  );

  const finishAgentTouchDrag = useCallback(
    (agentId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-agent-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-agent-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.agentFolderId) {
        handleAgentDrop(folderElement.dataset.agentFolderId, getDraggedAgentIds(agentId));
      } else if (rootElement) {
        handleAgentDrop(null, getDraggedAgentIds(agentId));
      }
      setDraggedAgentId(null);
      window.setTimeout(() => {
        suppressAgentClickRef.current = false;
      }, 0);
    },
    [getDraggedAgentIds, handleAgentDrop],
  );

  const cancelAgentTouchDrag = useCallback((_agentId: string, wasActive: boolean) => {
    setDraggedAgentId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressAgentClickRef.current = false;
      }, 0);
    } else {
      suppressAgentClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startAgentTouchDrag } = useTouchFolderDrag({
    onActivate: (agentId) => {
      suppressAgentClickRef.current = true;
      setDraggedAgentId(agentId);
    },
    onDrop: finishAgentTouchDrag,
    onCancel: cancelAgentTouchDrag,
  });

  const handleExportSelectedAgents = useCallback(async () => {
    if (selectedAgents.length === 0) {
      toast.error(localizeUi("ui.panels.agentspanel.selectAtLeastOneAgentToExport"));
      return;
    }

    setExportingSelected(true);
    try {
      const files = createAgentFolderPackageFiles(selectedAgents.map(serializeAgentConfig));
      const firstAgent = selectedAgents[0];
      const filename =
        selectedAgents.length === 1 && firstAgent
          ? createAgentFolderPackageFilename(getAgentLibraryDisplayName(firstAgent), "agent")
          : "marinara-agents.zip";
      downloadZipFile(files, filename);
      toast.success(
        localizeUi("ui.panels.agentspanel.exportedValue1AgentValue2", {
          value1: selectedAgents.length,
          value2: selectedAgents.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.panels.agentspanel.failedToExportAgents"));
    } finally {
      setExportingSelected(false);
    }
  }, [selectedAgents, localizeUi]);

  const handleDuplicateAgent = useCallback(
    async (agent: AgentConfigRow) => {
      try {
        const created = await createAgent.mutateAsync(createDuplicateAgentInput(agent));
        const createdId = typeof created === "object" && created && "id" in created ? String(created.id) : null;
        toast.success(localizeUi("ui.panels.agentspanel.copiedValue1", { value1: getAgentLibraryDisplayName(agent) }));
        if (createdId) openAgentDetail(createdId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : localizeUi("ui.panels.agentspanel.failedToCopyAgent"));
      }
    },
    [createAgent, openAgentDetail, localizeUi],
  );

  const handleDeleteSelectedAgents = useCallback(async () => {
    if (!capabilityAgentRegistryReady || selectedAgents.length === 0) return;

    const includesPackageAgents = selectedAgents.some((agent) => packageIdByAgentType.has(agent.type));

    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.panels.agentspanel.removeAgents"),
        message: localizeUi(
          includesPackageAgents
            ? "ui.panels.agentspanel.removeSelectedPackageAgents"
            : "ui.panels.agentspanel.removeSelectedAgents",
          { count: selectedAgents.length },
        ),
        confirmLabel: localizeUi("ui.panels.agentspanel.remove"),
        tone: "destructive",
      }))
    ) {
      return;
    }

    const resources = new Map<string, AgentConfigRow[]>();
    for (const agent of selectedAgents) {
      const packageId = packageIdByAgentType.get(agent.type);
      const key = packageId ? `package:${packageId}` : `agent:${agent.id}`;
      resources.set(key, [...(resources.get(key) ?? []), agent]);
    }
    const operations = [...resources.entries()];
    const results = await Promise.allSettled(operations.map(([, agents]) => removeAgentResource(agents[0]!)));
    const failedIds = operations.flatMap(([, agents], index) =>
      results[index]?.status === "rejected" ? agents.map((agent) => agent.id) : [],
    );
    const removedCount = selectedAgents.length - failedIds.length;

    if (removedCount > 0) {
      toast.success(
        localizeUi("ui.panels.agentspanel.removedValue1AgentValue2", {
          value1: removedCount,
          value2: removedCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
    }
    if (failedIds.length > 0) {
      setSelectedAgentIds(new Set(failedIds));
      toast.error(
        localizeUi("ui.panels.agentspanel.failedToRemoveValue1AgentValue2", {
          value1: failedIds.length,
          value2: failedIds.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
      return;
    }

    exitSelectionMode();
  }, [
    capabilityAgentRegistryReady,
    exitSelectionMode,
    localizeUi,
    packageIdByAgentType,
    removeAgentResource,
    selectedAgents,
  ]);

  const prepareAgentEntries = useCallback(
    (entries: FolderPackageImportEntry[], source: "file" | "folder", skippedFunctionCount = 0) => {
      if (entries.length === 0) throw new Error("No agents found in file");

      const agents = entries
        .map((entry) => normalizeAgentImportEntry(entry.raw, entry.resolveTextFile))
        .filter((agent): agent is NormalizedAgentImport => agent !== null);
      if (agents.length === 0) throw new Error("No valid agents found in file");
      setApprovedImportCapabilities({});
      setPendingAgentImport({ agents, source, skippedFunctionCount });
    },
    [],
  );

  const handleApproveAgentImport = useCallback(async () => {
    if (!pendingAgentImport) return;
    let imported = 0;
    const failed: string[] = [];
    const failedAgents: NormalizedAgentImport[] = [];
    for (const candidate of pendingAgentImport.agents) {
      const { requestedCapabilities: _requestedCapabilities, ...agent } = candidate;
      try {
        await importAgent.mutateAsync({
          agent,
          source: pendingAgentImport.source,
          approvedCapabilities: approvedImportCapabilities[candidate.type] ?? [],
          acknowledgePermissions: true,
        });
        imported++;
      } catch (error) {
        failed.push(error instanceof Error ? error.message : `Failed to import ${candidate.name}`);
        failedAgents.push(candidate);
      }
    }

    if (imported > 0) {
      setAgentImportSuccess(
        `${localizeUi("settings.agentImports.import.success", { count: imported })}${
          pendingAgentImport.skippedFunctionCount > 0
            ? ` ${localizeUi("settings.agentImports.review.functionsSkipped", {
                count: pendingAgentImport.skippedFunctionCount,
              })}`
            : ""
        }`,
      );
    }
    if (failed.length > 0) {
      setAgentImportError(
        localizeUi("settings.agentImports.import.failed", {
          count: failed.length,
          error: failed[0],
        }),
      );
    }
    if (failed.length === 0) {
      setPendingAgentImport(null);
    } else {
      const failedAgentTypes = new Set(failedAgents.map((agent) => agent.type));
      setApprovedImportCapabilities((current) =>
        Object.fromEntries(Object.entries(current).filter(([type]) => failedAgentTypes.has(type))),
      );
      setPendingAgentImport({
        ...pendingAgentImport,
        agents: failedAgents,
        skippedFunctionCount: 0,
      });
    }
  }, [approvedImportCapabilities, importAgent, localizeUi, pendingAgentImport]);

  const toggleApprovedImportCapability = useCallback((agentType: string, capability: CustomAgentCapability) => {
    setApprovedImportCapabilities((current) => {
      const selected = new Set(current[agentType] ?? []);
      if (selected.has(capability)) selected.delete(capability);
      else selected.add(capability);
      return { ...current, [agentType]: Array.from(selected) };
    });
  }, []);

  const handleImportAgents = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        event.target.value = "";
        return;
      }

      try {
        const entries = isZipFile(file)
          ? await (async () => {
              const files = await readTextFilesFromZip(file);
              const agents = collectFolderPackageEntries(files, {
                rootFilenames: ["marinara-agents.json", "marinara-agent.json"],
                collectionKeys: ["agents"],
              });
              const functions = collectFolderPackageEntries(files, {
                rootFilenames: ["marinara-agents.json", "marinara-agent.json", "marinara-functions.json"],
                collectionKeys: ["functions", "customTools", "tools"],
              });
              return {
                agents,
                skippedFunctionCount: countSkippedAgentImportFunctions(agents, functions),
              };
            })()
          : await (async () => {
              const parsed = JSON.parse(await file.text());
              return {
                agents: getAgentImportEntries(parsed).map(
                  (raw): FolderPackageImportEntry => ({
                    raw,
                    path: file.name,
                    basePath: "",
                    resolveTextFile: () => null,
                  }),
                ),
                skippedFunctionCount: getFolderImportEntries(parsed, ["functions", "customTools", "tools"]).length,
              };
            })();
        prepareAgentEntries(entries.agents, "file", entries.skippedFunctionCount);
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }

      event.target.value = "";
    },
    [agentImportsDisabledHelp, agentImportsEnabled, prepareAgentEntries],
  );

  const handleImportAgentFolder = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        event.target.value = "";
        return;
      }
      try {
        const files = await readTextFilesFromFileList(event.target.files);
        const entries = collectFolderPackageEntries(files, {
          rootFilenames: ["marinara-agents.json", "marinara-agent.json"],
          collectionKeys: ["agents"],
        });
        const functionEntries = collectFolderPackageEntries(files, {
          rootFilenames: ["marinara-agents.json", "marinara-agent.json", "marinara-functions.json"],
          collectionKeys: ["functions", "customTools", "tools"],
        });
        const skippedFunctionCount = countSkippedAgentImportFunctions(entries, functionEntries);
        prepareAgentEntries(entries, "folder", skippedFunctionCount);
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }
      event.target.value = "";
    },
    [agentImportsDisabledHelp, agentImportsEnabled, prepareAgentEntries],
  );

  // A ruleset is parsed with the SAME shared parser the server stores it through, so a file that
  // cannot work is refused here, with the author's own issues, before anything is sent.
  const handleRulesetFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        return;
      }
      if (file.size > RULESET_MAX_BYTES) {
        setAgentImportError(
          localizeUi("game.ruleset.import.tooLarge", { limit: Math.round(RULESET_MAX_BYTES / 1024) }),
        );
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        setAgentImportError(localizeUi("game.ruleset.import.unreadable"));
        return;
      }
      let parsed: ReturnType<typeof parseRulesetDefinition>;
      try {
        parsed = parseRulesetDefinition(JSON.parse(text));
      } catch {
        setAgentImportError(localizeUi("game.ruleset.import.notJson"));
        return;
      }
      if (!parsed.ok) {
        setAgentImportError(
          localizeUi("game.ruleset.import.invalid", { issues: parsed.issues.slice(0, 3).join("; ") }),
        );
        return;
      }
      try {
        setRulesetImportFailure(null);
        setPendingRulesetImport({
          definition: parsed.definition,
          rulesetId: communityRulesetId(RULESET_LOCAL_NAMESPACE, parsed.definition.id),
          text,
        });
      } catch {
        setAgentImportError(localizeUi("game.ruleset.import.unusableId", { id: parsed.definition.id }));
      }
    },
    [agentImportsDisabledHelp, agentImportsEnabled, localizeUi],
  );

  const handleConfirmRulesetImport = useCallback(async () => {
    const pending = pendingRulesetImport;
    if (!pending) return;
    setAgentImportError(null);
    setAgentImportSuccess(null);
    setRulesetImportFailure(null);
    try {
      const result = await importRuleset.mutateAsync(pending.text);
      setPendingRulesetImport(null);
      setAgentImportSuccess(
        localizeUi(result.status === "added" ? "game.ruleset.import.added" : "game.ruleset.import.unchanged", {
          name: pending.definition.name,
          version: result.version,
        }),
      );
    } catch (error) {
      // The server's refusals are already sentences the author can act on, version conflicts
      // included. The review stays open with the reason in it, so a network hiccup can be retried
      // without picking the file again.
      setRulesetImportFailure(error instanceof Error ? error.message : localizeUi("game.ruleset.import.failed"));
    }
  }, [importRuleset, localizeUi, pendingRulesetImport]);

  const confirmAndRemoveRuleset = useCallback(
    async (rulesetId: string, name: string) => {
      const confirmed = await showConfirmDialog({
        title: localizeUi("game.ruleset.remove.title", { name }),
        message: localizeUi("game.ruleset.remove.message"),
        confirmLabel: localizeUi("game.ruleset.remove.confirm"),
        tone: "destructive",
      });
      if (!confirmed) return;
      const remove = async (force: boolean) => {
        await removeRuleset.mutateAsync({ rulesetId, force });
        toast.success(localizeUi("game.ruleset.remove.done", { name }));
      };
      try {
        await remove(false);
      } catch (error) {
        // Games already playing on it are the one refusal with a way forward, so it asks again
        // naming how many rather than failing.
        const inUse =
          error instanceof ApiError && isJsonRecord(error.payload) && error.payload.code === "ruleset_in_use"
            ? Number(error.payload.games) || 0
            : null;
        if (inUse === null) {
          toast.error(error instanceof Error ? error.message : localizeUi("game.ruleset.remove.failed"));
          return;
        }
        const forced = await showConfirmDialog({
          title: localizeUi("game.ruleset.remove.title", { name }),
          message: localizeUi("game.ruleset.remove.inUseMessage", { count: inUse }),
          confirmLabel: localizeUi("game.ruleset.remove.confirm"),
          tone: "destructive",
        });
        if (!forced) return;
        try {
          await remove(true);
        } catch (retryError) {
          toast.error(retryError instanceof Error ? retryError.message : localizeUi("game.ruleset.remove.failed"));
        }
      }
    },
    [localizeUi, removeRuleset],
  );

  const handlePickAgentImage = useCallback((agentIdOrType: string) => {
    imageTargetAgentIdRef.current = agentIdOrType;
    if (agentImageInputRef.current) {
      agentImageInputRef.current.value = "";
      agentImageInputRef.current.click();
    }
  }, []);

  const renderFolderAgentCard = useCallback(
    (agent: AgentConfigRow) => {
      const builtInMeta = availableBuiltInAgents.find((entry) => entry.id === agent.type);
      const custom = !builtInMeta;
      const category = custom ? "custom" : builtInMeta.category;
      return renderAgentCard({
        localizeUi,
        id: agent.id,
        type: agent.type,
        name: getAgentLibraryDisplayName(agent),
        description: agent.description,
        category,
        imagePath: agent.imagePath || (builtInMeta ? catalogArtworkByAgentId.get(agent.type) : null) || null,
        custom,
        openAgentDetail,
        onDuplicate: () => void handleDuplicateAgent(agent),
        onImagePick: () => handlePickAgentImage(custom ? agent.id : agent.type),
        selectionMode,
        selected: selectedAgentIds.has(agent.id),
        onToggleSelected: () => toggleAgentSelection(agent.id),
        isDragging: draggedAgentId === agent.id,
        onDragStart: (event) => {
          const ids = getDraggedAgentIds(agent.id);
          const agentTypes = getDraggedAgentTypes(agent.id);
          setDraggedAgentId(agent.id);
          event.dataTransfer.effectAllowed = "copyMove";
          event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
          event.dataTransfer.setData("text/plain", agent.id);
          writeChatResourceDragPayload(event.dataTransfer, {
            version: 1,
            kind: "agent",
            ids: agentTypes,
            label:
              ids.length === 1
                ? getAgentLibraryDisplayName(agent)
                : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", { count: ids.length }),
          });
        },
        onDragEnd: () => {
          setDraggedAgentId(null);
          clearActiveChatResourceDrag();
        },
        onTouchStart: (event) =>
          startAgentTouchDrag(event, agent.id, {
            allowInteractiveTarget: true,
            sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="agent"]'),
            chatResourcePayload: {
              version: 1,
              kind: "agent",
              ids: getDraggedAgentTypes(agent.id),
              label:
                getDraggedAgentIds(agent.id).length === 1
                  ? getAgentLibraryDisplayName(agent)
                  : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", {
                      count: getDraggedAgentIds(agent.id).length,
                    }),
            },
          }),
        nativeDragEnabled: nativeAgentDragEnabled,
        touchSafeDragMode: touchSafeAgentDragMode,
        suppressClickRef: suppressAgentClickRef,
        onDelete: capabilityAgentRegistryReady ? () => void confirmAndRemoveAgent(agent) : undefined,
      });
    },
    [
      availableBuiltInAgents,
      catalogArtworkByAgentId,
      capabilityAgentRegistryReady,
      confirmAndRemoveAgent,
      draggedAgentId,
      getDraggedAgentIds,
      getDraggedAgentTypes,
      handlePickAgentImage,
      handleDuplicateAgent,
      nativeAgentDragEnabled,
      openAgentDetail,
      startAgentTouchDrag,
      selectedAgentIds,
      selectionMode,
      touchSafeAgentDragMode,
      toggleAgentSelection,
      localizeUi,
    ],
  );

  const handleAgentImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const agentId = imageTargetAgentIdRef.current;
      if (!file || !agentId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetAgentIdRef.current = null;
        toast.error(localizeUi("ui.panels.agentspanel.chooseAnImageFileForTheAgentPicture"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
          return;
        }

        try {
          await uploadAgentImage.mutateAsync({ id: agentId, image });
          toast.success(localizeUi("ui.panels.agentspanel.agentPictureUpdated"));
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : localizeUi("ui.panels.agentspanel.failedToUploadAgentPicture"),
          );
        } finally {
          imageTargetAgentIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetAgentIdRef.current = null;
        toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
      };
      reader.readAsDataURL(file);
    },
    [uploadAgentImage, localizeUi],
  );

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <input
        ref={agentImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAgentImageSelected}
      />
      <input
        ref={agentImportInputRef}
        type="file"
        accept="application/json,application/zip,.json,.zip"
        className="hidden"
        onChange={handleImportAgents}
      />
      <input
        ref={agentFolderImportInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImportAgentFolder}
        // @ts-expect-error — webkitdirectory is a non-standard but widely-supported attribute
        webkitdirectory=""
      />
      <input
        ref={rulesetImportInputRef}
        type="file"
        // By extension only: the Agent import input beside this one is the panel's JSON-typed input.
        accept=".json"
        className="hidden"
        onChange={(event) => void handleRulesetFileSelected(event)}
      />

      <button
        type="button"
        onClick={() => openAgentCatalog()}
        className="mari-chrome-control mari-chrome-control--primary w-full text-xs"
      >
        <Sparkles size="0.875rem" />
        {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
      </button>

      <div className="flex gap-2">
        <button
          onClick={handleCreateAgent}
          className={cn("flex-1 text-xs", AGENT_GRADIENT_BUTTON)}
          title={localizeUi("ui.lorebooks.lorebookassignmentsection.new")}
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => void chooseAgentImportSource()}
          aria-disabled={!agentImportsEnabled || agentImportPolicyLoading}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            (!agentImportsEnabled || agentImportPolicyLoading) && "cursor-not-allowed grayscale opacity-45",
          )}
          title={agentImportsEnabled ? localizeUi("ui.panels.agentspanel.importAgents") : agentImportsDisabledHelp}
        >
          <Download size="0.8125rem" />
        </button>
        <button
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else setSelectionMode(true);
          }}
          disabled={selectableAgents.length === 0}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            selectionMode && "mari-chrome-control--selected",
          )}
          title={localizeUi("ui.panels.agentspanel.selectAgents")}
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      <button type="button" className="mari-chrome-control w-full text-xs" onClick={() => setRoutingOpen(true)}>
        {localizeUi("agentRouting.title")}
      </button>
      {routingOpen && (
        <AgentRoutingModal
          onClose={() => setRoutingOpen(false)}
          rows={[
            ...visibleBuiltInAgents.map((agent) => {
              const config = visibleAgentConfigs.find((row) => row.type === agent.id);
              return {
                id: config?.id ?? agent.id,
                type: agent.id,
                name: config?.name ?? agent.name,
                description: config?.description ?? agent.description,
                connectionId: config?.connectionId ?? null,
                builtin: true,
              };
            }),
            ...customAgentConfigs.map((config) => ({ ...config, builtin: false })),
          ]}
        />
      )}

      <div className="flex items-center gap-2">
        <select
          value={bulkConnectionId}
          onChange={(event) => setBulkConnectionId(event.target.value)}
          disabled={bulkAssigning || bulkAssignTargetCount === 0}
          className="mari-chrome-field h-8 min-w-0 flex-1 px-2 py-0 text-[0.6875rem]"
          aria-label={localizeUi("ui.panels.agentspanel.bulkConnectionLabel")}
        >
          <option value="">{localizeUi("ui.panels.agentspanel.bulkConnectionAgentDefault")}</option>
          {bulkConnectionOptions.map((connection) => (
            <option key={connection.id ?? ""} value={connection.id ?? ""}>
              {connection.name} · {connection.model || localizeUi("agentRouting.automaticModel")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleBulkAssignConnection()}
          disabled={bulkAssigning || bulkAssignTargetCount === 0}
          className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 shrink-0 px-2 text-[0.6875rem]"
          title={localizeUi("ui.panels.agentspanel.bulkConnectionLabel")}
        >
          {bulkAssigning ? (
            <Loader2 size="0.75rem" className="animate-spin" />
          ) : (
            localizeUi("ui.panels.agentspanel.bulkConnectionApply")
          )}
        </button>
      </div>

      {agentImportError && (
        <div role="alert" className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
          {agentImportError}
        </div>
      )}
      {agentImportSuccess && (
        <div role="status" className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">
          {agentImportSuccess}
        </div>
      )}

      {!isLoading && !rulesetsLoading && !hasInstalledAgents && installedRulesets.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <span className="mari-panel-gradient-surface mari-panel-gradient--agents flex h-12 w-12 items-center justify-center rounded-2xl">
            <Sparkles size="1.25rem" />
          </span>
          <p className="max-w-[16rem] text-sm font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.agentspanel.noAgentsInstalledYetClickDownloadAgentsToAdd")}
          </p>
        </div>
      )}

      {hasInstalledAgents && (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search
              size="0.8125rem"
              className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={agentSearch}
              onChange={(event) => setAgentSearch(event.target.value)}
              placeholder={localize("Search agents")}
              className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ResourcePanelSort)}
              className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
              title={localizeUi("ui.panels.agentspanel.sortOrder")}
              aria-label={localizeUi("ui.panels.agentspanel.sortAgents")}
            >
              <option value="name-asc">{localizeUi("ui.panels.backgroundpicker.aZ")}</option>
              <option value="name-desc">{localizeUi("ui.panels.backgroundpicker.zA")}</option>
              <option value="newest">{localizeUi("ui.panels.backgroundpicker.newest")}</option>
              <option value="oldest">{localizeUi("ui.panels.backgroundpicker.oldest")}</option>
            </select>
            <ArrowUpDown
              size="0.625rem"
              className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mari-chrome-text-muted py-4 text-center text-xs">
          {localizeUi("ui.characters.characterlibraryview.loading")}
        </div>
      )}

      {hasInstalledAgents && !hasVisibleAgents && (
        <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">
          {localizeUi("ui.panels.agentspanel.noAgentsMatchFilters")}
        </p>
      )}

      {hasInstalledAgents && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateFolder}
              className="mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]"
            >
              <FolderPlus size="0.75rem" />
              {localizeUi("ui.panels.backgroundpicker.newFolder")}
            </button>
          </div>
          <AgentModeFilter value={agentModeFilter} onChange={setAgentModeFilter} />
          {agentFolders.length > 0 && (
            <p className="mari-folder-helper">
              {localizeUi("ui.panels.agentspanel.dragAndDropAgentsToFoldersDoubleClickOr")}
            </p>
          )}
          {draggedAgentId && (
            <div
              data-agent-folder-root
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const payload = event.dataTransfer.getData("application/x-marinara-agent-ids");
                handleAgentDrop(null, payload ? (JSON.parse(payload) as string[]) : undefined);
              }}
              className="rounded-xl border border-dashed border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-[0.625rem] text-[var(--marinara-chat-chrome-button-text-active)]"
            >
              {localizeUi("ui.panels.agentspanel.dropHereToMoveOutOfFolder")}
            </div>
          )}
          {agentFolders.map((folder) => {
            const isEditing = editingFolderId === folder.id;
            const folderAgents = sortBasicPanelItems(
              folder.itemIds
                .map((id) => selectableAgentById.get(id))
                .filter((agent): agent is AgentConfigRow => Boolean(agent))
                .filter((agent) => matchesAgentFilters(getAgentFilterData(agent))),
              sort,
              (agent) => agent.name,
              (agent) => agent.createdAt || agent.updatedAt,
            );
            if (agentFilterActive && folderAgents.length === 0) return null;
            const isExpanded = (agentFilterActive && folderAgents.length > 0) || expandedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                data-agent-folder-id={folder.id}
                onDragOver={(event) => {
                  if (draggedAgentId) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const payload = event.dataTransfer.getData("application/x-marinara-agent-ids");
                  handleAgentDrop(folder.id, payload ? (JSON.parse(payload) as string[]) : undefined);
                }}
                className="flex flex-col rounded-lg transition-colors"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={localizeUi("ui.panels.agentspanel.value1FolderValue2DoubleTapOrPressF2To", {
                    value1: isExpanded
                      ? localizeUi("ui.panels.ttsconfigcard.collapse")
                      : localizeUi("ui.panels.ttsconfigcard.expand"),
                    value2: folder.name,
                  })}
                  title={localizeUi("ui.panels.backgroundpicker.doubleClickDoubleTapOrPressF2ToRename")}
                  className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40 max-md:pr-12 [@media(pointer:coarse)]:pr-12"
                  onClick={(event) =>
                    handleFolderRenameGesture(folder.id, event, {
                      onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                      onRename: () => {
                        setEditingFolderId(folder.id);
                        setEditFolderName(folder.name);
                      },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    handleFolderRenameKeyDown(event, {
                      onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                      onRename: () => {
                        setEditingFolderId(folder.id);
                        setEditFolderName(folder.name);
                      },
                    });
                  }}
                >
                  <ChevronRight
                    size="0.75rem"
                    className={cn(
                      "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
                      isExpanded && "rotate-90",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editFolderName}
                        onChange={(event) => setEditFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") {
                            setEditingFolderId(null);
                            setEditFolderName("");
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => handleRenameFolder(folder.id)}
                        className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-[var(--border)]"
                      />
                    ) : (
                      <div className="truncate text-xs font-medium text-[var(--muted-foreground)]">{folder.name}</div>
                    )}
                  </div>
                  {(agentFilterActive ? folderAgents.length : folder.itemIds.length) > 0 && (
                    <span
                      data-folder-item-count="inline"
                      className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)] max-md:hidden [@media(pointer:coarse)]:hidden"
                    >
                      {agentFilterActive ? folderAgents.length : folder.itemIds.length}
                    </span>
                  )}
                  <div
                    data-folder-actions
                    className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100 group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto max-md:[&_button]:pointer-events-auto [@media(pointer:coarse)]:[&_button]:pointer-events-auto"
                  >
                    {(agentFilterActive ? folderAgents.length : folder.itemIds.length) > 0 && (
                      <span
                        data-folder-item-count="actions"
                        className="hidden px-1 text-[0.5625rem] text-[var(--muted-foreground)] max-md:inline [@media(pointer:coarse)]:inline"
                      >
                        {agentFilterActive ? folderAgents.length : folder.itemIds.length}
                      </span>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void confirmNonEmptyFolderDelete(folder.itemIds.length, {
                          title: "Delete Folder",
                          message: `Delete "${folder.name}"? Its ${folder.itemIds.length} agent${
                            folder.itemIds.length === 1 ? "" : "s"
                          } will move out of the folder.`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        }).then((ok) => {
                          if (!ok) return;
                          deleteAgentFolder.mutate(folder.id);
                          if (expandedFolderId === folder.id) setExpandedFolderId(null);
                        });
                      }}
                      className="mari-chrome-control mari-chrome-control--small p-1"
                      title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
                    >
                      <Trash2 size="0.6875rem" />
                    </button>
                  </div>
                </div>
                <SmoothFolderContent
                  open={isExpanded}
                  className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                  innerClassName="flex flex-col gap-0.5"
                >
                  {folderAgents.length === 0 ? (
                    <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">
                      {localizeUi("ui.panels.agentspanel.dropAgentsHere")}
                    </p>
                  ) : (
                    folderAgents.map((agent) => renderFolderAgentCard(agent))
                  )}
                </SmoothFolderContent>
              </div>
            );
          })}
        </div>
      )}

      {hasInstalledAgents &&
        agentCategorySections.map((section) => {
          const visibleAgents = sortBasicPanelItems(
            visibleBuiltInDisplayAgents.filter(
              (agent) =>
                !folderedAgentIds.has(agent.id) &&
                agent.category === section.category &&
                matchesAgentFilters({ ...agent, type: agent.id }),
            ),
            sort,
            (agent) => agent.name,
            (agent) => agent.createdAt || agent.updatedAt,
          );
          if (visibleAgents.length === 0 && agentFilterActive) return null;
          return (
            <PanelSection key={section.category} title={section.title} icon={section.icon}>
              {visibleAgents.length === 0 ? (
                <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">{section.emptyMessage}</p>
              ) : (
                visibleAgents.map((agent) => {
                  const sourceAgent = createBuiltInAgentConfigRow(agent, configByType.get(agent.id));
                  return renderAgentCard({
                    localizeUi,
                    id: agent.id,
                    type: agent.id,
                    name: agent.name,
                    description: agent.description,
                    category: agent.category,
                    imagePath: sourceAgent.imagePath || catalogArtworkByAgentId.get(agent.id) || null,
                    custom: false,
                    openAgentDetail,
                    onDuplicate: () => void handleDuplicateAgent(sourceAgent),
                    onImagePick: () => handlePickAgentImage(agent.id),
                    selectionMode,
                    selected: selectedAgentIds.has(agent.id),
                    onToggleSelected: () => toggleAgentSelection(agent.id),
                    isDragging: draggedAgentId === agent.id,
                    onDragStart: (event) => {
                      const ids = getDraggedAgentIds(agent.id);
                      const agentTypes = getDraggedAgentTypes(agent.id);
                      setDraggedAgentId(agent.id);
                      event.dataTransfer.effectAllowed = "copyMove";
                      event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
                      event.dataTransfer.setData("text/plain", agent.id);
                      writeChatResourceDragPayload(event.dataTransfer, {
                        version: 1,
                        kind: "agent",
                        ids: agentTypes,
                        label:
                          ids.length === 1
                            ? agent.name
                            : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", { count: ids.length }),
                      });
                    },
                    onDragEnd: () => {
                      setDraggedAgentId(null);
                      clearActiveChatResourceDrag();
                    },
                    onTouchStart: (event) =>
                      startAgentTouchDrag(event, agent.id, {
                        allowInteractiveTarget: true,
                        sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="agent"]'),
                        chatResourcePayload: {
                          version: 1,
                          kind: "agent",
                          ids: getDraggedAgentTypes(agent.id),
                          label:
                            getDraggedAgentIds(agent.id).length === 1
                              ? agent.name
                              : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", {
                                  count: getDraggedAgentIds(agent.id).length,
                                }),
                        },
                      }),
                    nativeDragEnabled: nativeAgentDragEnabled,
                    touchSafeDragMode: touchSafeAgentDragMode,
                    suppressClickRef: suppressAgentClickRef,
                    onDelete: capabilityAgentRegistryReady ? () => void confirmAndRemoveAgent(sourceAgent) : undefined,
                  });
                })
              )}
            </PanelSection>
          );
        })}

      {hasInstalledAgents && (visibleCustomAgents.length > 0 || !agentFilterActive) && (
        <PanelSection title={localizeUi("ui.panels.agentspanel.customAgents")} icon={<Sparkles size="0.8125rem" />}>
          {visibleCustomAgents.length === 0 ? (
            <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">
              {localizeUi("ui.panels.agentspanel.noCustomAgentsYet")}
            </p>
          ) : (
            visibleCustomAgents.map((agent) =>
              renderAgentCard({
                localizeUi,
                id: agent.id,
                type: agent.type,
                name: agent.name,
                description: agent.description,
                category: "custom",
                imagePath: agent.imagePath ?? null,
                custom: true,
                openAgentDetail,
                onDuplicate: () => void handleDuplicateAgent(agent),
                onImagePick: () => handlePickAgentImage(agent.id),
                selectionMode,
                selected: selectedAgentIds.has(agent.id),
                onToggleSelected: () => toggleAgentSelection(agent.id),
                isDragging: draggedAgentId === agent.id,
                onDragStart: (event) => {
                  const ids = getDraggedAgentIds(agent.id);
                  const agentTypes = getDraggedAgentTypes(agent.id);
                  setDraggedAgentId(agent.id);
                  event.dataTransfer.effectAllowed = "copyMove";
                  event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
                  event.dataTransfer.setData("text/plain", agent.id);
                  writeChatResourceDragPayload(event.dataTransfer, {
                    version: 1,
                    kind: "agent",
                    ids: agentTypes,
                    label:
                      ids.length === 1
                        ? agent.name
                        : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", { count: ids.length }),
                  });
                },
                onDragEnd: () => {
                  setDraggedAgentId(null);
                  clearActiveChatResourceDrag();
                },
                onTouchStart: (event) =>
                  startAgentTouchDrag(event, agent.id, {
                    allowInteractiveTarget: true,
                    sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="agent"]'),
                    chatResourcePayload: {
                      version: 1,
                      kind: "agent",
                      ids: getDraggedAgentTypes(agent.id),
                      label:
                        getDraggedAgentIds(agent.id).length === 1
                          ? agent.name
                          : localizeUi("ui.chat.chatresourcedropoverlay.agentCount", {
                              count: getDraggedAgentIds(agent.id).length,
                            }),
                    },
                  }),
                nativeDragEnabled: nativeAgentDragEnabled,
                touchSafeDragMode: touchSafeAgentDragMode,
                suppressClickRef: suppressAgentClickRef,
                onDelete: capabilityAgentRegistryReady ? () => void confirmAndRemoveAgent(agent) : undefined,
              }),
            )
          )}
        </PanelSection>
      )}

      {visibleRulesets.length > 0 && (
        <PanelSection title={localizeUi("ui.panels.agentspanel.rules")} icon={<Dices size="0.8125rem" />}>
          {visibleRulesets.map(({ definition, packageId, source, versions }) => {
            // An imported ruleset says where it came from and which versions are stored, because
            // removing it takes every one of them and a game plays on the exact version it pinned.
            const repository = source ? rulesetRepositoryLabel(source) : null;
            return (
              <div
                key={definition.id}
                className="group relative flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)]">
                  <Dices size="1rem" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{definition.name}</div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)] line-clamp-2">
                    {definition.coverage.summary}
                  </div>
                  <div className="mt-1 text-[0.5625rem] uppercase text-[var(--muted-foreground)]/80">
                    {source
                      ? localizeUi("game.ruleset.panel.importedVersions", {
                          source: repository ?? localizeUi("game.ruleset.panel.importedFile"),
                          versions: (versions ?? [definition.version]).join(", "),
                        })
                      : localizeUi("ui.panels.agentspanel.rulesetVersion", { version: definition.version })}
                  </div>
                </div>
                {source ? (
                  <button
                    className="mari-chrome-control mari-chrome-control--small shrink-0 p-1.5"
                    title={localizeUi("game.ruleset.remove.confirm")}
                    aria-label={localizeUi("game.ruleset.remove.label", { name: definition.name })}
                    onClick={() => void confirmAndRemoveRuleset(definition.id, definition.name)}
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                ) : (
                  packageId && (
                    <button
                      className="mari-chrome-control mari-chrome-control--small shrink-0 p-1.5"
                      title={localizeUi("ui.agents.agentcatalogview.uninstall")}
                      aria-label={localizeUi("ui.panels.agentspanel.uninstallRuleset", { name: definition.name })}
                      onClick={() => void confirmAndUninstallRuleset(packageId, definition.name)}
                    >
                      <Trash2 size="0.75rem" />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </PanelSection>
      )}

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedAgents.length}
          onExport={() => void handleExportSelectedAgents()}
          onDelete={handleDeleteSelectedAgents}
          deleteDisabled={!capabilityAgentRegistryReady}
          exporting={exportingSelected}
        />
      )}

      <Modal
        open={pendingAgentImport !== null}
        onClose={() => {
          if (!importAgent.isPending) setPendingAgentImport(null);
        }}
        title={localizeUi("settings.agentImports.review.title")}
        width="max-w-2xl"
        mobileFullscreen
        closeDisabled={importAgent.isPending}
      >
        {pendingAgentImport && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-3 text-sm leading-6">
              <TriangleAlert
                className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-highlight-text)]"
                size="1rem"
              />
              <p className="text-[var(--muted-foreground)]">{localizeUi("settings.agentImports.review.description")}</p>
            </div>

            {pendingAgentImport.skippedFunctionCount > 0 && (
              <div className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]">
                {localizeUi("settings.agentImports.review.functionsSkipped", {
                  count: pendingAgentImport.skippedFunctionCount,
                })}
              </div>
            )}

            <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
              {pendingAgentImport.agents.map((candidate) => {
                const requestedCapabilities = candidate.requestedCapabilities;
                const selectedCapabilities = new Set(approvedImportCapabilities[candidate.type] ?? []);
                return (
                  <section
                    key={candidate.type}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{candidate.name}</h3>
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          {candidate.description || localizeUi("ui.panels.agentcard.noDescription")}
                        </p>
                      </div>
                      <span className="mari-chrome-tag shrink-0 bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)]">
                        {candidate.phase}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold">{localizeUi("settings.agentImports.review.permissions")}</p>
                      {requestedCapabilities.length === 0 ? (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {localizeUi("settings.agentImports.review.noPermissions")}
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {requestedCapabilities.map((capability) => {
                            const checked = selectedCapabilities.has(capability);
                            return (
                              <label
                                key={capability}
                                className={cn(
                                  "flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1 transition-colors",
                                  checked
                                    ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
                                    : "bg-[var(--secondary)]/35 ring-[var(--border)]",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={importAgent.isPending}
                                  onChange={() => toggleApprovedImportCapability(candidate.type, capability)}
                                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                                />
                                <span>
                                  <span className="block text-xs font-medium">
                                    {localizeUi(`settings.agentImports.capabilities.${capability}.label`)}
                                  </span>
                                  <span className="block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                                    {localizeUi(`settings.agentImports.capabilities.${capability}.description`)}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("settings.agentImports.review.deniedPermissions")}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={importAgent.isPending}
                onClick={() => setPendingAgentImport(null)}
                className="mari-chrome-control h-10 px-4 text-sm"
              >
                {localizeUi("chat.delete.dialog.cancel")}
              </button>
              <button
                type="button"
                disabled={importAgent.isPending}
                onClick={() => void handleApproveAgentImport()}
                className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
              >
                <ShieldCheck size="0.9rem" />
                {localizeUi("settings.agentImports.review.approve")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <RulesetImportReviewModal
        definition={pendingRulesetImport?.definition ?? null}
        rulesetId={pendingRulesetImport?.rulesetId ?? ""}
        installedVersions={
          installedRulesets.find((entry) => entry.definition.id === pendingRulesetImport?.rulesetId)?.versions ?? []
        }
        importing={importRuleset.isPending}
        failure={rulesetImportFailure}
        onCancel={() => setPendingRulesetImport(null)}
        onConfirm={() => void handleConfirmRulesetImport()}
      />
    </div>
  );
}

function renderAgentCard({
  localizeUi,
  id,
  type,
  name,
  description,
  category,
  imagePath,
  custom,
  openAgentDetail,
  onDuplicate,
  onImagePick,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onTouchStart,
  nativeDragEnabled = true,
  touchSafeDragMode = false,
  suppressClickRef,
}: {
  localizeUi: TFunction;
  id: string;
  type: string;
  name: string;
  description: string;
  category: AgentCategory | "custom";
  imagePath?: string | null;
  custom: boolean;
  openAgentDetail: (id: string) => void;
  onDuplicate: () => void;
  onImagePick: () => void;
  onDelete?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  isDragging?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onTouchStart?: (event: React.TouchEvent<HTMLButtonElement>) => void;
  nativeDragEnabled?: boolean;
  touchSafeDragMode?: boolean;
  suppressClickRef?: { current: boolean };
}) {
  const iconClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm",
    AGENT_GRADIENT_SURFACE,
  );

  return (
    <div
      key={id}
      data-agent-card
      data-touch-drag-card="agent"
      data-agent-name={name}
      draggable={nativeDragEnabled}
      onContextMenu={(event) => {
        if (!touchSafeDragMode) return;
        event.preventDefault();
      }}
      onDragStart={(event) => {
        if (!nativeDragEnabled) {
          event.preventDefault();
          return;
        }
        onDragStart?.(event);
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (suppressClickRef?.current) return;
        if (selectionMode && onToggleSelected) onToggleSelected();
      }}
      className={cn(
        "group relative flex touch-pan-y cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]",
        selectionMode &&
          selected &&
          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
        isDragging && "opacity-50",
        touchSafeDragMode && "select-none",
      )}
    >
      {onTouchStart && (
        <TouchDragHandle label={localizeUi("ui.panels.agentcard.dragAgent")} onTouchStart={onTouchStart} />
      )}
      {selectionMode && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            selected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
        >
          {selected && <Check size="0.75rem" />}
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef?.current) return;
          if (selectionMode && onToggleSelected) {
            onToggleSelected();
            return;
          }
          onImagePick();
        }}
        className={cn(
          iconClasses,
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50",
        )}
        title={
          selectionMode
            ? localizeUi("ui.panels.agentcard.selectAgent")
            : imagePath
              ? localizeUi("ui.panels.agentcard.replacePicture")
              : localizeUi("ui.panels.agentcard.uploadPicture")
        }
        aria-label={
          selectionMode
            ? localizeUi("ui.panels.agentcard.selectAgent")
            : imagePath
              ? localizeUi("ui.panels.agentcard.replacePicture")
              : localizeUi("ui.panels.agentcard.uploadPicture")
        }
      >
        <AgentArtwork imageUrl={imagePath} alt="" iconSize="1rem" />
        {!selectionMode && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        )}
      </button>
      <button
        className={cn(
          "min-w-0 flex-1 text-left",
          !selectionMode &&
            (onDelete
              ? "pr-0 max-md:pr-24 [@media(pointer:coarse)]:pr-24"
              : "pr-0 max-md:pr-16 [@media(pointer:coarse)]:pr-16"),
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef?.current) return;
          if (selectionMode && onToggleSelected) {
            onToggleSelected();
            return;
          }
          openAgentDetail(custom ? id : type);
        }}
      >
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)] line-clamp-2">
          {description || localizeUi("ui.panels.agentcard.noDescription")}
        </div>
        <div className="mt-1 text-[0.5625rem] uppercase text-[var(--muted-foreground)]/80">
          {custom ? localizeUi("ui.panels.agentcard.custom") : category}
        </div>
      </button>
      {!selectionMode && (
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100 group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto max-md:[&_button]:pointer-events-auto [@media(pointer:coarse)]:[&_button]:pointer-events-auto">
          <ChatResourceActionButton payload={{ version: 1, kind: "agent", ids: [type], label: name }} />
          <button
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title={localizeUi("ui.panels.agentcard.copyAgent")}
            aria-label={localizeUi("ui.panels.agentcard.copyAgent")}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy size="0.75rem" />
          </button>
          {onDelete && (
            <button
              className="mari-chrome-control mari-chrome-control--small p-1.5"
              title={localizeUi("ui.panels.agentcard.deleteAgent")}
              aria-label={localizeUi("ui.panels.agentcard.deleteAgent")}
              onClick={(event) => {
                event.stopPropagation();
                void onDelete();
              }}
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Collapsible section ──
function PanelSection({
  title,
  icon,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-1 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
        >
          <ChevronDown
            size="0.75rem"
            className={cn("text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
          />
          <span className="text-[var(--muted-foreground)]">{icon}</span>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-1 flex flex-col gap-1">{children}</div>}
    </div>
  );
}
