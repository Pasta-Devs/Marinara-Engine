// ──────────────────────────────────────────────
// Panel: Agents
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Sparkles,
  Pencil,
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
  Upload,
  Check,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "../../stores/ui.store";
import {
  useAgentConfigs,
  useCreateAgent,
  useDeleteAgent,
  useUploadAgentImage,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  createFolderEntry,
  getDefaultBuiltInAgentSettings,
  getFolderImportEntries,
  getFolderManifestConfig,
  isAgentConfigDeleted,
  type AgentCategory,
} from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { downloadJsonFile } from "../../lib/download-json";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";

type JsonRecord = Record<string, unknown>;
const BUILT_IN_AGENT_TYPE_SET = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseBooleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
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

function serializeAgentConfig(agent: AgentConfigRow) {
  const settings = parseAgentSettings(agent.settings);
  if (typeof settings.author !== "string" || !settings.author.trim()) {
    settings.author = "Unknown";
  }
  const resultType = typeof settings.resultType === "string" ? settings.resultType : undefined;
  return {
    type: agent.type,
    name: agent.name,
    description: agent.description,
    phase: agent.phase,
    enabled: parseBooleanValue(agent.enabled),
    connectionId: null,
    imagePath: null,
    promptTemplate: agent.promptTemplate,
    settings,
    ...(resultType ? { resultType } : {}),
  };
}

function serializeAgentFolderEntry(agent: AgentConfigRow) {
  return createFolderEntry({
    folderName: "Agents",
    itemName: agent.type,
    itemKind: "marinara.agent",
    config: serializeAgentConfig(agent),
    fallbackName: "custom-agent",
  });
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
    phase: config?.phase ?? agent.phase,
    enabled: config?.enabled ?? String(agent.enabledByDefault),
    connectionId: config?.connectionId ?? null,
    imagePath: config?.imagePath ?? null,
    promptTemplate: config?.promptTemplate ?? "",
    settings: config?.settings ?? JSON.stringify(defaultSettings),
    createdAt: config?.createdAt ?? "",
    updatedAt: config?.updatedAt ?? "",
  };
}

function normalizeAgentImportEntry(entry: unknown) {
  const source = getFolderManifestConfig(entry);
  if (!isJsonRecord(source)) return null;

  const type = typeof source.type === "string" ? source.type.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = typeof source.description === "string" ? source.description : "";
  const phase =
    source.phase === "pre_generation" || source.phase === "parallel" || source.phase === "post_processing"
      ? source.phase
      : "post_processing";
  if (!type || !name) return null;

  const settings = parseAgentSettings(source.settings);
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
    enabled: parseBooleanValue(source.enabled),
    connectionId: typeof source.connectionId === "string" ? source.connectionId : null,
    imagePath: null,
    promptTemplate: typeof source.promptTemplate === "string" ? source.promptTemplate : "",
    settings,
    ...(typeof resultType === "string" ? { resultType } : {}),
  };
}

