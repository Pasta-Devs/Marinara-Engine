// ──────────────────────────────────────────────
// Panel: API Connections (polished, with folders)
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  useConnections,
  useDuplicateConnection,
  useDeleteConnection,
  useUpdateConnection,
  useUploadConnectionImage,
} from "../../hooks/use-connections";
import {
  useConnectionFolders,
  useCreateConnectionFolder,
  useUpdateConnectionFolder,
  useDeleteConnectionFolder,
  useReorderConnectionFolders,
  useMoveConnection,
} from "../../hooks/use-connection-folders";
import { useAgentConfigs, useCreateAgent, useUpdateAgent } from "../../hooks/use-agents";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  BUILT_IN_AGENTS,
  LOCAL_SIDECAR_CONNECTION_ID,
  getDefaultAgentPrompt,
  type ConnectionFolder,
} from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  Plus,
  Trash2,
  Link,
  Check,
  Shuffle,
  ExternalLink,
  X,
  Copy,
  BrainCircuit,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Pencil,
  Camera,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { TTSConfigCard } from "./settings/TTSConfigCard";

/** Provider color pair for connection icons. Kept as one blue family by design. */
const CONNECTION_ICON_COLORS = {
  from: "from-sky-400",
  to: "to-blue-500",
  ring: "ring-sky-400/40",
  badge: "bg-sky-400",
};
const PROVIDER_COLORS: Record<string, { from: string; to: string; ring: string; badge: string }> = {
  openai: CONNECTION_ICON_COLORS,
  openai_chatgpt: CONNECTION_ICON_COLORS,
  anthropic: CONNECTION_ICON_COLORS,
  claude_subscription: CONNECTION_ICON_COLORS,
  google: CONNECTION_ICON_COLORS,
  google_vertex: CONNECTION_ICON_COLORS,
  mistral: CONNECTION_ICON_COLORS,
  cohere: CONNECTION_ICON_COLORS,
  openrouter: CONNECTION_ICON_COLORS,
  nanogpt: CONNECTION_ICON_COLORS,
  xai: CONNECTION_ICON_COLORS,
  custom: CONNECTION_ICON_COLORS,
  image_generation: CONNECTION_ICON_COLORS,
};
const DEFAULT_COLOR = CONNECTION_ICON_COLORS;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRuntimeVariantLabel(variant: string | null): string | null {
  if (!variant) return null;
  return variant.replace(/-/g, " ");
}

function getNextUnnamedFolderName(existingFolders: Array<{ name: string }>): string {
  const names = new Set(existingFolders.map((folder) => folder.name.trim().toLowerCase()).filter(Boolean));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index += 1;
  return `unnamed ${index}`;
}

