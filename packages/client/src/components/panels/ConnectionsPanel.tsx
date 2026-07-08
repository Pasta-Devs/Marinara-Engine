// ──────────────────────────────────────────────
// Panel: API Connections (polished, with folders)
// ──────────────────────────────────────────────
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type TouchEvent,
} from "react";
import { Reorder, useDragControls } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  connectionKeys,
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
  useReorderConnections,
} from "../../hooks/use-connection-folders";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { useAgentConfigs, useCreateAgent, useUpdateAgent } from "../../hooks/use-agents";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore, type ConnectionPanelSort } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  BUILT_IN_AGENTS,
  LOCAL_SIDECAR_CONNECTION_ID,
  getDefaultAgentPrompt,
  type ConnectionFolder,
  type SidecarSpeechModelId,
  type SidecarSpeechRuntimeDiagnostics,
} from "@marinara-engine/shared";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import {
  Plus,
  Trash2,
  Link,
  Check,
  Download,
  Search,
  ArrowUpDown,
  AlertTriangle,
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
  Camera,
  Sparkles,
  ImageIcon,
  Film,
  Mic,
  HardDriveDownload,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sortBasicPanelItems } from "../../lib/panel-sort";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import {
  CONNECTION_EXPORT_WARNING,
  createConnectionExportEnvelope,
  type ConnectionTransferRow,
} from "../../lib/connection-transfer";
import { toast } from "sonner";
import { TTSConfigCard } from "./settings/TTSConfigCard";
import { SettingsSwitch } from "./settings/SettingControls";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { TouchDragHandle } from "../ui/TouchDragHandle";

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
  grok_subscription: CONNECTION_ICON_COLORS,
  google: CONNECTION_ICON_COLORS,
  google_vertex: CONNECTION_ICON_COLORS,
  mistral: CONNECTION_ICON_COLORS,
  cohere: CONNECTION_ICON_COLORS,
  openrouter: CONNECTION_ICON_COLORS,
  nanogpt: CONNECTION_ICON_COLORS,
  xai: CONNECTION_ICON_COLORS,
  custom: CONNECTION_ICON_COLORS,
  image_generation: CONNECTION_ICON_COLORS,
  video_generation: CONNECTION_ICON_COLORS,
};
const DEFAULT_COLOR = CONNECTION_ICON_COLORS;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function describeSpeechRuntimeUnavailable(runtime: SidecarSpeechRuntimeDiagnostics | null): string {
  if (!runtime) {
    return "Local Whisper needs the native ONNX runtime for this platform. Reinstall dependencies with the same Node architecture used to run Marinara.";
  }

  const runtimeTuple = `${runtime.platform}/${runtime.arch}`;
  const installed =
    runtime.installedBindingArchs.length > 0
      ? runtime.installedBindingArchs.map((arch) => `${runtime.platform}/${arch}`).join(", ")
      : "";

  if (runtime.liteMode) {
    return "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.";
  }

  if (!runtime.packageFound) {
    return `Local Whisper needs onnxruntime-node. Run pnpm install with Node ${runtime.nodeVersion} (${runtimeTuple}), then restart Marinara.`;
  }

  if (installed && !runtime.installedBindingArchs.includes(runtime.arch)) {
    return `Marinara is running with ${runtimeTuple} Node, but this install has ONNX runtime for ${installed}. Restart Marinara with the matching Node architecture, or reinstall dependencies using the same Node architecture you use to run Marinara.`;
  }

  return `Local Whisper cannot find the ONNX runtime for ${runtimeTuple}. Run pnpm install --force --frozen-lockfile with the same Node architecture used to run Marinara, then restart.`;
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

function getDroppedConnectionIds(event: DragEvent<HTMLElement>, fallbackId: string | null): string[] {
  const payload = event.dataTransfer.getData("application/x-marinara-connection-ids");
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
      }
    } catch {
      // Fall through to single-id payloads. Some desktop drag providers can
      // expose partial data while moving between native drop targets.
    }
  }

  const singleId =
    event.dataTransfer.getData("application/x-marinara-connection-id") ||
    event.dataTransfer.getData("text/plain") ||
    fallbackId ||
    "";
  return singleId ? [singleId] : [];
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
    speechStatus,
    speechAvailable,
    speechModelDownloaded,
    speechModelDisplayName,
    speechModelSize,
    speechModels,
    speechRuntime,
    speechDownloadProgress,
    speechError,
    setShowDownloadModal,
    startDownload,
    startSpeechDownload,
    deleteSpeechModel,
    updateConfig,
    fetchStatus,
    fetchSpeechStatus,
  } = useSidecarStore();
  const isDownloaded = modelDownloaded;
  const [assigningTrackers, setAssigningTrackers] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [speechModelChoice, setSpeechModelChoice] = useState<SidecarSpeechModelId>("whisper_tiny");
  const activeModelName = isDownloaded ? modelDisplayName : null;
  const backendLabel = config.backend === "mlx" ? "MLX" : "GGUF";
  const nativeToolLabel =
    config.backend === "llama_cpp" ? ` • Native tools ${config.enableNativeToolCalls ? "on" : "off"}` : "";
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
    fetchSpeechStatus();
  }, [fetchSpeechStatus, fetchStatus]);

  useEffect(() => {
    const firstModel = speechModels[0]?.id;
    if (firstModel && !speechModels.some((model) => model.id === speechModelChoice)) {
      setSpeechModelChoice(firstModel);
    }
  }, [speechModelChoice, speechModels]);

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
  const speechDownloading = speechDownloadProgress?.status === "downloading" || speechStatus === "downloading_model";
  const activeSpeechModel = speechModels.find((model) => model.id === speechModelChoice) ?? speechModels[0];
  const speechStatusLabel = speechModelDownloaded
    ? `${speechModelDisplayName ?? "Whisper"}${
        speechStatus === "ready" ? " • Ready" : speechStatus === "loading" ? " • Loading" : " • Downloaded"
      }${speechModelSize ? ` • ${formatBytes(speechModelSize)}` : ""}`
    : speechAvailable
      ? "Not downloaded"
      : "Unavailable on this install";
  const localModelStatusLabel = isDownloaded
    ? `${activeModelName ?? "Model"} • ${backendLabel}${nativeToolLabel}${modelSize ? ` • ${formatBytes(modelSize)}` : ""}${
        status === "starting_server"
          ? " • Starting"
          : status === "server_error"
            ? " • Error"
            : status === "ready"
              ? " • Ready"
              : ""
      }`
    : speechModelDownloaded
      ? speechStatusLabel
      : speechDownloading
        ? "Downloading Whisper..."
        : "Not downloaded";
  const speechUnavailableMessage = describeSpeechRuntimeUnavailable(speechRuntime);

  const handleDownloadWhisper = () => {
    if (!activeSpeechModel || speechDownloading) return;
    void startSpeechDownload(activeSpeechModel.id);
  };

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
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">{localModelStatusLabel}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openLocalModelSettings();
            }}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
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
            className="mari-chrome-control mari-chrome-control--small p-1"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>
      {/* Local model actions (only when model is downloaded) */}
      {expanded && (
        <>
          <div className="mt-2.5 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--warning)]">
              <AlertTriangle size="0.875rem" className="shrink-0" />
              Local Model is not for roleplay
            </div>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              The bundled Local Model is intentionally small. Use it for tracker agents, scene analysis, and lightweight
              background tasks only.
            </p>
          </div>
          <div className="mt-2.5 rounded-lg border border-sky-400/15 bg-sky-400/5 p-2.5">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
                <Mic size="0.875rem" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[var(--foreground)]">Local Speech Model</div>
                  {speechModelDownloaded && (
                    <button
                      type="button"
                      onClick={() => void deleteSpeechModel()}
                      className="mari-chrome-control mari-chrome-control--small p-1"
                      title="Delete Local Whisper"
                    >
                      <Trash2 size="0.75rem" />
                    </button>
                  )}
                </div>
                <div className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{speechStatusLabel}</div>
                {!speechAvailable && (
                  <div className="mt-1 space-y-1">
                    <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                      {speechUnavailableMessage}
                    </p>
                    {speechRuntime && (
                      <p className="text-[0.59375rem] leading-relaxed text-[var(--muted-foreground)]/80">
                        Node {speechRuntime.nodeVersion} at {speechRuntime.nodeExecPath}
                      </p>
                    )}
                  </div>
                )}
                {!speechModelDownloaded && speechAvailable && (
                  <div className="mt-2 flex flex-col gap-2">
                    <select
                      value={speechModelChoice}
                      onChange={(event) => setSpeechModelChoice(event.target.value as SidecarSpeechModelId)}
                      className="mari-chrome-field h-8 text-xs"
                      disabled={speechDownloading || speechModels.length === 0}
                    >
                      {speechModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    {activeSpeechModel && (
                      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                        {activeSpeechModel.description} About {formatBytes(activeSpeechModel.sizeBytes)} download,{" "}
                        {formatBytes(activeSpeechModel.ramBytes)} RAM while running.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadWhisper}
                      disabled={speechDownloading || !activeSpeechModel}
                      className="mari-chrome-control w-full justify-center px-3 py-2 text-xs"
                    >
                      {speechDownloading ? (
                        <>
                          <HardDriveDownload size="0.8125rem" className="animate-pulse" />
                          Downloading Whisper...
                        </>
                      ) : (
                        <>
                          <HardDriveDownload size="0.8125rem" />
                          Download Whisper
                        </>
                      )}
                    </button>
                  </div>
                )}
                {speechDownloading && speechDownloadProgress && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-sky-400/10">
                      <div
                        className="h-full rounded-full bg-sky-300 transition-[width]"
                        style={{
                          width: `${
                            speechDownloadProgress.total > 0
                              ? Math.min(
                                  100,
                                  Math.round((speechDownloadProgress.downloaded / speechDownloadProgress.total) * 100),
                                )
                              : 12
                          }%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 truncate text-[0.625rem] text-[var(--muted-foreground)]">
                      {speechDownloadProgress.label ?? "Downloading Local Whisper"}
                    </div>
                  </div>
                )}
                {speechError && (
                  <div className="mt-2 rounded-md border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 px-2 py-1.5 text-[0.625rem] text-[var(--destructive)]">
                    {speechError}
                  </div>
                )}
              </div>
            </div>
          </div>
          {isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={() => void handleAssignTrackersToLocal()}
                disabled={assigningTrackers}
                className="mari-chrome-control w-full justify-between gap-3 px-3 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">Use local model for all tracker agents</div>
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
              <SettingsSwitch
                label="Use for tracker agents (roleplay)"
                checked={config.useForTrackers}
                onChange={(checked) => updateConfig({ useForTrackers: checked })}
                className="p-0 hover:bg-transparent"
                labelClassName="text-xs text-[var(--muted-foreground)]"
              />
              <SettingsSwitch
                label="Use for game scene analysis"
                checked={config.useForGameScene}
                onChange={(checked) => updateConfig({ useForGameScene: checked })}
                className="p-0 hover:bg-transparent"
                labelClassName="text-xs text-[var(--muted-foreground)]"
              />
            </div>
          )}
          {!isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={handleDownloadNow}
                disabled={isDownloading}
                className="mari-chrome-control w-full px-3 py-2 text-xs"
              >
                {isDownloading ? "Downloading..." : "Download now"}
              </button>
              <button
                type="button"
                onClick={openLocalModelSettings}
                className="mari-chrome-control mari-chrome-control--compact w-full text-center"
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
                className="mari-chrome-control mari-chrome-control--small mt-2 text-[0.6875rem]"
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
  baseUrl?: string;
  model: string;
  imagePath?: string | null;
  useForRandom?: string;
  isDefault?: boolean | string;
  defaultForAgents?: boolean | string;
  enableCaching?: boolean | string;
  anthropicExtendedCacheTtl?: boolean | string;
  cachingAtDepth?: number;
  embeddingModel?: string | null;
  embeddingBaseUrl?: string | null;
  embeddingConnectionId?: string | null;
  openrouterProvider?: string | null;
  imageGenerationSource?: string | null;
  comfyuiWorkflow?: string | null;
  imageService?: string | null;
  imageEndpointId?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  defaultParameters?: string | null;
  promptPresetId?: string | null;
  maxContext?: number;
  maxTokensOverride?: number | null;
  maxParallelJobs?: number;
  claudeFastMode?: boolean | string;
  folderId?: string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

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

function sortConnections(
  connections: readonly ConnectionRowData[],
  sort: ConnectionPanelSort,
): ConnectionRowData[] {
  if (sort === "custom") {
    return [...connections].sort((a, b) => {
      const aOrder =
        typeof a.sortOrder === "number" && Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const bOrder =
        typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      const orderDiff = aOrder - bOrder;
      if (orderDiff !== 0) return orderDiff;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }

  return sortBasicPanelItems(
    connections,
    sort,
    (connection) => connection.name,
    (connection) => connection.createdAt || connection.updatedAt,
  );
}

function formatDefaultConnectionOption(connection: ConnectionRowData, fallbackModelLabel: string): string {
  const model = connection.model?.trim() || fallbackModelLabel;
  return `${connection.name} - ${model}`;
}

function DefaultAgentConnectionCard({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const updateConnection = useUpdateConnection();
  const qc = useQueryClient();
  const agentConnections = useMemo(
    () => connectionsList.filter((conn) => conn.provider !== "image_generation" && conn.provider !== "video_generation"),
    [connectionsList],
  );
  const defaultConnection =
    agentConnections.find(
      (conn) =>
        conn.provider !== "image_generation" &&
        conn.provider !== "video_generation" &&
        (conn.defaultForAgents === true || conn.defaultForAgents === "true"),
    ) ?? null;
  const hasConnections = agentConnections.length > 0;

  const handleDefaultChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextConnectionId = event.target.value;
    if (nextConnectionId === defaultConnection?.id) return;
    if (!nextConnectionId) {
      if (defaultConnection) {
        updateConnection.mutate({ id: defaultConnection.id, defaultForAgents: false });
      }
      return;
    }
    updateConnection.mutate({ id: nextConnectionId, defaultForAgents: true });
  };
  const openFreshConnectionDetail = (id: string) => {
    qc.removeQueries({ queryKey: connectionKeys.detail(id) });
    openConnectionDetail(id);
  };

  return (
    <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
      <div className="flex items-center gap-2.5 max-sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <Sparkles size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Default for Agents</div>
          <select
            value={defaultConnection?.id ?? ""}
            onChange={handleDefaultChange}
            disabled={updateConnection.isPending || (!hasConnections && !defaultConnection)}
            className="mt-1 w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.75rem] text-[var(--foreground)] ring-1 ring-[var(--border)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Default agent connection"
          >
            <option value="">{hasConnections ? "No default agent connection" : "No text connections available"}</option>
            {agentConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {formatDefaultConnectionOption(connection, "No model set")}
              </option>
            ))}
          </select>
        </div>
        {defaultConnection && (
          <button
            type="button"
            onClick={() => openFreshConnectionDetail(defaultConnection.id)}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
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
  const updateConnection = useUpdateConnection();
  const qc = useQueryClient();
  const illustratorConnections = useMemo(
    () => connectionsList.filter((conn) => conn.provider === "image_generation"),
    [connectionsList],
  );
  const defaultConnection =
    illustratorConnections.find(
      (conn) =>
        conn.provider === "image_generation" && (conn.defaultForAgents === true || conn.defaultForAgents === "true"),
    ) ?? null;
  const hasConnections = illustratorConnections.length > 0;

  const handleDefaultChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextConnectionId = event.target.value;
    if (nextConnectionId === defaultConnection?.id) return;
    if (!nextConnectionId) {
      if (defaultConnection) {
        updateConnection.mutate({ id: defaultConnection.id, defaultForAgents: false });
      }
      return;
    }
    updateConnection.mutate({ id: nextConnectionId, defaultForAgents: true });
  };
  const openFreshConnectionDetail = (id: string) => {
    qc.removeQueries({ queryKey: connectionKeys.detail(id) });
    openConnectionDetail(id);
  };

  return (
    <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
      <div className="flex items-center gap-2.5 max-sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <ImageIcon size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Default for Illustrator</div>
          <select
            value={defaultConnection?.id ?? ""}
            onChange={handleDefaultChange}
            disabled={updateConnection.isPending || (!hasConnections && !defaultConnection)}
            className="mt-1 w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.75rem] text-[var(--foreground)] ring-1 ring-[var(--border)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Default Illustrator connection"
          >
            <option value="">
              {hasConnections ? "No default Illustrator connection" : "No image connections available"}
            </option>
            {illustratorConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {formatDefaultConnectionOption(connection, "Image generation")}
              </option>
            ))}
          </select>
        </div>
        {defaultConnection && (
          <button
            type="button"
            onClick={() => openFreshConnectionDetail(defaultConnection.id)}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Open default Illustrator connection"
          >
            <Settings2 size="0.8125rem" />
          </button>
        )}
      </div>
    </div>
  );
}

function DefaultVideoConnectionCard({ connectionsList }: { connectionsList: ConnectionRowData[] }) {
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const updateConnection = useUpdateConnection();
  const qc = useQueryClient();
  const videoConnections = useMemo(
    () => connectionsList.filter((conn) => conn.provider === "video_generation"),
    [connectionsList],
  );
  const defaultConnection =
    videoConnections.find(
      (conn) =>
        conn.provider === "video_generation" && (conn.defaultForAgents === true || conn.defaultForAgents === "true"),
    ) ?? null;
  const hasConnections = videoConnections.length > 0;

  const handleDefaultChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextConnectionId = event.target.value;
    if (nextConnectionId === defaultConnection?.id) return;
    if (!nextConnectionId) {
      if (defaultConnection) {
        updateConnection.mutate({ id: defaultConnection.id, defaultForAgents: false });
      }
      return;
    }
    updateConnection.mutate({ id: nextConnectionId, defaultForAgents: true });
  };
  const openFreshConnectionDetail = (id: string) => {
    qc.removeQueries({ queryKey: connectionKeys.detail(id) });
    openConnectionDetail(id);
  };

  return (
    <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3">
      <div className="flex items-center gap-2.5 max-sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <Film size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Default for Videos</div>
          <select
            value={defaultConnection?.id ?? ""}
            onChange={handleDefaultChange}
            disabled={updateConnection.isPending || (!hasConnections && !defaultConnection)}
            className="mt-1 w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.75rem] text-[var(--foreground)] ring-1 ring-[var(--border)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Default video connection"
          >
            <option value="">
              {hasConnections ? "No default video connection" : "No video connections available"}
            </option>
            {videoConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {formatDefaultConnectionOption(connection, "Video generation")}
              </option>
            ))}
          </select>
        </div>
        {defaultConnection && (
          <button
            type="button"
            onClick={() => openFreshConnectionDetail(defaultConnection.id)}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Open default video connection"
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
  onDropOnRow,
  onTouchStart,
  suppressClickRef,
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
  onDropOnRow: (event: React.DragEvent<HTMLDivElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLButtonElement>) => void;
  suppressClickRef?: { current: boolean };
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
  const iconFrameClasses = cn(
    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-sm",
    conn.imagePath ? "bg-[var(--muted)]" : `${colors.from} ${colors.to}`,
  );

  return (
    <div
      data-connection-id={conn.id}
      data-touch-drag-card="connection"
      onClick={() => {
        if (suppressClickRef?.current) return;
        onClickRow();
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropOnRow}
      className={cn(
        "group relative flex touch-pan-y cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
        isSelected && `ring-1 ${colors.ring} bg-[var(--sidebar-accent)]/50`,
        selectionMode && isBulkSelected && "ring-1 ring-[var(--border)] bg-[var(--sidebar-accent)]/70",
        isDragging && "opacity-50",
      )}
    >
      {onTouchStart && (
        <TouchDragHandle
          label="Drag connection"
          onTouchStart={(event) => {
            onTouchStart(event);
          }}
        />
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef?.current) return;
          onImagePick();
        }}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-xl text-white",
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]",
        )}
        title={conn.imagePath ? "Replace connection picture" : "Upload connection picture"}
        aria-label={conn.imagePath ? "Replace connection picture" : "Upload connection picture"}
      >
        <span className={iconFrameClasses}>
          {iconContent}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        </span>
        {(selectionMode ? isBulkSelected : isSelected) && (
          <div
            className={cn(
              "pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-md shadow-sm ring-1 ring-[var(--sidebar)]",
              colors.badge,
            )}
          >
            <Check size="0.625rem" className="text-white" />
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1 pr-0 transition-[padding] max-md:pr-24 [@media(pointer:coarse)]:pr-24 [@media(pointer:fine)]:group-hover:pr-24">
        <div className="truncate text-sm font-medium leading-5" title={conn.name}>
          {conn.name}
        </div>
        <div className="truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
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
          className="mari-chrome-control mari-chrome-control--small p-1.5"
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
          className="mari-chrome-control mari-chrome-control--small p-1.5"
          title="Delete"
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>
    </div>
  );
}

function ConnectionFolderRow({
  folder,
  entries,
  forceExpanded = false,
  renderConnectionRow,
  onToggleCollapse,
  onRename,
  onDelete,
  draggedConnectionId,
  onDropConnection,
}: {
  folder: ConnectionFolder;
  entries: ConnectionRowData[];
  forceExpanded?: boolean;
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
  const handleFolderRenameGesture = useFolderRenameGesture();
  const isExpanded = forceExpanded || !folder.collapsed;

  useEffect(() => {
    if (!renaming) setRenameValue(folder.name);
  }, [folder.name, renaming]);

  const beginRename = () => {
    setRenameValue(folder.name);
    setRenaming(true);
  };

  return (
    <Reorder.Item
      data-connection-folder-id={folder.id}
      value={folder.id}
      layout="position"
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
        const connectionIds = getDroppedConnectionIds(event, draggedConnectionId);
        if (connectionIds.length > 0) onDropConnection(connectionIds, folder.id);
        setIsDropTarget(false);
      }}
      className={cn(
        "flex flex-col rounded-lg transition-colors",
        isDropTarget &&
          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
      )}
    >
      {/* Folder header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}. Double-tap or press F2 to rename.`}
        title="Double-click, double-tap, or press F2 to rename."
        onClick={(event) =>
          handleFolderRenameGesture(folder.id, event, {
            onSingleClick: () => onToggleCollapse(folder),
            onRename: beginRename,
          })
        }
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          handleFolderRenameKeyDown(event, {
            onSingleClick: () => onToggleCollapse(folder),
            onRename: beginRename,
          });
        }}
        className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-accent)]/40"
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab touch-none opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 max-md:opacity-100"
        >
          <GripVertical size="0.625rem" className="mari-chrome-accent-icon mari-accent-animated" />
        </div>
        <ChevronRight
          size="0.75rem"
          className={cn(
            "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
            isExpanded && "rotate-90",
          )}
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
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--muted-foreground)]">
            {folder.name}
          </span>
        )}
        {entries.length > 0 && (
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">{entries.length}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder);
          }}
          className="mari-chrome-control mari-chrome-control--small shrink-0 p-1 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
          title="Delete folder"
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>
      {/* Folder contents */}
      <SmoothFolderContent
        open={isExpanded && entries.length > 0}
        className="ml-4 border-l border-[var(--border)]/20 pl-1"
        innerClassName="flex flex-col gap-0.5"
      >
        {entries.map((c) => (
          <div key={c.id}>{renderConnectionRow(c)}</div>
        ))}
      </SmoothFolderContent>
    </Reorder.Item>
  );
}

