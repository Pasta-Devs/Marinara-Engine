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
  FolderOpen,
  ArrowUpDown,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore, type ResourcePanelSort } from "../../stores/ui.store";
import {
  useAgentConfigs,
  useCreateAgent,
  useDeleteAgent,
  useUploadAgentImage,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import { useCreateCustomTool, useCustomTools, type CustomToolRow } from "../../hooks/use-custom-tools";
import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultBuiltInAgentSettings,
  getFolderImportEntries,
  getFolderManifestConfig,
  isAgentConfigDeleted,
  isRetiredBuiltInAgentId,
  normalizeAgentPhaseForType,
  normalizeAgentPhaseValue,
  type AgentCategory,
} from "@marinara-engine/shared";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { sortBasicPanelItems } from "../../lib/panel-sort";
import { downloadZipFile } from "../../lib/download-zip";
import {
  createAgentFolderPackageFilename,
  createAgentFolderPackageFiles,
  sanitizeAgentSettingsForTransfer,
  type AgentTransferConfig,
} from "../../lib/agent-transfer";
import {
  importCustomToolEntries,
  serializeCustomToolForTransfer,
} from "../../lib/custom-tool-transfer";
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

type JsonRecord = Record<string, unknown>;
const BUILT_IN_AGENT_TYPE_SET = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));
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

function normalizeAgentImportEntry(entry: unknown, resolveTextFile?: (path: unknown) => string | null) {
  const source = getFolderManifestConfig(entry);
  if (!isJsonRecord(source)) return null;

  const type = typeof source.type === "string" ? source.type.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = typeof source.description === "string" ? source.description : "";
  if (!type || !name) return null;
  const phase = normalizeAgentPhaseForType(type, normalizeAgentPhaseValue(source.phase));

  const settingsText = resolveTextFile?.(source.settingsPath);
  const settings = sanitizeAgentSettingsForTransfer(parseAgentSettings(settingsText ?? source.settings));
  if (typeof source.author === "string" && !settings.author) {
    settings.author = source.author;
  }
  if (Array.isArray(source.promptTemplates) && settings.promptTemplates === undefined) {
    settings.promptTemplates = source.promptTemplates;
  }
  if (typeof settings.author !== "string" || !settings.author.trim()) {
    settings.author = "Unknown";
  }
  const resultType = typeof source.resultType === "string" ? source.resultType : settings.resultType;

  return {
    type,
    name,
    description,
    phase,
    enabled: true,
    connectionId: null,
    imagePath: null,
    promptTemplate:
      resolveTextFile?.(source.promptTemplatePath) ?? (typeof source.promptTemplate === "string" ? source.promptTemplate : ""),
    settings,
    ...(typeof resultType === "string" ? { resultType } : {}),
  };
}

function getReferencedCustomTools(agents: AgentConfigRow[], customTools: CustomToolRow[]) {
  if (agents.length === 0 || customTools.length === 0) return [];
  const referencedNames = new Set<string>();
  for (const agent of agents) {
    const enabledTools = parseAgentSettings(agent.settings).enabledTools;
    if (!Array.isArray(enabledTools)) continue;
    for (const tool of enabledTools) {
      if (typeof tool === "string" && tool.trim()) referencedNames.add(tool);
    }
  }
  return customTools.filter((tool) => referencedNames.has(tool.name));
}