function SidecarCard() {
  const { data: agentConfigs } = useAgentConfigs();
  const createAgent = useCreateAgent();
  const updateAgentConnection = useUpdateAgent();
  const {
    status,
    config,
    modelDownloaded,
    modelDisplayName,
    modelSize,
    startupError,
    failedRuntimeVariant,
    curatedModels,
    downloadProgress,
    setShowDownloadModal,
    startDownload,
    updateConfig,
    fetchStatus,
  } = useSidecarStore();
  const isDownloaded = modelDownloaded;
  const [assigningTrackers, setAssigningTrackers] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const activeModelName = isDownloaded ? modelDisplayName : null;
  const backendLabel = config.backend === "mlx" ? "MLX" : "GGUF";
  const trackerAgents = useMemo(
    () => BUILT_IN_AGENTS.filter((agent) => agent.category === "tracker" && !agent.libraryHidden),
    [],
  );
  const trackerLocalCount = useMemo(() => {
    const configs = (agentConfigs ?? []) as Array<{ type: string; connectionId: string | null }>;
    const byType = new Map(configs.map((cfg) => [cfg.type, cfg.connectionId]));
    return trackerAgents.filter((agent) => byType.get(agent.id) === LOCAL_SIDECAR_CONNECTION_ID).length;
  }, [agentConfigs, trackerAgents]);

  // Fetch status on mount (handles HMR store resets and initial load)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAssignTrackersToLocal = async () => {
    if (!isDownloaded || assigningTrackers) return;

    setAssigningTrackers(true);
    try {
      const configs = (agentConfigs ?? []) as Array<{
        id: string;
        type: string;
        connectionId: string | null;
      }>;
      const configByType = new Map(configs.map((cfg) => [cfg.type, cfg]));

      await Promise.all(
        trackerAgents.map(async (agent) => {
          const existing = configByType.get(agent.id);
          if (existing) {
            if (existing.connectionId === LOCAL_SIDECAR_CONNECTION_ID) return;
            await updateAgentConnection.mutateAsync({ id: existing.id, connectionId: LOCAL_SIDECAR_CONNECTION_ID });
            return;
          }

          await createAgent.mutateAsync({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            phase: agent.phase,
            enabled: true,
            connectionId: LOCAL_SIDECAR_CONNECTION_ID,
            promptTemplate: getDefaultAgentPrompt(agent.id),
            settings: {},
          });
        }),
      );

      toast.success("All built-in tracker agents now point to the local model.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tracker agent connections.");
    } finally {
      setAssigningTrackers(false);
    }
  };

  const openLocalModelSettings = () => {
    void fetchStatus();
    setShowDownloadModal(true);
  };

  const handleDownloadNow = () => {
    const quantization =
      curatedModels.find((model) => model.quantization === "q4_k_m")?.quantization ??
      curatedModels[0]?.quantization ??
      "q4_k_m";
    void startDownload(quantization);
  };

  const isDownloading = downloadProgress?.status === "downloading";

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 transition-all",
        expanded && "border-sky-400/30",
      )}
    >
      <div
        className={cn("flex items-center gap-2.5", !isDownloaded && "cursor-pointer")}
        onClick={() => {
          if (!isDownloaded) setExpanded(true);
        }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <BrainCircuit size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Local Model</div>
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {isDownloaded
              ? `${activeModelName ?? "Model"} • ${backendLabel}${modelSize ? ` • ${formatBytes(modelSize)}` : ""}${
                  status === "starting_server"
                    ? " • Starting"
                    : status === "server_error"
                      ? " • Error"
                      : status === "ready"
                        ? " • Ready"
                        : ""
                }`
              : "Not downloaded"}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openLocalModelSettings();
            }}
            className="rounded-lg p-1.5 text-sky-400 transition-all hover:bg-sky-400/15 active:scale-90"
            title="Open local model settings"
          >
            <Settings2 size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>
      {/* Local model actions (only when model is downloaded) */}
      {expanded && (
        <>
          {isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={() => void handleAssignTrackersToLocal()}
                disabled={assigningTrackers}
                className="flex items-center justify-between gap-3 rounded-lg border border-sky-400/15 bg-sky-400/8 px-3 py-2 text-left transition-all hover:bg-sky-400/12 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-sky-200">Use local model for all tracker agents</div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    Assigns the built-in local model as the connection override for every built-in tracker agent.
                  </div>
                </div>
                {assigningTrackers ? (
                  <BrainCircuit size="0.875rem" className="animate-pulse text-sky-300" />
                ) : (
                  <Link size="0.875rem" className="text-sky-300" />
                )}
              </button>
              <p className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {trackerLocalCount}/{trackerAgents.length} built-in tracker agents currently point at the local model.
                This changes which model they use when enabled; it does not enable the agents by itself.
              </p>
              <button
                type="button"
                onClick={() => updateConfig({ useForTrackers: !config.useForTrackers })}
                className="flex items-center gap-2.5 cursor-pointer select-none text-left"
              >
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "h-4 w-7 rounded-full transition-colors",
                      config.useForTrackers ? "bg-sky-400/70" : "bg-[var(--border)]",
                    )}
                  />
                  <div
                    className={cn(
                      "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                      config.useForTrackers && "translate-x-3",
                    )}
                  />
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">Use for tracker agents (roleplay)</span>
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ useForGameScene: !config.useForGameScene })}
                className="flex items-center gap-2.5 cursor-pointer select-none text-left"
              >
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "h-4 w-7 rounded-full transition-colors",
                      config.useForGameScene ? "bg-sky-400/70" : "bg-[var(--border)]",
                    )}
                  />
                  <div
                    className={cn(
                      "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                      config.useForGameScene && "translate-x-3",
                    )}
                  />
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">Use for game scene analysis</span>
              </button>
            </div>
          )}
          {!isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={handleDownloadNow}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 rounded-lg bg-sky-400/15 px-3 py-2 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloading ? "Downloading..." : "Download now"}
              </button>
              <button
                type="button"
                onClick={openLocalModelSettings}
                className="text-center text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                Choose model options
              </button>
            </div>
          )}
          {status === "server_error" && (
            <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <div className="text-[0.6875rem] font-medium text-amber-200">Local runtime unavailable</div>
              <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]/75">
                {startupError ?? "Marinara will keep running without the local model until you retry."}
              </div>
              {failedRuntimeVariant && (
                <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]/60">
                  Runtime: {formatRuntimeVariantLabel(failedRuntimeVariant)}
                </div>
              )}
              <button
                onClick={() => {
                  openLocalModelSettings();
                }}
                className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[0.6875rem] font-medium text-amber-200 transition-colors hover:bg-amber-500/25"
              >
                Open Local AI Model
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type ConnectionRowData = {
  id: string;
  name: string;
  provider: string;
  model: string;
  imagePath?: string | null;
  useForRandom?: string;
  defaultForAgents?: boolean | string;
  folderId?: string | null;
};