export function ConnectionsPanel() {
  const { data: connections, isLoading } = useConnections();
  const uploadConnectionImage = useUploadConnectionImage();
  const deleteConnection = useDeleteConnection();
  const activeChat = useChatStore((s) => s.activeChat);

  const activeConnectionId = activeChat?.connectionId ?? null;
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const openModal = useUIStore((s) => s.openModal);
  const linkApiBannerDismissed = useUIStore((s) => s.linkApiBannerDismissed);
  const dismissLinkApiBanner = useUIStore((s) => s.dismissLinkApiBanner);
  const sort = useUIStore((s) => s.connectionPanelSort);
  const setSort = useUIStore((s) => s.setConnectionPanelSort);

  // Folder hooks
  const { data: folders } = useConnectionFolders();
  const createFolderMut = useCreateConnectionFolder();
  const updateFolderMut = useUpdateConnectionFolder();
  const deleteFolderMut = useDeleteConnectionFolder();
  const reorderFoldersMut = useReorderConnectionFolders();
  const reorderConnectionsMut = useReorderConnections();

  const [draggedConnectionId, setDraggedConnectionId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [exportingSelected, setExportingSelected] = useState(false);
  const connectionImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetConnectionIdRef = useRef<string | null>(null);
  const suppressConnectionClickRef = useRef(false);

  const connectionsList = useMemo(() => (connections as ConnectionRowData[] | undefined) ?? [], [connections]);
  const filteredConnections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return connectionsList.filter((connection) => connectionMatchesSearch(connection, query));
  }, [connectionsList, search]);
  const sortedConnections = useMemo(() => sortConnections(filteredConnections, sort), [filteredConnections, sort]);
  const sortedConnectionsForReorder = useMemo(
    () => sortConnections(connectionsList, sort),
    [connectionsList, sort],
  );
  const searchActive = search.trim().length > 0;

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
    for (const c of sortedConnections) {
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
  }, [sortedConnections, sortedFolders]);

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
    const connectionCount = connectionsList.filter((connection) => connection.folderId === folder.id).length;
    const ok = await confirmNonEmptyFolderDelete(connectionCount, {
      title: "Delete Folder",
      message: `Delete "${folder.name}"? Its ${connectionCount} connection${
        connectionCount === 1 ? "" : "s"
      } will move back to Unfiled.`,
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

  const getConnectionsInFolder = useCallback(
    (folderId: string | null) =>
      sortedConnectionsForReorder.filter((connection) => {
        if (folderId) return connection.folderId === folderId;
        return !(connection.folderId && sortedFolders.some((folder) => folder.id === connection.folderId));
      }),
    [sortedConnectionsForReorder, sortedFolders],
  );

  const reorderConnectionsInFolder = useCallback(
    (connectionIds: string[], folderId: string | null, targetConnectionId?: string) => {
      const draggedIds = Array.from(new Set(connectionIds.filter(Boolean)));
      if (draggedIds.length === 0) return;
      if (targetConnectionId && draggedIds.includes(targetConnectionId)) return;

      const bucketIds = getConnectionsInFolder(folderId).map((connection) => connection.id);
      const withoutDragged = bucketIds.filter((id) => !draggedIds.includes(id));
      const insertIndex = targetConnectionId ? withoutDragged.indexOf(targetConnectionId) : withoutDragged.length;
      const safeInsertIndex = insertIndex >= 0 ? insertIndex : withoutDragged.length;
      const orderedConnectionIds = [
        ...withoutDragged.slice(0, safeInsertIndex),
        ...draggedIds,
        ...withoutDragged.slice(safeInsertIndex),
      ];

      if (orderedConnectionIds.length === 0) return;
      if (sort !== "custom") setSort("custom");
      reorderConnectionsMut.mutate({ orderedConnectionIds, folderId });
      setDraggedConnectionId(null);
    },
    [getConnectionsInFolder, reorderConnectionsMut, setSort, sort],
  );

  const handleDropConnectionsToFolder = useCallback(
    (connectionIds: string[], folderId: string | null) => {
      reorderConnectionsInFolder(connectionIds, folderId);
    },
    [reorderConnectionsInFolder],
  );

  const handleRootConnectionDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!draggedConnectionId) return;
      const target = event.target instanceof Element ? event.target.closest("[data-connection-id]") : null;
      if (target) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [draggedConnectionId],
  );

  const handleRootConnectionDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!draggedConnectionId) return;
      const target = event.target instanceof Element ? event.target.closest("[data-connection-id]") : null;
      if (target) return;
      event.preventDefault();
      event.stopPropagation();
      handleDropConnectionsToFolder(getDroppedConnectionIds(event, draggedConnectionId), null);
    },
    [draggedConnectionId, handleDropConnectionsToFolder],
  );

  const handleDropConnectionsOnRow = useCallback(
    (connectionIds: string[], targetConnectionId: string) => {
      const targetConnection = connectionsList.find((connection) => connection.id === targetConnectionId);
      if (!targetConnection) return;
      const folderId =
        targetConnection.folderId && sortedFolders.some((folder) => folder.id === targetConnection.folderId)
          ? targetConnection.folderId
          : null;
      reorderConnectionsInFolder(connectionIds, folderId, targetConnectionId);
    },
    [connectionsList, reorderConnectionsInFolder, sortedFolders],
  );

  const finishConnectionTouchDrag = useCallback(
    (connectionId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const connectionElement = target?.closest("[data-connection-id]") as HTMLElement | null;
      const targetConnectionId = connectionElement?.dataset.connectionId ?? null;
      if (targetConnectionId && targetConnectionId !== connectionId) {
        handleDropConnectionsOnRow(getDraggedConnectionIds(connectionId), targetConnectionId);
        window.setTimeout(() => {
          suppressConnectionClickRef.current = false;
        }, 0);
        return;
      }
      const folderElement = target?.closest("[data-connection-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-connection-folder-root]") as HTMLElement | null;
      const folderId = folderElement?.dataset.connectionFolderId ?? null;
      if (folderId || rootElement) {
        handleDropConnectionsToFolder(getDraggedConnectionIds(connectionId), folderId);
      } else {
        setDraggedConnectionId(null);
      }
      window.setTimeout(() => {
        suppressConnectionClickRef.current = false;
      }, 0);
    },
    [getDraggedConnectionIds, handleDropConnectionsOnRow, handleDropConnectionsToFolder],
  );

  const cancelConnectionTouchDrag = useCallback((_connectionId: string, wasActive: boolean) => {
    setDraggedConnectionId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressConnectionClickRef.current = false;
      }, 0);
    } else {
      suppressConnectionClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startConnectionTouchDrag } = useTouchFolderDrag({
    onActivate: (connectionId) => {
      suppressConnectionClickRef.current = true;
      setDraggedConnectionId(connectionId);
    },
    onDrop: finishConnectionTouchDrag,
    onCancel: cancelConnectionTouchDrag,
  });

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

  const exportConnections = useCallback(async (connectionsToExport: ConnectionRowData[]) => {
    if (connectionsToExport.length === 0) return;

    const confirmed = await showConfirmDialog({
      title: "Export Connection Data",
      message: CONNECTION_EXPORT_WARNING,
      confirmLabel: "Export",
      cancelLabel: "Close",
    });
    if (!confirmed) return;

    const envelope = createConnectionExportEnvelope(connectionsToExport as ConnectionTransferRow[]);
    if (connectionsToExport.length > 1) {
      downloadZipFile(
        [{ path: "marinara-connections.json", content: JSON.stringify(envelope, null, 2) }],
        "marinara-connections.zip",
      );
    } else {
      const filename = `${sanitizeExportFilenamePart(connectionsToExport[0]?.name, "connection")}.connection.json`;
      downloadJsonFile(envelope, filename);
    }
    toast.success(`Exported ${connectionsToExport.length} connection${connectionsToExport.length === 1 ? "" : "s"}`);
  }, []);

  const handleExportSelected = useCallback(async () => {
    if (selectedConnectionIds.size === 0) return;
    setExportingSelected(true);
    try {
      await exportConnections(connectionsList.filter((connection) => selectedConnectionIds.has(connection.id)));
    } finally {
      setExportingSelected(false);
    }
  }, [connectionsList, exportConnections, selectedConnectionIds]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedConnectionIds];
    if (ids.length === 0) return;

    if (
      !(await showConfirmDialog({
        title: "Delete Connections",
        message: `Delete ${ids.length} connection${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deleteConnection.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} connection${deletedCount === 1 ? "" : "s"}`);
    }

    if (failedIds.length > 0) {
      setSelectedConnectionIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} connection${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [deleteConnection, exitSelectionMode, selectedConnectionIds]);

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
        onDropOnRow={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDropConnectionsOnRow(getDroppedConnectionIds(event, draggedConnectionId), conn.id);
        }}
        onTouchStart={(event) => {
          startConnectionTouchDrag(event, conn.id, {
            allowInteractiveTarget: true,
            sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="connection"]'),
          });
        }}
        suppressClickRef={suppressConnectionClickRef}
        onImagePick={() => handlePickConnectionImage(conn.id)}
      />
    );
  };

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <input
        ref={connectionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConnectionImageSelected}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openModal("create-connection")}
          className="mari-panel-gradient-button mari-panel-gradient--connections flex-1 text-xs"
          aria-label="Create connection"
          title="New"
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => openModal("import-connection")}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          aria-label="Import connection"
          title="Import"
        >
          <Download size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
          disabled={connectionsList.length === 0}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            selectionMode && "mari-chrome-control--selected",
          )}
          aria-label={selectionMode ? "Exit connection selection mode" : "Select connections"}
          title="Select"
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder="Search connections..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ConnectionPanelSort)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
            aria-label="Sort connections"
          >
            <option value="custom">Custom</option>
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

        {sortedFolders.length > 0 && (
          <p className="mari-folder-helper">
            Drag and drop connections to folders, double-click or double-tap to rename
          </p>
        )}
      </div>

      {/* ── Local Model (Sidecar) ── */}
      {import.meta.env.VITE_MARINARA_LITE !== "true" && <SidecarCard />}

      {/* ── Text to Speech ── */}
      <TTSConfigCard />

      <DefaultAgentConnectionCard connectionsList={connectionsList} />
      <DefaultIllustratorConnectionCard connectionsList={connectionsList} />
      <DefaultVideoConnectionCard connectionsList={connectionsList} />

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
          <p className="mari-chrome-text-muted text-xs">No connections yet</p>
        </div>
      )}

      {!isLoading && connectionsList.length > 0 && filteredConnections.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <Search size="1.25rem" />
          </div>
          <p className="mari-chrome-text-muted text-xs">No connections match your search</p>
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
              className="mari-chrome-control mari-chrome-control--small text-xs"
            >
              <ExternalLink size="0.75rem" />
              Visit LinkAPI
            </a>
            <button onClick={dismissLinkApiBanner} className="mari-chrome-control mari-chrome-control--small text-xs">
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
            if (searchActive && folderEntries.length === 0) return null;
            return (
              <ConnectionFolderRow
                key={folderId}
                folder={folder}
                entries={folderEntries}
                forceExpanded={searchActive && folderEntries.length > 0}
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
        data-connection-folder-root
        onDragOver={handleRootConnectionDragOver}
        onDrop={handleRootConnectionDrop}
        className={cn(
          "stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors",
          draggedConnectionId &&
            "min-h-16 border border-dashed border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-1",
        )}
      >
        {draggedConnectionId && (
          <div className="pointer-events-none px-2 py-1 text-[0.625rem] text-[var(--marinara-chat-chrome-button-text-active)]">
            Drop here to move out of folder
          </div>
        )}
        {unfiledConnections.map(renderConnectionRow)}
      </div>

      {activeChat && (
        <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
          Click to edit · Set active connection in Chat Settings
        </p>
      )}

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedConnectionIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}
    </div>
  );
}