export function AgentsPanel() {
  const { data: agentConfigs, isLoading } = useAgentConfigs();
  const { data: customTools } = useCustomTools();
  const createAgent = useCreateAgent();
  const createCustomTool = useCreateCustomTool();
  const deleteAgent = useDeleteAgent();
  const uploadAgentImage = useUploadAgentImage();
  const { data: agentFolders = [] } = useLibraryFolders("agents");
  const createAgentFolder = useCreateLibraryFolder("agents");
  const updateAgentFolder = useUpdateLibraryFolder("agents");
  const deleteAgentFolder = useDeleteLibraryFolder("agents");
  const moveAgentItem = useMoveLibraryItem("agents");
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const sort = useUIStore((s) => s.agentPanelSort);
  const setSort = useUIStore((s) => s.setAgentPanelSort);
  const [agentSearch, setAgentSearch] = useState("");
  const agentImageInputRef = useRef<HTMLInputElement>(null);
  const agentImportInputRef = useRef<HTMLInputElement>(null);
  const agentFolderImportInputRef = useRef<HTMLInputElement>(null);
  const imageTargetAgentIdRef = useRef<string | null>(null);
  const [agentImportError, setAgentImportError] = useState<string | null>(null);
  const [agentImportSuccess, setAgentImportSuccess] = useState<string | null>(null);
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

  const agentConfigRows = useMemo(() => (agentConfigs ?? []) as AgentConfigRow[], [agentConfigs]);
  const customToolRows = useMemo(() => (customTools ?? []) as CustomToolRow[], [customTools]);
  const visibleAgentConfigs = useMemo(
    () => agentConfigRows.filter((config) => !isAgentConfigDeleted(config.settings)),
    [agentConfigRows],
  );
  const deletedBuiltInTypes = useMemo(
    () =>
      new Set(
        agentConfigRows
          .filter((config) => BUILT_IN_AGENT_TYPE_SET.has(config.type))
          .filter((config) => isAgentConfigDeleted(config.settings))
          .map((config) => config.type),
      ),
    [agentConfigRows],
  );
  const visibleBuiltInAgents = useMemo(
    () => BUILT_IN_AGENTS.filter((agent) => !agent.libraryHidden && !deletedBuiltInTypes.has(agent.id)),
    [deletedBuiltInTypes],
  );
  // Custom agents = DB entries whose type doesn't match any built-in
  const customAgents = useMemo(
    () =>
      visibleAgentConfigs.filter(
        (config) => !BUILT_IN_AGENT_TYPE_SET.has(config.type) && !isRetiredBuiltInAgentId(config.type),
      ),
    [visibleAgentConfigs],
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
  const matchesAgentSearch = (agent: { name: string; description: string; category: string }) =>
    !agentSearchQuery ||
    agent.name.toLowerCase().includes(agentSearchQuery) ||
    agent.description.toLowerCase().includes(agentSearchQuery) ||
    agent.category.toLowerCase().includes(agentSearchQuery);
  const getAgentSearchData = (agent: AgentConfigRow) => ({
    name: agent.name,
    description: agent.description,
    category: BUILT_IN_AGENT_TYPE_SET.has(agent.type)
      ? (BUILT_IN_AGENTS.find((entry) => entry.id === agent.type)?.category ?? "misc")
      : "custom",
  });
  const agentCategorySections: Array<{ category: AgentCategory; title: string; icon: ReactNode }> = [
    { category: "writer", title: "Writer Agents", icon: <PenLine size="0.8125rem" /> },
    { category: "tracker", title: "Tracker Agents", icon: <Radar size="0.8125rem" /> },
    { category: "misc", title: "Misc Agents", icon: <Puzzle size="0.8125rem" /> },
  ];
  const visibleCustomAgents = sortBasicPanelItems(
    customAgents.filter(
      (agent) =>
        !folderedAgentIds.has(agent.id) &&
        matchesAgentSearch({
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
      return agent ? matchesAgentSearch(getAgentSearchData(agent)) : false;
    }),
  );
  const hasVisibleAgents =
    agentCategorySections.some((section) =>
      visibleBuiltInDisplayAgents.some(
        (agent) => !folderedAgentIds.has(agent.id) && agent.category === section.category && matchesAgentSearch(agent),
      ),
    ) ||
    visibleCustomAgents.length > 0 ||
    hasVisibleFolderAgents;
  const selectedAgents = useMemo(
    () => selectableAgents.filter((agent) => selectedAgentIds.has(agent.id)),
    [selectableAgents, selectedAgentIds],
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

  const handleExportSelectedAgents = useCallback(async () => {
    if (selectedAgents.length === 0) {
      toast.error("Select at least one agent to export");
      return;
    }

    setExportingSelected(true);
    try {
      const files = createAgentFolderPackageFiles(selectedAgents.map(serializeAgentConfig), {
        customTools: getReferencedCustomTools(selectedAgents, customToolRows).map(serializeCustomToolForTransfer),
      });
      const firstAgent = selectedAgents[0];
      const filename =
        selectedAgents.length === 1 && firstAgent
          ? createAgentFolderPackageFilename(getAgentLibraryDisplayName(firstAgent), "agent")
          : "marinara-agents.zip";
      downloadZipFile(files, filename);
      toast.success(`Exported ${selectedAgents.length} agent${selectedAgents.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export agents");
    } finally {
      setExportingSelected(false);
    }
  }, [customToolRows, selectedAgents]);

  const handleDuplicateAgent = useCallback(
    async (agent: AgentConfigRow) => {
      try {
        const created = await createAgent.mutateAsync(createDuplicateAgentInput(agent));
        const createdId = typeof created === "object" && created && "id" in created ? String(created.id) : null;
        toast.success(`Copied "${getAgentLibraryDisplayName(agent)}"`);
        if (createdId) openAgentDetail(createdId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to copy agent");
      }
    },
    [createAgent, openAgentDetail],
  );

  const handleDeleteSelectedAgents = useCallback(async () => {
    const ids = selectedAgents.map((agent) => agent.id);
    if (ids.length === 0) return;
    const agentNoun = ids.length === 1 ? "agent" : "agents";
    const deleteMessage =
      `Delete ${ids.length} selected ${agentNoun}? ` + "Basic agents will be hidden from the library and pickers.";

    if (
      !(await showConfirmDialog({
        title: "Delete Agents",
        message: deleteMessage,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deleteAgent.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} agent${deletedCount === 1 ? "" : "s"}`);
    }
    if (failedIds.length > 0) {
      setSelectedAgentIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} agent${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [deleteAgent, exitSelectionMode, selectedAgents]);

  const importAgentEntries = useCallback(
    async (entries: FolderPackageImportEntry[], functionEntries: FolderPackageImportEntry[] = []) => {
      if (entries.length === 0) throw new Error("No agents found in file");

      let imported = 0;
      const failed: string[] = [];
      let importedFunctions = 0;
      if (functionEntries.length > 0) {
        const result = await importCustomToolEntries(functionEntries, createCustomTool);
        importedFunctions = result.imported;
        failed.push(...result.failed);
      }
      for (const entry of entries) {
        const normalized = normalizeAgentImportEntry(entry.raw, entry.resolveTextFile);
        if (!normalized) continue;
        try {
          await createAgent.mutateAsync(normalized);
          imported++;
        } catch (error) {
          failed.push(error instanceof Error ? error.message : `Failed to import ${normalized.name}`);
        }
      }

      if (imported === 0 && failed.length === 0) {
        throw new Error("No valid agents found in file");
      }
      if (imported > 0) {
        setAgentImportSuccess(
          `Imported ${imported} agent${imported === 1 ? "" : "s"}${
            importedFunctions > 0 ? ` and ${importedFunctions} function${importedFunctions === 1 ? "" : "s"}` : ""
          }.`,
        );
      }
      if (failed.length > 0) {
        setAgentImportError(`${failed.length} import item${failed.length === 1 ? "" : "s"} failed. ${failed[0]}`);
      }
    },
    [createAgent, createCustomTool],
  );

  const handleImportAgents = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const entries = isZipFile(file)
          ? await (async () => {
              const files = await readTextFilesFromZip(file);
              return {
                agents: collectFolderPackageEntries(files, {
                  rootFilenames: ["marinara-agents.json", "marinara-agent.json"],
                  collectionKeys: ["agents"],
                }),
                functions: collectFolderPackageEntries(files, {
                  rootFilenames: ["marinara-agents.json", "marinara-agent.json", "marinara-functions.json"],
                  collectionKeys: ["functions", "customTools", "tools"],
                }),
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
                functions: getFolderImportEntries(parsed, ["functions", "customTools", "tools"]).map(
                  (raw): FolderPackageImportEntry => ({
                    raw,
                    path: file.name,
                    basePath: "",
                    resolveTextFile: () => null,
                  }),
                ),
              };
            })();
        await importAgentEntries(entries.agents, entries.functions);
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }

      event.target.value = "";
    },
    [importAgentEntries],
  );

  const handleImportAgentFolder = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
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
        await importAgentEntries(entries, functionEntries);
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }
      event.target.value = "";
    },
    [importAgentEntries],
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
      const builtInMeta = BUILT_IN_AGENTS.find((entry) => entry.id === agent.type);
      const custom = !builtInMeta;
      const category = custom ? "custom" : builtInMeta.category;
      return renderAgentCard({
        id: agent.id,
        type: agent.type,
        name: getAgentLibraryDisplayName(agent),
        description: agent.description,
        category,
        imagePath: agent.imagePath ?? null,
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
          setDraggedAgentId(agent.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
          event.dataTransfer.setData("text/plain", agent.id);
        },
        onDragEnd: () => setDraggedAgentId(null),
        nativeDragEnabled: nativeAgentDragEnabled,
        touchSafeDragMode: touchSafeAgentDragMode,
        suppressClickRef: suppressAgentClickRef,
        onDelete: async () => {
          const deleteMessage = custom
            ? `Delete "${agent.name}"?`
            : `Delete "${agent.name}"? This basic agent will be hidden from the library and pickers.`;
          if (
            await showConfirmDialog({
              title: "Delete Agent",
              message: deleteMessage,
              confirmLabel: "Delete",
              tone: "destructive",
            })
          ) {
            deleteAgent.mutate(custom ? agent.id : agent.type);
          }
        },
      });
    },
    [
      deleteAgent,
      draggedAgentId,
      getDraggedAgentIds,
      handlePickAgentImage,
      handleDuplicateAgent,
      nativeAgentDragEnabled,
      openAgentDetail,
      selectedAgentIds,
      selectionMode,
      touchSafeAgentDragMode,
      toggleAgentSelection,
    ],
  );

  const handleAgentImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const agentId = imageTargetAgentIdRef.current;
      if (!file || !agentId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetAgentIdRef.current = null;
        toast.error("Choose an image file for the agent picture");
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error("Could not read that image");
          return;
        }

        try {
          await uploadAgentImage.mutateAsync({ id: agentId, image });
          toast.success("Agent picture updated");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to upload agent picture");
        } finally {
          imageTargetAgentIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetAgentIdRef.current = null;
        toast.error("Could not read that image");
      };
      reader.readAsDataURL(file);
    },
    [uploadAgentImage],
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

      <div className="flex gap-2">
        <button onClick={handleCreateAgent} className={cn("flex-1 text-xs", AGENT_GRADIENT_BUTTON)} title="New">
          <Plus size="0.8125rem" />
        </button>
        <button
          onClick={() => agentImportInputRef.current?.click()}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title="Import agents"
        >
          <Download size="0.8125rem" />
        </button>
        <button
          onClick={() => agentFolderImportInputRef.current?.click()}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title="Import agent folder"
        >
          <FolderOpen size="0.8125rem" />
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
          title="Select agents"
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      {agentImportError && (
        <div className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">{agentImportError}</div>
      )}
      {agentImportSuccess && (
        <div className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">{agentImportSuccess}</div>
      )}

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            value={agentSearch}
            onChange={(event) => setAgentSearch(event.target.value)}
            placeholder="Search agents"
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ResourcePanelSort)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
            aria-label="Sort agents"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ArrowUpDown
            size="0.625rem"
            className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      {isLoading && <div className="mari-chrome-text-muted py-4 text-center text-xs">Loading...</div>}

      {!hasVisibleAgents && (
        <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">No agents match your search.</p>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateFolder}
            className="mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]"
          >
            <FolderPlus size="0.75rem" />
            New Folder
          </button>
        </div>
        {agentFolders.length > 0 && <p className="mari-folder-helper">Drag and drop agents to folders, double-click or double-tap to rename</p>}
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
            Drop here to move out of folder
          </div>
        )}
        {agentFolders.map((folder) => {
          const isEditing = editingFolderId === folder.id;
          const folderAgents = sortBasicPanelItems(
            folder.itemIds
              .map((id) => selectableAgentById.get(id))
              .filter((agent): agent is AgentConfigRow => Boolean(agent))
              .filter((agent) => matchesAgentSearch(getAgentSearchData(agent))),
            sort,
            (agent) => agent.name,
            (agent) => agent.createdAt || agent.updatedAt,
          );
          if (agentSearchActive && folderAgents.length === 0) return null;
          const isExpanded = (agentSearchActive && folderAgents.length > 0) || expandedFolderId === folder.id;
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
                aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}. Double-tap or press F2 to rename.`}
                title="Double-click, double-tap, or press F2 to rename."
                className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
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
                {(agentSearchActive ? folderAgents.length : folder.itemIds.length) > 0 && (
                  <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {agentSearchActive ? folderAgents.length : folder.itemIds.length}
                  </span>
                )}
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
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
                    title="Delete folder"
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
                  <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">Drop agents here.</p>
                ) : (
                  folderAgents.map((agent) => renderFolderAgentCard(agent))
                )}
              </SmoothFolderContent>
            </div>
          );
        })}
      </div>

      {agentCategorySections.map((section) => {
        const visibleAgents = sortBasicPanelItems(
          visibleBuiltInDisplayAgents.filter(
            (agent) =>
              !folderedAgentIds.has(agent.id) && agent.category === section.category && matchesAgentSearch(agent),
          ),
          sort,
          (agent) => agent.name,
          (agent) => agent.createdAt || agent.updatedAt,
        );
        if (visibleAgents.length === 0 && agentSearchQuery) return null;
        return (
          <PanelSection key={section.category} title={section.title} icon={section.icon}>
            {visibleAgents.length === 0 ? (
              <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">
                No {section.title.toLowerCase()} yet.
              </p>
            ) : (
              visibleAgents.map((agent) => {
                const sourceAgent = createBuiltInAgentConfigRow(agent, configByType.get(agent.id));
                return renderAgentCard({
                  id: agent.id,
                  type: agent.id,
                  name: agent.name,
                  description: agent.description,
                  category: agent.category,
                  imagePath: sourceAgent.imagePath,
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
                    setDraggedAgentId(agent.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
                    event.dataTransfer.setData("text/plain", agent.id);
                  },
                  onDragEnd: () => setDraggedAgentId(null),
                  nativeDragEnabled: nativeAgentDragEnabled,
                  touchSafeDragMode: touchSafeAgentDragMode,
                  suppressClickRef: suppressAgentClickRef,
                  onDelete: async () => {
                    const deleteMessage =
                      `Delete "${agent.name}"? ` + "This basic agent will be hidden from the library and pickers.";
                    if (
                      await showConfirmDialog({
                        title: "Delete Agent",
                        message: deleteMessage,
                        confirmLabel: "Delete",
                        tone: "destructive",
                      })
                    ) {
                      deleteAgent.mutate(agent.id);
                    }
                  },
                });
              })
            )}
          </PanelSection>
        );
      })}

      {(visibleCustomAgents.length > 0 || !agentSearchQuery) && (
        <PanelSection title="Custom Agents" icon={<Sparkles size="0.8125rem" />}>
          {visibleCustomAgents.length === 0 ? (
            <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">No custom agents yet</p>
          ) : (
            visibleCustomAgents.map((agent) =>
              renderAgentCard({
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
                  setDraggedAgentId(agent.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-marinara-agent-ids", JSON.stringify(ids));
                  event.dataTransfer.setData("text/plain", agent.id);
                },
                onDragEnd: () => setDraggedAgentId(null),
                nativeDragEnabled: nativeAgentDragEnabled,
                touchSafeDragMode: touchSafeAgentDragMode,
                suppressClickRef: suppressAgentClickRef,
                onDelete: async () => {
                  if (
                    await showConfirmDialog({
                      title: "Delete Agent",
                      message: `Delete "${agent.name}"?`,
                      confirmLabel: "Delete",
                      tone: "destructive",
                    })
                  ) {
                    deleteAgent.mutate(agent.id);
                  }
                },
              }),
            )
          )}
        </PanelSection>
      )}

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedAgents.length}
          onExport={() => void handleExportSelectedAgents()}
          onDelete={handleDeleteSelectedAgents}
          exporting={exportingSelected}
        />
      )}
    </div>
  );
}

function renderAgentCard({
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
  nativeDragEnabled = true,
  touchSafeDragMode = false,
  suppressClickRef,
}: {
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
  nativeDragEnabled?: boolean;
  touchSafeDragMode?: boolean;
  suppressClickRef?: { current: boolean };
}) {
  const iconContent = imagePath ? (
    <img src={imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <Sparkles size="1rem" />
  );
  const iconClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm",
    imagePath ? "bg-[var(--muted)]" : AGENT_GRADIENT_SURFACE,
  );

  return (
    <div
      key={id}
      data-agent-card
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
      {selectionMode && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            selected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
        >
          <Check size="0.75rem" />
        </div>
      )}
      {!selectionMode && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          title="Drag agent"
          className="mari-chrome-accent-text-muted mari-accent-animated flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-0 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing active:scale-95 group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <GripVertical size="0.8125rem" />
        </button>
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
        title={selectionMode ? "Select agent" : imagePath ? "Replace agent picture" : "Upload agent picture"}
        aria-label={selectionMode ? "Select agent" : imagePath ? "Replace agent picture" : "Upload agent picture"}
      >
        {iconContent}
        {!selectionMode && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        )}
      </button>
      <button
        className={cn("min-w-0 flex-1 text-left", !selectionMode && (onDelete ? "pr-16" : "pr-10"))}
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
          {description || "No description"}
        </div>
        <div className="mt-1 text-[0.5625rem] uppercase text-[var(--muted-foreground)]/80">
          {custom ? "custom" : category}
        </div>
      </button>
      {!selectionMode && (
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
          <button
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Copy agent"
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
              title="Delete agent"
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