function DefaultAgentConnectionCard({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const defaultConnection =
    connectionsList.find(
      (conn) =>
        conn.provider !== "image_generation" && (conn.defaultForAgents === true || conn.defaultForAgents === "true"),
    ) ?? null;

  return (
    <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <Sparkles size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Default for Agents</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {defaultConnection
              ? `${defaultConnection.name} • ${defaultConnection.model || "No model set"}`
              : "No default agent connection set"}
          </div>
        </div>
        {defaultConnection && (
          <button
            type="button"
            onClick={() => openConnectionDetail(defaultConnection.id)}
            className="rounded-lg p-1.5 text-sky-400 transition-all hover:bg-sky-400/15 active:scale-90"
            title="Open default agent connection"
          >
            <Settings2 size="0.8125rem" />
          </button>
        )}
      </div>
    </div>
  );
}

function DefaultIllustratorConnectionCard({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const defaultConnection =
    connectionsList.find(
      (conn) =>
        conn.provider === "image_generation" && (conn.defaultForAgents === true || conn.defaultForAgents === "true"),
    ) ?? null;

  return (
    <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <ImageIcon size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Default for Illustrator</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {defaultConnection
              ? `${defaultConnection.name} • ${defaultConnection.model || "Image generation"}`
              : "No default Illustrator connection set"}
          </div>
        </div>
        {defaultConnection && (
          <button
            type="button"
            onClick={() => openConnectionDetail(defaultConnection.id)}
            className="rounded-lg p-1.5 text-sky-400 transition-all hover:bg-sky-400/15 active:scale-90"
            title="Open default Illustrator connection"
          >
            <Settings2 size="0.8125rem" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({
  conn,
  isSelected,
  isBulkSelected,
  selectionMode,
  onClickRow,
  isDragging,
  onDragStart,
  onDragEnd,
  onImagePick,
}: {
  conn: ConnectionRowData;
  isSelected: boolean;
  isBulkSelected: boolean;
  selectionMode: boolean;
  onClickRow: () => void;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onImagePick: () => void;
}) {
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);

  const inRandomPool = conn.useForRandom === "true";
  const colors = PROVIDER_COLORS[conn.provider] ?? DEFAULT_COLOR;
  const iconContent = conn.imagePath ? (
    <img src={conn.imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <Link size="1rem" />
  );
  const iconClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-sm",
    conn.imagePath ? "bg-[var(--muted)]" : `${colors.from} ${colors.to}`,
  );

  return (
    <div
      onClick={onClickRow}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
        isSelected && `ring-1 ${colors.ring} bg-[var(--sidebar-accent)]/50`,
        selectionMode && isBulkSelected && "ring-1 ring-[var(--border)] bg-[var(--sidebar-accent)]/70",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onImagePick();
        }}
        className={cn(
          iconClasses,
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400/50",
        )}
        title={conn.imagePath ? "Replace connection picture" : "Upload connection picture"}
        aria-label={conn.imagePath ? "Replace connection picture" : "Upload connection picture"}
      >
        {iconContent}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size="0.875rem" />
        </span>
        {(selectionMode ? isBulkSelected : isSelected) && (
          <div
            className={cn(
              "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm",
              colors.badge,
            )}
          >
            <Check size="0.625rem" className="text-white" />
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" title={conn.name}>
          {conn.name}
        </div>
        <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {conn.provider} • {conn.model || "No model set"}
        </div>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-foreground/10 transition-opacity group-hover:opacity-100 max-md:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateConnection.mutate({ id: conn.id, useForRandom: !inRandomPool });
          }}
          className={cn(
            "rounded-lg p-1.5 transition-all active:scale-90",
            inRandomPool
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
              : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/75",
          )}
          title={inRandomPool ? "In random pool (click to remove)" : "Add to random pool"}
        >
          <Shuffle size="0.75rem" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            duplicateConnection.mutate(conn.id, {
              onSuccess: (data: any) => {
                if (data?.id) openConnectionDetail(data.id);
              },
            });
          }}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-sky-400/10 hover:text-sky-400 active:scale-90"
          title="Duplicate"
        >
          <Copy size="0.75rem" />
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (
              !(await showConfirmDialog({
                title: "Delete Connection",
                message: `Delete "${conn.name}"? This cannot be undone.`,
                confirmLabel: "Delete",
                tone: "destructive",
              }))
            ) {
              return;
            }
            deleteConnection.mutate(conn.id);
          }}
          className="rounded-lg p-1.5 transition-all hover:bg-[var(--destructive)]/15 active:scale-90"
          title="Delete"
        >
          <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
        </button>
      </div>
    </div>
  );
}