export function AgentsPanel() {
  const { data: agentConfigs, isLoading } = useAgentConfigs();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const uploadAgentImage = useUploadAgentImage();
  const { data: agentFolders = [] } = useLibraryFolders("agents");
  const createAgentFolder = useCreateLibraryFolder("agents");
  const updateAgentFolder = useUpdateLibraryFolder("agents");
  const deleteAgentFolder = useDeleteLibraryFolder("agents");
  const moveAgentItem = useMoveLibraryItem("agents");
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const [agentSearch, setAgentSearch] = useState("");
  const agentImageInputRef = useRef<HTMLInputElement>(null);
  const agentImportInputRef = useRef<HTMLInputElement>(null);
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

  const agentConfigRows = useMemo(() => (agentConfigs ?? []) as AgentConfigRow[], [agentConfigs]);
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
    () => visibleAgentConfigs.filter((config) => !BUILT_IN_AGENT_TYPE_SET.has(config.type)),
    [visibleAgentConfigs],
  );
  const configByType = useMemo(
    () => new Map(visibleAgentConfigs.map((config) => [config.type, config])),
    [visibleAgentConfigs],
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
  const matchesAgentSearch = (agent: { name: string; description: string; category: string }) =>
    !agentSearchQuery ||
    agent.name.toLowerCase().includes(agentSearchQuery) ||
    agent.description.toLowerCase().includes(agentSearchQuery) ||
    agent.category.toLowerCase().includes(agentSearchQuery);
  const agentCategorySections: Array<{ category: AgentCategory; title: string; icon: ReactNode }> = [
    { category: "writer", title: "Writer Agents", icon: <PenLine size="0.8125rem" /> },
    { category: "tracker", title: "Tracker Agents", icon: <Radar size="0.8125rem" /> },
    { category: "misc", title: "Misc Agents", icon: <Puzzle size="0.8125rem" /> },
  ];
  const visibleCustomAgents = customAgents
    .filter(
      (agent) =>
        !folderedAgentIds.has(agent.id) &&
        matchesAgentSearch({
          name: agent.name,
          description: agent.description,
          category: "custom",
        }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleFolderAgentIds = agentFolders.flatMap((folder) => {
    if (folder.id !== expandedFolderId) return [];
    return folder.itemIds.filter((id) => {
      const agent = selectableAgentById.get(id);
      if (!agent) return false;
      return matchesAgentSearch({
        name: agent.name,
        description: agent.description,
        category: BUILT_IN_AGENT_TYPE_SET.has(agent.type)
          ? (BUILT_IN_AGENTS.find((entry) => entry.id === agent.type)?.category ?? "misc")
          : "custom",
      });
    });
  });
  const visibleSelectableAgentIds = [
    ...visibleBuiltInAgents
      .filter((agent) => !folderedAgentIds.has(agent.id) && matchesAgentSearch(agent))
      .map((agent) => agent.id),
    ...visibleCustomAgents.map((agent) => agent.id),
    ...visibleFolderAgentIds,
  ];
  const hasVisibleAgents =
    agentCategorySections.some((section) =>
      visibleBuiltInAgents.some(
        (agent) => !folderedAgentIds.has(agent.id) && agent.category === section.category && matchesAgentSearch(agent),
      ),
    ) ||
    visibleCustomAgents.length > 0 ||
    agentFolders.some((folder) => folder.itemIds.some((id) => selectableAgentById.has(id)));
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
      if (!name) return;
      updateAgentFolder.mutate({ id: folderId, name });
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
      downloadJsonFile(
        {
          kind: "marinara.agent-folder",
          version: 1,
          exportedAt: new Date().toISOString(),
          folderName: "Agents",
          agents: selectedAgents.map(serializeAgentFolderEntry),
        },
        "marinara-agents.json",
      );
      toast.success(`Exported ${selectedAgents.length} agent${selectedAgents.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export agents");
    } finally {
      setExportingSelected(false);
    }
  }, [selectedAgents]);

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

  const handleImportAgents = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const entries = getAgentImportEntries(parsed);
        if (entries.length === 0) throw new Error("No agents found in file");

        let imported = 0;
        const failed: string[] = [];
        for (const entry of entries) {
          const normalized = normalizeAgentImportEntry(entry);
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
          setAgentImportSuccess(`Imported ${imported} agent${imported === 1 ? "" : "s"}.`);
        }
        if (failed.length > 0) {
          setAgentImportError(`${failed.length} agent${failed.length === 1 ? "" : "s"} failed. ${failed[0]}`);
        }
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }

      event.target.value = "";
    },
    [createAgent],
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
        name: agent.name,
        description: agent.description,
        category,
        imagePath: agent.imagePath ?? null,
        custom,
        openAgentDetail,
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
      openAgentDetail,
      selectedAgentIds,
      selectionMode,
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
    <div
      onDragOver={(event) => {
        if (draggedAgentId) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        if (!draggedAgentId) return;
        event.preventDefault();
        const target = event.target as Element | null;
        if (target?.closest("[data-agent-folder-id]")) return;
        const payload = event.dataTransfer.getData("application/x-marinara-agent-ids");
        handleAgentDrop(null, payload ? (JSON.parse(payload) as string[]) : undefined);
      }}
      className="flex flex-col gap-2 p-3"
    >
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
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportAgents}
      />

      <div className="flex gap-2">
        <button
          onClick={handleCreateAgent}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-400 to-purple-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-violet-400/15 transition-all hover:shadow-lg hover:shadow-violet-400/25 active:scale-[0.98]"
          title="New"
        >
          <Plus size="0.8125rem" /> <span className="md:hidden">New</span>
        </button>
        <button
          onClick={handleCreateFolder}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="New folder"
        >
          <FolderPlus size="0.8125rem" /> <span className="md:hidden">Folder</span>
        </button>
        <button
          onClick={() => agentImportInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="Import agents"
        >
          <Download size="0.8125rem" /> <span className="md:hidden">Import</span>
        </button>
        <button
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else setSelectionMode(true);
          }}
          disabled={selectableAgents.length === 0}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
            selectionMode
              ? "bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/30"
              : "bg-[var(--secondary)] text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
          )}
          title="Select agents"
        >
          <Check size="0.8125rem" /> <span className="md:hidden">Select</span>
        </button>
      </div>

      {agentImportError && (
        <div className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">{agentImportError}</div>
      )}
      {agentImportSuccess && (
        <div className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">{agentImportSuccess}</div>
      )}

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {selectedAgents.length} selected
          </span>
          <button
            onClick={() => setSelectedAgentIds(new Set(visibleSelectableAgentIds))}
            disabled={visibleSelectableAgentIds.length === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-violet-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
          >
            Select visible
          </button>
          <button
            onClick={() => setSelectedAgentIds(new Set())}
            disabled={selectedAgents.length === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={handleDeleteSelectedAgents}
            disabled={selectedAgents.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--destructive)]/12 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20 disabled:opacity-40"
          >
            <Trash2 size="0.6875rem" />
            Delete
          </button>
          <button
            onClick={handleExportSelectedAgents}
            disabled={selectedAgents.length === 0 || exportingSelected}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1 text-[0.625rem] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
          >
            <Upload size="0.6875rem" />
            {exportingSelected ? "Exporting..." : "Export"}
          </button>
          <button
            onClick={exitSelectionMode}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Done
          </button>
        </div>
      )}

      <div className="relative">
        <Search
          size="0.8125rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          value={agentSearch}
          onChange={(event) => setAgentSearch(event.target.value)}
          placeholder="Search agents"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
      </div>

      {isLoading && <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">Loading...</div>}

      {!hasVisibleAgents && (
        <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">No agents match your search.</p>
      )}

      {agentFolders.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]/70">
            Drag and drop agents to folders
          </p>
          {agentFolders.map((folder) => {
            const isExpanded = expandedFolderId === folder.id;
            const isEditing = editingFolderId === folder.id;
            const folderAgents = folder.itemIds
              .map((id) => selectableAgentById.get(id))
              .filter((agent): agent is AgentConfigRow => Boolean(agent))
              .filter((agent) =>
                matchesAgentSearch({
                  name: agent.name,
                  description: agent.description,
                  category: BUILT_IN_AGENT_TYPE_SET.has(agent.type)
                    ? (BUILT_IN_AGENTS.find((entry) => entry.id === agent.type)?.category ?? "misc")
                    : "custom",
                }),
              );
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
                  className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
                  onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
                >
                  <ChevronRight
                    size="0.75rem"
                    className={cn(
                      "shrink-0 text-[var(--muted-foreground)] transition-transform",
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
                          if (event.key === "Enter") handleRenameFolder(folder.id);
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
                  {folder.itemIds.length > 0 && (
                    <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {folder.itemIds.length}
                    </span>
                  )}
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditFolderName(folder.name);
                      }}
                      className="rounded-lg p-1 transition-colors hover:bg-[var(--accent)]"
                      title="Rename folder"
                    >
                      <Pencil size="0.6875rem" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteAgentFolder.mutate(folder.id);
                        if (expandedFolderId === folder.id) setExpandedFolderId(null);
                      }}
                      className="rounded-lg p-1 transition-colors hover:bg-[var(--destructive)]/15"
                      title="Delete folder"
                    >
                      <Trash2 size="0.6875rem" className="text-[var(--destructive)]" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--border)]/20 pb-1 pl-1">
                    {folderAgents.length === 0 ? (
                      <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">Drop agents here.</p>
                    ) : (
                      folderAgents.map((agent) => renderFolderAgentCard(agent))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {agentCategorySections.map((section) => {
        const visibleAgents = visibleBuiltInAgents.filter(
          (agent) =>
            !folderedAgentIds.has(agent.id) && agent.category === section.category && matchesAgentSearch(agent),
        );
        if (visibleAgents.length === 0 && agentSearchQuery) return null;
        return (
          <PanelSection key={section.category} title={section.title} icon={section.icon}>
            {visibleAgents.length === 0 ? (
              <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
                No {section.title.toLowerCase()} yet.
              </p>
            ) : (
              visibleAgents.map((agent) =>
                renderAgentCard({
                  id: agent.id,
                  type: agent.id,
                  name: agent.name,
                  description: agent.description,
                  category: agent.category,
                  imagePath: configByType.get(agent.id)?.imagePath ?? null,
                  custom: false,
                  openAgentDetail,
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
                }),
              )
            )}
          </PanelSection>
        );
      })}

      {(visibleCustomAgents.length > 0 || !agentSearchQuery) && (
        <PanelSection title="Custom Agents" icon={<Sparkles size="0.8125rem" />}>
          {visibleCustomAgents.length === 0 ? (
            <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">No custom agents yet</p>
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
  onImagePick,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: {
  id: string;
  type: string;
  name: string;
  description: string;
  category: AgentCategory | "custom";
  imagePath?: string | null;
  custom: boolean;
  openAgentDetail: (id: string) => void;
  onImagePick: () => void;
  onDelete?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  isDragging?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}) {
  const iconContent = imagePath ? (
    <img src={imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <Sparkles size="1rem" />
  );
  const iconClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
    imagePath ? "bg-[var(--muted)]" : "bg-gradient-to-br from-violet-400 to-fuchsia-500",
  );

  return (
    <div
      key={id}
      data-agent-card
      data-agent-name={name}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (selectionMode && onToggleSelected) onToggleSelected();
      }}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]",
        selectionMode && selected && "bg-violet-400/10 ring-1 ring-violet-400/40",
        isDragging && "opacity-50",
      )}
    >
      {selectionMode && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            selected
              ? "border-violet-400 bg-violet-400 text-white"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
        >
          <Check size="0.75rem" />
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (selectionMode && onToggleSelected) {
            onToggleSelected();
            return;
          }
          onImagePick();
        }}
        className={cn(
          iconClasses,
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-400/50",
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
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-violet-400/10 hover:text-violet-400 active:scale-90"
            title="Edit agent"
            onClick={(event) => {
              event.stopPropagation();
              openAgentDetail(custom ? id : type);
            }}
          >
            <Pencil size="0.75rem" />
          </button>
          {onDelete && (
            <button
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/15 active:scale-90"
              title="Delete agent"
              onClick={(event) => {
                event.stopPropagation();
                void onDelete();
              }}
            >
              <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
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
          <span className="text-violet-400">{icon}</span>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-1 flex flex-col gap-1">{children}</div>}
    </div>
  );
}