function ConnectionFolderRow({
  folder,
  entries,
  renderConnectionRow,
  onToggleCollapse,
  onRename,
  onDelete,
  draggedConnectionId,
  onDropConnection,
}: {
  folder: ConnectionFolder;
  entries: ConnectionRowData[];
  renderConnectionRow: (conn: ConnectionRowData) => React.ReactNode;
  onToggleCollapse: (folder: ConnectionFolder) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (folder: ConnectionFolder) => void;
  draggedConnectionId: string | null;
  onDropConnection: (connectionIds: string[], folderId: string | null) => void;
}) {
  const dragControls = useDragControls();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <Reorder.Item
      value={folder.id}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      onDragEnter={(event) => {
        if (!draggedConnectionId) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragOver={(event) => {
        if (!draggedConnectionId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(event) => {
        if (!draggedConnectionId) return;
        event.preventDefault();
        const connectionId =
          event.dataTransfer.getData("application/x-marinara-connection-id") ||
          event.dataTransfer.getData("text/plain") ||
          draggedConnectionId;
        const payload = event.dataTransfer.getData("application/x-marinara-connection-ids");
        const connectionIds = payload ? (JSON.parse(payload) as string[]) : [connectionId];
        if (connectionIds.length > 0) onDropConnection(connectionIds, folder.id);
        setIsDropTarget(false);
      }}
      className={cn(
        "flex flex-col rounded-lg transition-colors",
        isDropTarget && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
      )}
    >
      {/* Folder header */}
      <div
        onClick={() => onToggleCollapse(folder)}
        className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-accent)]/40"
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab touch-none opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 max-md:opacity-100"
        >
          <GripVertical size="0.625rem" className="text-[var(--muted-foreground)]" />
        </div>
        <ChevronRight
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", !folder.collapsed && "rotate-90")}
        />
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(folder.id, renameValue);
                setRenaming(false);
              }
              if (e.key === "Escape") {
                setRenaming(false);
                setRenameValue(folder.name);
              }
            }}
            onBlur={() => {
              onRename(folder.id, renameValue);
              setRenaming(false);
            }}
            className="flex-1 bg-transparent text-xs font-medium text-[var(--foreground)] outline-none"
          />
        ) : (
          <span className="flex-1 cursor-pointer truncate text-xs font-medium text-[var(--muted-foreground)]">
            {folder.name}
          </span>
        )}
        {entries.length > 0 && (
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">{entries.length}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRenameValue(folder.name);
            setRenaming(true);
          }}
          className="shrink-0 rounded-md p-1 opacity-0 transition-all hover:bg-[var(--accent)] group-hover:opacity-100 max-md:opacity-100"
          title="Rename folder"
        >
          <Pencil size="0.75rem" className="text-[var(--muted-foreground)]" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder);
          }}
          className="shrink-0 rounded-md p-1 opacity-0 transition-all hover:bg-[var(--destructive)]/20 group-hover:opacity-100 max-md:opacity-100"
          title="Delete folder"
        >
          <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
        </button>
      </div>
      {/* Folder contents */}
      {!folder.collapsed && entries.length > 0 && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--border)]/20 pl-1">
          {entries.map((c) => (
            <div key={c.id}>{renderConnectionRow(c)}</div>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}

export function ConnectionsPanel() {
  const { data: connections, isLoading } = useConnections();
  const uploadConnectionImage = useUploadConnectionImage();
  const activeChat = useChatStore((s) => s.activeChat);

  const activeConnectionId = activeChat?.connectionId ?? null;
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const openModal = useUIStore((s) => s.openModal);
  const linkApiBannerDismissed = useUIStore((s) => s.linkApiBannerDismissed);
  const dismissLinkApiBanner = useUIStore((s) => s.dismissLinkApiBanner);

  // Folder hooks
  const { data: folders } = useConnectionFolders();
  const createFolderMut = useCreateConnectionFolder();
  const updateFolderMut = useUpdateConnectionFolder();
  const deleteFolderMut = useDeleteConnectionFolder();
  const reorderFoldersMut = useReorderConnectionFolders();
  const moveConnectionMut = useMoveConnection();

  const [draggedConnectionId, setDraggedConnectionId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const connectionImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetConnectionIdRef = useRef<string | null>(null);

  const connectionsList = useMemo(() => (connections as ConnectionRowData[] | undefined) ?? [], [connections]);

  // Sorted folder list + local order for optimistic drag-to-reorder
  const sortedFolders = useMemo(() => {
    if (!folders) return [] as ConnectionFolder[];
    return [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders]);

  const [localFolderOrder, setLocalFolderOrder] = useState<string[]>([]);
  useEffect(() => {
    setLocalFolderOrder(sortedFolders.map((f) => f.id));
  }, [sortedFolders]);

  // Split connections into per-folder + unfiled buckets
  const { unfiledConnections, folderConnectionsMap } = useMemo(() => {
    const unfiled: ConnectionRowData[] = [];
    const map = new Map<string, ConnectionRowData[]>();
    for (const c of connectionsList) {
      const fid = c.folderId ?? null;
      if (fid && sortedFolders.some((f) => f.id === fid)) {
        const arr = map.get(fid) ?? [];
        arr.push(c);
        map.set(fid, arr);
      } else {
        unfiled.push(c);
      }
    }
    return { unfiledConnections: unfiled, folderConnectionsMap: map };
  }, [connectionsList, sortedFolders]);

  const handleCreateFolder = () => {
    createFolderMut.mutate({ name: getNextUnnamedFolderName(sortedFolders) });
  };

  const handleFolderReorder = (newOrder: string[]) => {
    setLocalFolderOrder(newOrder);
    reorderFoldersMut.mutate(newOrder);
  };

  const handleToggleCollapse = (folder: ConnectionFolder) => {
    updateFolderMut.mutate({ id: folder.id, collapsed: !folder.collapsed });
  };

  const handleRenameFolder = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateFolderMut.mutate({ id, name: trimmed });
  };

  const handleDeleteFolder = async (folder: ConnectionFolder) => {
    const ok = await showConfirmDialog({
      title: "Delete Folder",
      message: `Delete folder "${folder.name}"? Connections inside will move back to Unfiled.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    deleteFolderMut.mutate(folder.id);
  };

  const getDraggedConnectionIds = useCallback(
    (connectionId: string) =>
      selectionMode && selectedConnectionIds.has(connectionId) ? Array.from(selectedConnectionIds) : [connectionId],
    [selectedConnectionIds, selectionMode],
  );

  const toggleConnectionSelection = useCallback((connectionId: string) => {
    setSelectedConnectionIds((current) => {
      const next = new Set(current);
      if (next.has(connectionId)) next.delete(connectionId);
      else next.add(connectionId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedConnectionIds(new Set());
  }, []);

  const handleDropConnectionsToFolder = (connectionIds: string[], folderId: string | null) => {
    const ids = Array.from(new Set(connectionIds.filter(Boolean)));
    for (const connectionId of ids) {
      moveConnectionMut.mutate({ connectionId, folderId });
    }
    setDraggedConnectionId(null);
  };

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
        toast.error("Choose an image file for the connection picture");
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
          await uploadConnectionImage.mutateAsync({ id: connectionId, image });
          toast.success("Connection picture updated");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to upload connection picture");
        } finally {
          imageTargetConnectionIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetConnectionIdRef.current = null;
        toast.error("Could not read that image");
      };
      reader.readAsDataURL(file);
    },
    [uploadConnectionImage],
  );

  const renderConnectionRow = (conn: ConnectionRowData) => {
    const isSelected = activeConnectionId === conn.id;
    const isBulkSelected = selectedConnectionIds.has(conn.id);
    return (
      <ConnectionRow
        key={conn.id}
        conn={conn}
        isSelected={isSelected}
        isBulkSelected={isBulkSelected}
        selectionMode={selectionMode}
        onClickRow={() => {
          if (selectionMode) toggleConnectionSelection(conn.id);
          else openConnectionDetail(conn.id);
        }}
        isDragging={draggedConnectionId === conn.id}
        onDragStart={(event) => {
          const ids = getDraggedConnectionIds(conn.id);
          setDraggedConnectionId(conn.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-marinara-connection-ids", JSON.stringify(ids));
          event.dataTransfer.setData("application/x-marinara-connection-id", conn.id);
          event.dataTransfer.setData("text/plain", conn.id);
        }}
        onDragEnd={() => setDraggedConnectionId(null)}
        onImagePick={() => handlePickConnectionImage(conn.id)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        ref={connectionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConnectionImageSelected}
      />

      <button
        onClick={() => openModal("create-connection")}
        className="flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-sky-400/15 transition-all hover:shadow-lg hover:shadow-sky-400/25 active:scale-[0.98]"
        title="Add Connection"
        aria-label="Add Connection"
      >
        <Plus size="0.875rem" />
      </button>

      {/* ── Local Model (Sidecar) ── */}
      {import.meta.env.VITE_MARINARA_LITE !== "true" && <SidecarCard />}

      {/* ── Text to Speech ── */}
      <TTSConfigCard />

      <DefaultAgentConnectionCard connectionsList={connectionsList} />
      <DefaultIllustratorConnectionCard connectionsList={connectionsList} />

      <div className="flex items-center gap-1">
        <button
          onClick={handleCreateFolder}
          className="flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)]"
        >
          <FolderPlus size="0.75rem" />
          New Folder
        </button>
        <button
          onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
          disabled={connectionsList.length === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] transition-all disabled:opacity-40",
            selectionMode
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)]",
          )}
        >
          <Check size="0.75rem" />
          {selectionMode ? "Done" : "Select"}
        </button>
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {selectedConnectionIds.size} selected
          </span>
          <button
            onClick={() => setSelectedConnectionIds(new Set(connectionsList.map((connection) => connection.id)))}
            disabled={connectionsList.length === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-sky-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
          >
            Select visible
          </button>
          <button
            onClick={() => setSelectedConnectionIds(new Set())}
            disabled={selectedConnectionIds.size === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}

      {sortedFolders.length > 0 && (
        <p className="px-2.5 text-[0.625rem] leading-snug text-[var(--muted-foreground)]/70">
          Drag and drop connections to folders
        </p>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!connections || (connections as unknown[]).length === 0) && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/20 to-blue-500/20">
            <Link size="1.25rem" className="text-sky-400" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">No connections yet</p>
        </div>
      )}

      {/* LinkAPI recommendation banner */}
      {!isLoading && (!connections || (connections as unknown[]).length === 0) && !linkApiBannerDismissed && (
        <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            Looking to try new models from a trusted provider? Consider checking out{" "}
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-400 underline decoration-sky-400/30 hover:text-sky-300 transition-colors"
            >
              LinkAPI
            </a>
            !
          </p>
          <div className="flex gap-2">
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-sky-400/15 px-3 py-1.5 text-xs font-medium text-sky-400 transition-all hover:bg-sky-400/25"
            >
              <ExternalLink size="0.75rem" />
              Visit LinkAPI
            </a>
            <button
              onClick={dismissLinkApiBanner}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--secondary)]"
            >
              <X size="0.75rem" />
              Dismiss permanently
            </button>
          </div>
        </div>
      )}

      {/* Folders (drag-to-reorder) */}
      {localFolderOrder.length > 0 && (
        <Reorder.Group
          axis="y"
          values={localFolderOrder}
          onReorder={handleFolderReorder}
          as="div"
          className="flex flex-col gap-0.5 mt-1"
        >
          {localFolderOrder.map((folderId) => {
            const folder = sortedFolders.find((f) => f.id === folderId);
            if (!folder) return null;
            const folderEntries = folderConnectionsMap.get(folderId) ?? [];
            return (
              <ConnectionFolderRow
                key={folderId}
                folder={folder}
                entries={folderEntries}
                renderConnectionRow={renderConnectionRow}
                onToggleCollapse={handleToggleCollapse}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
                draggedConnectionId={draggedConnectionId}
                onDropConnection={handleDropConnectionsToFolder}
              />
            );
          })}
        </Reorder.Group>
      )}

      {/* Unfiled connections */}
      <div
        onDragOver={(event) => {
          if (draggedConnectionId) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const payload = event.dataTransfer.getData("application/x-marinara-connection-ids");
          const fallbackId =
            event.dataTransfer.getData("application/x-marinara-connection-id") ||
            event.dataTransfer.getData("text/plain") ||
            draggedConnectionId;
          handleDropConnectionsToFolder(payload ? (JSON.parse(payload) as string[]) : fallbackId ? [fallbackId] : [], null);
        }}
        className={cn(
          "stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors",
          draggedConnectionId && "ring-1 ring-[var(--primary)]/20",
        )}
      >
        {unfiledConnections.map(renderConnectionRow)}
      </div>

      {activeChat && (
        <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
          Click to edit · Set active connection in Chat Settings
        </p>
      )}
    </div>
  );
}
