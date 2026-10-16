import { insertLibraryItems } from "../../lib/library-order";
import { useLibraryOrder } from "../../hooks/use-library-order";
import { useLibraryFolderDrag } from "../../hooks/use-library-folder-drag";
import { type InsertEdge } from "../../lib/library-order";
import { DecisionModelModal } from "../modals/DecisionModelModal";
// ──────────────────────────────────────────────
// Panel: API Connections (polished, with folders)
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent, type DragEvent } from "react";
import { Reorder } from "framer-motion";
import {
  useConnections,
  useDeleteConnection,
  useMoveConnection,
  useSetConnectionModelPinned,
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
import {
  selectVisibleTrackerCapabilityAgents,
  useCapabilityAgentRegistry,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore, type ConnectionPanelSort } from "../../stores/ui.store";
import { GEMMA_RESTART_MESSAGE, useSidecarStore } from "../../stores/sidecar.store";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  getDefaultAgentPrompt,
  type ConnectionFolder,
  type SidecarSpeechModelId,
  type SidecarSpeechRuntimeDiagnostics,
  isChatProvider,
  parsePinnedModels,
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
  ExternalLink,
  X,
  BrainCircuit,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FolderPlus,
  FolderTree,
  MoreHorizontal,
  ImageIcon,
  Mic,
  Loader2,
  HardDrive,
  HardDriveDownload,
  MessageSquareText,
  Power,
  PowerOff,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sortBasicPanelItems, sortPanelFolders } from "../../lib/panel-sort";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import {
  CONNECTION_EXPORT_WARNING,
  createConnectionExportEnvelope,
  type ConnectionTransferRow,
} from "../../lib/connection-transfer";
import { toast } from "sonner";
import { TTSConfigCard } from "./settings/TTSConfigCard";
import { SpeechToTextCard } from "./settings/SpeechToTextCard";
import { SettingsSwitch } from "./settings/SettingControls";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useTranslation as useUiTranslation } from "react-i18next";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { isConnectionFlagTrue, isLanguageGenerationConnection } from "../../lib/connection-filters";
import { ConnectionRow, type ConnectionRowData } from "../connections/ConnectionRow";
import { ConnectionCard, isMediaRow, type ConnectionRowDisplay } from "../connections/ConnectionCard";
import { ConnectionDefaultsCard } from "../connections/ConnectionDefaultsCard";
import { PanelSection } from "../ui/PanelSection";
import { ContextMenu } from "../ui/ContextMenu";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount } from "../../lib/connection-groups";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.trim();
  }
}

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
  const { t: localizeUi } = useUiTranslation();
  /** The managed decision model installer, opened from inside this card. */
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const { data: agentConfigs } = useAgentConfigs();
  const { data: capabilityAgents } = useCapabilityAgentRegistry();
  const { data: installedCapabilityPackages } = useInstalledCapabilityPackages();
  const createAgent = useCreateAgent();
  const updateAgentConnection = useUpdateAgent();
  const {
    status,
    config,
    inferenceReady,
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
    loadModel,
    unloadModel,
    updateConfig,
    fetchStatus,
    fetchSpeechStatus,
  } = useSidecarStore();
  const isDownloaded = modelDownloaded;
  const [assigningTrackers, setAssigningTrackers] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [speechModelChoice, setSpeechModelChoice] = useState<SidecarSpeechModelId>("whisper_tiny");
  const [deletingSpeechModel, setDeletingSpeechModel] = useState(false);
  const [changingModelLoadState, setChangingModelLoadState] = useState(false);
  const activeModelName = isDownloaded ? modelDisplayName : null;
  const callsPackageInstalled = useMemo(
    () =>
      (installedCapabilityPackages ?? []).some(
        (item) => item.status !== "error" && item.manifest.kind.includes("conversation-calls"),
      ),
    [installedCapabilityPackages],
  );
  const backendLabel = config.backend === "mlx" ? "MLX" : "GGUF";
  const nativeToolLabel =
    config.backend === "llama_cpp" ? ` • Native tools ${config.enableNativeToolCalls ? "on" : "off"}` : "";
  const trackerAgents = useMemo(() => selectVisibleTrackerCapabilityAgents(capabilityAgents), [capabilityAgents]);
  const trackerLocalCount = useMemo(() => {
    const configs = (agentConfigs ?? []) as Array<{ type: string; connectionId: string | null }>;
    const byType = new Map(configs.map((cfg) => [cfg.type, cfg.connectionId]));
    return trackerAgents.filter((agent) => byType.get(agent.id) === LOCAL_SIDECAR_CONNECTION_ID).length;
  }, [agentConfigs, trackerAgents]);

  // Fetch status on mount (handles HMR store resets and initial load)
  useEffect(() => {
    fetchStatus();
    if (callsPackageInstalled) fetchSpeechStatus();
  }, [callsPackageInstalled, fetchSpeechStatus, fetchStatus]);

  useEffect(() => {
    const firstModel = speechModels[0]?.id;
    if (firstModel && !speechModels.some((model) => model.id === speechModelChoice)) {
      setSpeechModelChoice(firstModel);
    }
  }, [speechModelChoice, speechModels]);

  const handleDeleteSpeechModel = async () => {
    if (deletingSpeechModel) return;
    setDeletingSpeechModel(true);
    try {
      await deleteSpeechModel();
      toast.success(localizeUi("ui.panels.sidecarcard.localWhisperModelDeleted"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.panels.sidecarcard.failedToDeleteTheLocalWhisperModel"),
      );
    } finally {
      setDeletingSpeechModel(false);
    }
  };

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

      toast.success(localizeUi("ui.panels.sidecarcard.allBuiltInTrackerAgentsNowPointToThe"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.panels.sidecarcard.failedToUpdateTrackerAgentConnections"),
      );
    } finally {
      setAssigningTrackers(false);
    }
  };

  const handleModelLoadToggle = async () => {
    if (changingModelLoadState) return;
    setChangingModelLoadState(true);
    try {
      if (inferenceReady) {
        await unloadModel();
        toast.success(localizeUi("ui.panels.sidecarcard.localModelUnloaded"));
      } else {
        await loadModel();
        toast.success(localizeUi("ui.panels.sidecarcard.localModelLoaded"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.panels.sidecarcard.failedToChangeLocalModelLoadState"),
      );
    } finally {
      setChangingModelLoadState(false);
    }
  };

  const openLocalModelSettings = () => {
    void fetchStatus();
    setShowDownloadModal(true);
  };

  const handleDownloadNow = async () => {
    const quantization =
      curatedModels.find((model) => model.quantization === "q4_k_m")?.quantization ??
      curatedModels[0]?.quantization ??
      "q4_k_m";
    if (await startDownload(quantization)) {
      toast.success(GEMMA_RESTART_MESSAGE);
    }
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
    : callsPackageInstalled && speechModelDownloaded
      ? speechStatusLabel
      : callsPackageInstalled && speechDownloading
        ? "Downloading Whisper..."
        : "Not downloaded";
  const speechUnavailableMessage = describeSpeechRuntimeUnavailable(speechRuntime);

  const handleDownloadWhisper = async () => {
    if (!activeSpeechModel || speechDownloading) return;
    if (await startSpeechDownload(activeSpeechModel.id)) {
      toast.success(
        localizeUi("ui.panels.sidecarcard.whisperDownloadedCompletelyRestartMarinaraEngineBeforeUsingCalls"),
      );
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 transition-all",
        expanded && "border-sky-400/30",
      )}
    >
      <div
        className="flex cursor-pointer items-center gap-2.5"
        onClick={() => {
          // Header click toggles in every state. Gating this on the model not
          // being downloaded left the card body — including the tracker
          // assignment button — reachable only through the small chevron for
          // exactly the users who have the model installed (#5538).
          setExpanded((current) => !current);
        }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
          <BrainCircuit size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{localizeUi("ui.panels.sidecarcard.localModel")}</div>
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">{localModelStatusLabel}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openLocalModelSettings();
            }}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={localizeUi("ui.panels.sidecarcard.openLocalModelSettings")}
          >
            <Settings2 size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={
              expanded ? localizeUi("ui.panels.ttsconfigcard.collapse") : localizeUi("ui.panels.ttsconfigcard.expand")
            }
            aria-label={
              expanded ? localizeUi("ui.panels.ttsconfigcard.collapse") : localizeUi("ui.panels.ttsconfigcard.expand")
            }
            aria-expanded={expanded}
            aria-controls={
              // The body is conditionally rendered, so the IDREF resolves only
              // while expanded; a dangling aria-controls is an authoring error.
              expanded ? "local-model-card-content" : undefined
            }
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>
      {/* Local model actions (only when model is downloaded) */}
      {expanded && (
        <div id="local-model-card-content">
          <div className="mt-2.5 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--warning)]">
              <AlertTriangle size="0.875rem" className="shrink-0" />
              {localizeUi("ui.panels.sidecarcard.localModelIsNotForRoleplay")}
            </div>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.sidecarcard.theBundledLocalModelIsIntentionallySmallUseIt")}
            </p>
          </div>
          {callsPackageInstalled && (
            <div className="mt-2.5 rounded-lg border border-sky-400/15 bg-sky-400/5 p-2.5">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
                  <Mic size="0.875rem" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[var(--foreground)]">
                      {localizeUi("ui.panels.sidecarcard.localSpeechModel")}
                    </div>
                    {speechModelDownloaded && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteSpeechModel()}
                        disabled={deletingSpeechModel}
                        className="mari-chrome-control mari-chrome-control--small p-1"
                        title={localizeUi("ui.panels.sidecarcard.deleteLocalWhisper")}
                      >
                        {deletingSpeechModel ? (
                          <Loader2 size="0.75rem" className="animate-spin" />
                        ) : (
                          <Trash2 size="0.75rem" />
                        )}
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
                          {localizeUi("ui.panels.sidecarcard.node")} {speechRuntime.nodeVersion}{" "}
                          {localizeUi("ui.panels.sidecarcard.at")} {speechRuntime.nodeExecPath}
                        </p>
                      )}
                    </div>
                  )}
                  {!speechModelDownloaded && speechAvailable && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="max-md:relative md:contents">
                        <select
                          value={speechModelChoice}
                          onChange={(event) => setSpeechModelChoice(event.target.value as SidecarSpeechModelId)}
                          className="mari-chrome-field h-8 text-xs max-md:w-full max-md:min-w-0 max-md:appearance-none max-md:pl-2.5 max-md:pr-8"
                          aria-label={localizeUi("ui.panels.sidecarcard.localSpeechModel")}
                          disabled={speechDownloading || speechModels.length === 0}
                        >
                          {speechModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size="0.875rem"
                          aria-hidden="true"
                          className="mari-chrome-field-icon pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 md:hidden"
                        />
                      </div>
                      {activeSpeechModel && (
                        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                          {activeSpeechModel.description} {localizeUi("ui.noodle.stageprofileview.about")}{" "}
                          {formatBytes(activeSpeechModel.sizeBytes)} {localizeUi("ui.panels.sidecarcard.download")}{" "}
                          {formatBytes(activeSpeechModel.ramBytes)}{" "}
                          {localizeUi("ui.panels.sidecarcard.ramWhileRunning")}
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
                            {localizeUi("ui.panels.sidecarcard.downloadingWhisper")}
                          </>
                        ) : (
                          <>
                            <HardDriveDownload size="0.8125rem" />
                            {localizeUi("ui.panels.sidecarcard.downloadWhisper")}
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
                                    Math.round(
                                      (speechDownloadProgress.downloaded / speechDownloadProgress.total) * 100,
                                    ),
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
          )}
          {isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={() => void handleModelLoadToggle()}
                disabled={changingModelLoadState || status === "starting_server"}
                className="mari-chrome-control w-full justify-center gap-2 px-3 py-2 text-xs"
              >
                {changingModelLoadState || status === "starting_server" ? (
                  <Loader2 size="0.875rem" className="animate-spin" />
                ) : inferenceReady ? (
                  <PowerOff size="0.875rem" />
                ) : (
                  <Power size="0.875rem" />
                )}
                {changingModelLoadState || status === "starting_server"
                  ? localizeUi("ui.panels.sidecarcard.changingLocalModelState")
                  : inferenceReady
                    ? localizeUi("ui.panels.sidecarcard.unloadLocalModel")
                    : localizeUi("ui.panels.sidecarcard.loadLocalModel")}
              </button>
              <button
                type="button"
                onClick={() => void handleAssignTrackersToLocal()}
                disabled={assigningTrackers}
                className="mari-chrome-control w-full justify-between gap-3 px-3 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">
                    {localizeUi("ui.panels.sidecarcard.useLocalModelForAllTrackerAgents")}
                  </div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.sidecarcard.assignsTheBuiltInLocalModelAsTheConnection")}
                  </div>
                </div>
                {assigningTrackers ? (
                  <BrainCircuit size="0.875rem" className="animate-pulse text-sky-300" />
                ) : (
                  <Link size="0.875rem" className="text-sky-300" />
                )}
              </button>
              <p className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {trackerLocalCount}/{trackerAgents.length}{" "}
                {localizeUi("ui.panels.sidecarcard.builtInTrackerAgentsCurrentlyPointAtTheLocal")}
              </p>
              <SettingsSwitch
                label={localizeUi("ui.panels.sidecarcard.useForTrackerAgentsRoleplay")}
                checked={config.useForTrackers}
                onChange={(checked) => updateConfig({ useForTrackers: checked })}
                className="p-0 hover:bg-transparent"
                labelClassName="text-xs text-[var(--muted-foreground)]"
              />
              <SettingsSwitch
                label={localizeUi("ui.panels.sidecarcard.useForGameSceneAnalysis")}
                checked={config.useForGameScene}
                onChange={(checked) => updateConfig({ useForGameScene: checked })}
                className="p-0 hover:bg-transparent"
                labelClassName="text-xs text-[var(--muted-foreground)]"
              />
            </div>
          )}
          {/* Outside the downloaded-model branch on purpose: the decision sidecar is
              its own model and its own process, so it must not be reachable only by
              people who already have a chat model installed. */}
          <button
            type="button"
            onClick={() => setDecisionModalOpen(true)}
            className="mari-chrome-control mari-chrome-control--compact mt-2 w-full text-center"
          >
            {localizeUi("ui.panels.sidecarcard.decisionSidecar")}
          </button>
          {!isDownloaded && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-sky-400/10 pt-2.5">
              <button
                type="button"
                onClick={handleDownloadNow}
                disabled={isDownloading}
                className="mari-chrome-control w-full px-3 py-2 text-xs"
              >
                {isDownloading
                  ? localizeUi("ui.panels.sidecarcard.downloading")
                  : localizeUi("ui.panels.sidecarcard.downloadNow")}
              </button>
              <button
                type="button"
                onClick={openLocalModelSettings}
                className="mari-chrome-control mari-chrome-control--compact w-full text-center"
              >
                {localizeUi("ui.panels.sidecarcard.chooseModelOptions")}
              </button>
            </div>
          )}
          <DecisionModelModal open={decisionModalOpen} onClose={() => setDecisionModalOpen(false)} />
          {status === "server_error" && (
            <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <div className="text-[0.6875rem] font-medium text-amber-200">
                {localizeUi("ui.panels.sidecarcard.localRuntimeUnavailable")}
              </div>
              <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]/75">
                {startupError ?? "Marinara will keep running without the local model until you retry."}
              </div>
              {failedRuntimeVariant && (
                <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.panels.sidecarcard.runtime")} {formatRuntimeVariantLabel(failedRuntimeVariant)}
                </div>
              )}
              <button
                onClick={() => {
                  openLocalModelSettings();
                }}
                className="mari-chrome-control mari-chrome-control--small mt-2 text-[0.6875rem]"
              >
                {localizeUi("ui.game.gamesurfacecomponent.openLocalAiModel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

function sortConnections(connections: readonly ConnectionRowData[], sort: ConnectionPanelSort): ConnectionRowData[] {
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

function ConnectionFolderRow({
  folderDragBindings,
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
  folderDragBindings: ReturnType<ReturnType<typeof useLibraryFolderDrag>["bind"]>;
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
  const { t: localizeUi } = useUiTranslation();
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
      {...folderDragBindings}
      data-connection-folder-id={folder.id}
      value={folder.id}
      layout="position"
      dragListener={false}
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
        data-drag-surface
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
                e.preventDefault();
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
        <div
          data-folder-actions
          className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 ring-1 ring-transparent transition-[opacity,box-shadow] group-hover:ring-[var(--border)] max-md:ring-[var(--border)] [@media(pointer:coarse)]:ring-[var(--border)]"
        >
          {entries.length > 0 && (
            <span data-folder-item-count="actions" className="px-1 text-[0.5625rem] text-[var(--muted-foreground)]">
              {entries.length}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder);
            }}
            className="mari-chrome-control mari-chrome-control--small pointer-events-none shrink-0 p-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:pointer-events-auto [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
            title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
          >
            <Trash2 size="0.75rem" />
          </button>
        </div>
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
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const { data: connections, isLoading } = useConnections();
  const uploadConnectionImage = useUploadConnectionImage();
  const deleteConnection = useDeleteConnection();
  const activeChat = useChatStore((s) => s.activeChat);

  const activeConnectionId = activeChat?.connectionId ?? null;
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const openModal = useUIStore((s) => s.openModal);
  const linkApiBannerDismissed = useUIStore((s) => s.linkApiBannerDismissed);
  const dismissLinkApiBanner = useUIStore((s) => s.dismissLinkApiBanner);
  const upgradeNoteDismissed = useUIStore((s) => s.connectionsUpgradeNoteDismissed);
  const dismissUpgradeNote = useUIStore((s) => s.dismissConnectionsUpgradeNote);
  const sort = useUIStore((s) => s.connectionPanelSort);
  const setSort = useUIStore((s) => s.setConnectionPanelSort);
  const panelView = useUIStore((s) => s.connectionPanelView);
  const setPanelView = useUIStore((s) => s.setConnectionPanelView);
  const { data: accounts } = useConnectionAccounts();
  const setModelPinned = useSetConnectionModelPinned();
  const updateConnection = useUpdateConnection();
  const moveConnection = useMoveConnection();

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
  const sidecarNeedsAttention = useSidecarStore(
    (state) =>
      state.status === "downloading_runtime" ||
      state.status === "downloading_model" ||
      state.status === "starting_server" ||
      state.status === "server_error" ||
      !!state.startupError ||
      state.downloadProgress?.status === "downloading" ||
      state.downloadProgress?.status === "error",
  );
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number; keyboard: boolean } | null>(null);
  const [exportingSelected, setExportingSelected] = useState(false);
  const connectionImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetConnectionIdRef = useRef<string | null>(null);
  const suppressConnectionClickRef = useRef(false);

  const connectionsList = useMemo(() => (connections as ConnectionRowData[] | undefined) ?? [], [connections]);
  // ponytail: "had connections before" = a Connection created well after one of its Models, which only the upgrade
  // grouping does (a Model saved without a Connection is linked in the same moment). A Model moved into a much
  // newer Connection also counts; a server flag if that ever matters.
  const upgradedFromModels = useMemo(
    () =>
      !!accounts?.some((account) =>
        connectionsList.some(
          (row) =>
            row.accountId === account.id &&
            !!row.createdAt &&
            Date.parse(account.createdAt) - Date.parse(row.createdAt) > 60_000,
        ),
      ),
    [accounts, connectionsList],
  );
  const filteredConnections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return connectionsList.filter((connection) => connectionMatchesSearch(connection, query));
  }, [connectionsList, search]);
  const sortedConnections = useMemo(() => sortConnections(filteredConnections, sort), [filteredConnections, sort]);
  const sortedConnectionsForReorder = useMemo(() => sortConnections(connectionsList, sort), [connectionsList, sort]);
  const searchActive = search.trim().length > 0;

  // Cards view: one card per Connection, its Models sorted inside; media-only cards go under "Images & voice".
  const accountCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    const { groups, standalone } = groupModelsByAccount(sortConnections(connectionsList, sort), accounts ?? []);
    const ordered =
      sort === "custom"
        ? groups
        : sortBasicPanelItems(
            groups,
            sort,
            (group) => group.account.name,
            (group) => group.account.createdAt,
          );
    const cards = ordered
      .map((group) => {
        const accountHit = !!query && group.account.name.toLowerCase().includes(query);
        return {
          ...group,
          media: group.rows.length > 0 && group.rows.every(isMediaRow),
          rows: query && !accountHit ? group.rows.filter((row) => connectionMatchesSearch(row, query)) : group.rows,
        };
      })
      .filter((group) => !query || group.rows.length > 0);
    return {
      chat: cards.filter((card) => !card.media),
      media: cards.filter((card) => card.media),
      // Until the Connections load, every Model would look standalone.
      standalone: accounts ? standalone.filter((row) => connectionMatchesSearch(row, query)) : [],
    };
  }, [accounts, connectionsList, search, sort]);
  const needsKeyAccounts = useMemo(
    () => (accounts ?? []).filter((account) => account.state === "needs_key"),
    [accounts],
  );

  // Sorted folder list + local order for optimistic drag-to-reorder
  const sortedFolders = useMemo(() => {
    if (!folders) return [] as ConnectionFolder[];
    return sortPanelFolders(folders, sort);
  }, [folders, sort]);

  const [localFolderOrder, setLocalFolderOrder] = useState<string[]>([]);
  useEffect(() => {
    setLocalFolderOrder(sortPanelFolders(folders ?? [], "custom").map((f) => f.id));
  }, [folders]);
  const folderOrder = sort === "custom" ? localFolderOrder : sortedFolders.map((folder) => folder.id);

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
    if (sort !== "custom") setSort("custom");
    setLocalFolderOrder(newOrder);
    reorderFoldersMut.mutate(newOrder);
  };
  const folderDrag = useLibraryFolderDrag("connection", (ids, target, edge) => {
    handleFolderReorder(insertLibraryItems(folderOrder, ids, target, edge));
  });

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
    (connectionIds: string[], folderId: string | null, targetConnectionId?: string, edge: InsertEdge = "before") => {
      const draggedIds = Array.from(new Set(connectionIds.filter(Boolean)));
      if (draggedIds.length === 0) return;
      if (targetConnectionId && draggedIds.includes(targetConnectionId)) return;

      const bucketIds = getConnectionsInFolder(folderId).map((connection) => connection.id);
      const withoutDragged = bucketIds.filter((id) => !draggedIds.includes(id));
      const insertIndex = targetConnectionId ? withoutDragged.indexOf(targetConnectionId) : withoutDragged.length;
      const safeInsertIndex =
        insertIndex >= 0 ? insertIndex + (targetConnectionId && edge === "after" ? 1 : 0) : withoutDragged.length;
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
    (connectionIds: string[], targetConnectionId: string, edge: InsertEdge = "before") => {
      const targetConnection = connectionsList.find((connection) => connection.id === targetConnectionId);
      if (!targetConnection) return;
      const folderId =
        targetConnection.folderId && sortedFolders.some((folder) => folder.id === targetConnection.folderId)
          ? targetConnection.folderId
          : null;
      reorderConnectionsInFolder(connectionIds, folderId, targetConnectionId, edge);
    },
    [connectionsList, reorderConnectionsInFolder, sortedFolders],
  );

  const finishConnectionTouchDrag = useCallback(
    (connectionId: string, x: number, y: number, dragIds?: string[]) => {
      const target = document.elementFromPoint(x, y);
      const connectionElement = target?.closest("[data-connection-id]") as HTMLElement | null;
      const targetConnectionId = connectionElement?.dataset.connectionId ?? null;
      if (targetConnectionId && !(dragIds ?? getDraggedConnectionIds(connectionId)).includes(targetConnectionId)) {
        handleDropConnectionsOnRow(dragIds ?? getDraggedConnectionIds(connectionId), targetConnectionId);
        window.setTimeout(() => {
          suppressConnectionClickRef.current = false;
        }, 0);
        return;
      }
      const folderElement = target?.closest("[data-connection-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-connection-folder-root]") as HTMLElement | null;
      const folderId = folderElement?.dataset.connectionFolderId ?? null;
      if (folderId || rootElement) {
        handleDropConnectionsToFolder(dragIds ?? getDraggedConnectionIds(connectionId), folderId);
      }
      setDraggedConnectionId(null);
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

  useLibraryOrder("connection", handleDropConnectionsOnRow);
  const { startTouchDrag: startConnectionTouchDrag } = useTouchFolderDrag({
    getDragIds: getDraggedConnectionIds,
    reorderHandlesDrop: true,
    onReorder: (ids, target, edge) => {
      handleDropConnectionsOnRow(ids, target, edge);
    },
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
        toast.error(localizeUi("ui.panels.connectionspanel.chooseAnImageFileForTheConnectionPicture"));
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
          await uploadConnectionImage.mutateAsync({ id: connectionId, image });
          toast.success(localizeUi("ui.panels.connectionspanel.connectionPictureUpdated"));
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : localizeUi("ui.panels.connectionspanel.failedToUploadConnectionPicture"),
          );
        } finally {
          imageTargetConnectionIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetConnectionIdRef.current = null;
        toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
      };
      reader.readAsDataURL(file);
    },
    [uploadConnectionImage, localizeUi],
  );

  const exportConnections = useCallback(
    async (connectionsToExport: ConnectionRowData[]) => {
      if (connectionsToExport.length === 0) return;

      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.panels.connectionspanel.exportConnectionData"),
        message: CONNECTION_EXPORT_WARNING,
        confirmLabel: localizeUi("ui.characters.spritestab.export"),
        cancelLabel: "Close",
      });
      if (!confirmed) return;

      const envelope = createConnectionExportEnvelope(connectionsToExport as ConnectionTransferRow[]);
      const saveStatus =
        connectionsToExport.length > 1
          ? await downloadZipFile(
              [{ path: "marinara-connections.json", content: JSON.stringify(envelope, null, 2) }],
              "marinara-connections.zip",
            )
          : await downloadJsonFile(
              envelope,
              `${sanitizeExportFilenamePart(connectionsToExport[0]?.name, "connection")}.connection.json`,
            );
      if (saveStatus === "saved")
        toast.success(
          localizeUi("ui.panels.connectionspanel.exportedValue1ConnectionValue2", {
            value1: connectionsToExport.length,
            value2: connectionsToExport.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
    },
    [localizeUi],
  );

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
        title: localizeUi("ui.panels.connectionspanel.deleteConnections"),
        message: localizeUi("ui.panels.connectionspanel.deleteValue1ConnectionValue2ThisCannotBeUndone", {
          value1: ids.length,
          value2: ids.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deleteConnection.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(
        localizeUi("ui.panels.connectionspanel.deletedValue1ConnectionValue2", {
          value1: deletedCount,
          value2: deletedCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
    }

    if (failedIds.length > 0) {
      setSelectedConnectionIds(new Set(failedIds));
      toast.error(
        localizeUi("ui.panels.connectionspanel.failedToDeleteValue1ConnectionValue2", {
          value1: failedIds.length,
          value2: failedIds.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
      return;
    }

    exitSelectionMode();
  }, [deleteConnection, exitSelectionMode, selectedConnectionIds, localizeUi]);

  const renderConnectionRow = (conn: ConnectionRowData, display?: ConnectionRowDisplay) => {
    const isSelected = activeConnectionId === conn.id;
    const isBulkSelected = selectedConnectionIds.has(conn.id);
    const chatModel = isChatProvider(conn.provider);
    const pinned = !!conn.model && parsePinnedModels(conn.pinnedModels).includes(conn.model);
    // Media Models carry their kind's default in the agents flag.
    const defaultField = chatModel ? "isDefault" : "defaultForAgents";
    const canMakeDefault = !!display && conn.provider !== "decision" && !isConnectionFlagTrue(conn[defaultField]);
    // Same service and endpoint only; the server checks the credential kind again (decision 28).
    const account = accounts?.find((item) => item.id === conn.accountId);
    const moveTargets =
      account && !conn.credentialsFromConnectionId
        ? accounts!
            .filter(
              (item) =>
                item.id !== account.id &&
                item.provider === account.provider &&
                (account.provider !== "custom" || originOf(item.baseUrl) === originOf(account.baseUrl)),
            )
            .map(({ id, name }) => ({ id, name }))
        : [];
    return (
      <ConnectionRow
        key={conn.id}
        conn={conn}
        subtitle={display?.subtitle}
        badge={display?.badge}
        pinned={display ? pinned : undefined}
        onTogglePin={
          display && chatModel && conn.model
            ? () => setModelPinned.mutate({ id: conn.id, model: conn.model, pinned: !pinned })
            : undefined
        }
        onMakeDefault={
          canMakeDefault ? () => updateConnection.mutate({ id: conn.id, [defaultField]: true }) : undefined
        }
        moveTargets={moveTargets}
        onMove={(accountId, name) =>
          moveConnection.mutate(
            { id: conn.id, accountId },
            {
              onSuccess: () =>
                toast.success(localizeUi("connections.accounts.row.moved", { model: conn.name, connection: name })),
              onError: (error) =>
                toast.error(
                  localizeUi("connections.accounts.row.moveFailed", {
                    error: error instanceof Error ? error.message : String(error ?? ""),
                  }),
                ),
            },
          )
        }
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
          event.dataTransfer.effectAllowed = "copyMove";
          event.dataTransfer.setData("application/x-marinara-connection-ids", JSON.stringify(ids));
          event.dataTransfer.setData("application/x-marinara-connection-id", conn.id);
          event.dataTransfer.setData("text/plain", conn.id);
          writeChatResourceDragPayload(event.dataTransfer, {
            version: 1,
            kind: "connection",
            ids: [conn.id],
            label: conn.name,
            ...(isLanguageGenerationConnection(conn) ? {} : { unsupported: "connection-kind" as const }),
          });
        }}
        onDragEnd={() => {
          setDraggedConnectionId(null);
          clearActiveChatResourceDrag();
        }}
        onDropOnRow={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDropConnectionsOnRow(getDroppedConnectionIds(event, draggedConnectionId), conn.id);
        }}
        onTouchStart={(event) => {
          startConnectionTouchDrag(event, conn.id, {
            chatResourcePayload: {
              version: 1,
              kind: "connection",
              ids: [conn.id],
              label: conn.name,
              ...(isLanguageGenerationConnection(conn) ? {} : { unsupported: "connection-kind" as const }),
            },
            sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="connection"]'),
          });
        }}
        suppressClickRef={suppressConnectionClickRef}
        onImagePick={() => handlePickConnectionImage(conn.id)}
      />
    );
  };

  // Local Model, TTS and STT are helpers, so they follow the user's connections — unless there are none yet,
  // or the Local Model needs attention (a download or load runs or failed). Decided once per mount:
  // moving the section remounts SidecarCard and drops its state in the middle of a download.
  const deviceFirstRef = useRef<boolean | null>(null);
  const wantsDeviceFirst = (!isLoading && connectionsList.length === 0) || sidecarNeedsAttention;
  if (deviceFirstRef.current === null && !isLoading) deviceFirstRef.current = wantsDeviceFirst;
  const deviceFirst = deviceFirstRef.current ?? wantsDeviceFirst;
  const deviceSection = (
    <PanelSection title={localizeUi("connections.accounts.section.device")} icon={<HardDrive size="0.75rem" />}>
      {import.meta.env.VITE_MARINARA_LITE !== "true" && <SidecarCard />}
      <TTSConfigCard />
      {/* Speech to Text renders only while the Calls package is installed. */}
      <SpeechToTextCard />
    </PanelSection>
  );

  const renderAccountCard = (card: (typeof accountCards.chat)[number]) => (
    <ConnectionCard
      key={card.account.id}
      account={card.account}
      rows={card.rows}
      forceOpen={searchActive}
      renderRow={renderConnectionRow}
    />
  );

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <input
        ref={connectionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleConnectionImageSelected}
      />

      {/* Header: one primary action, then search, sort and a ⋯ menu for the rarer views */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openModal("create-connection")}
          className="mari-panel-gradient-button mari-panel-gradient--connections flex-1 text-xs"
          title={localizeUi("ui.panels.connectionspanel.createConnection")}
        >
          <Plus size="0.8125rem" />
          {localizeUi("connections.accounts.header.add")}
        </button>
        <button
          type="button"
          onClick={() => openModal("import-connection")}
          className="mari-chrome-control mari-chrome-control--primary px-3 text-xs"
          title={localizeUi("ui.panels.connectionspanel.importConnection")}
          aria-label={localizeUi("ui.panels.connectionspanel.importConnection")}
        >
          <Download size="0.8125rem" />
          {localizeUi("connections.accounts.header.import")}
        </button>
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder={localize("Search connections")}
            aria-label={localize("Search connections")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ConnectionPanelSort);
            }}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title={localizeUi("ui.panels.agentspanel.sortOrder")}
            aria-label={localizeUi("ui.panels.connectionspanel.sortConnections")}
          >
            <option value="custom">{localizeUi("settings.notifications.customSound.status.custom")}</option>
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
        <button
          type="button"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHeaderMenu({ x: rect.right, y: rect.bottom + 4, keyboard: event.detail === 0 });
          }}
          className={cn(
            "mari-chrome-control mari-chrome-control--small h-10 min-h-0 w-10 !p-0 md:h-9 md:w-9",
            (selectionMode || panelView === "folders") && "mari-chrome-control--selected",
          )}
          title={localizeUi("connections.accounts.header.more")}
          aria-label={localizeUi("connections.accounts.header.more")}
          aria-haspopup="menu"
          aria-expanded={!!headerMenu}
        >
          <MoreHorizontal size="0.875rem" />
        </button>
        {headerMenu && (
          <ContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            autoFocus={headerMenu.keyboard}
            onClose={() => setHeaderMenu(null)}
            items={[
              {
                label: selectionMode
                  ? localizeUi("ui.panels.connectionspanel.exitConnectionSelectionMode")
                  : localizeUi("ui.panels.connectionspanel.selectConnections"),
                icon: <Check size="0.75rem" />,
                disabled: connectionsList.length === 0,
                onSelect: () => (selectionMode ? exitSelectionMode() : setSelectionMode(true)),
              },
              {
                label:
                  panelView === "folders"
                    ? localizeUi("connections.accounts.view.cards")
                    : localizeUi("connections.accounts.view.folders"),
                icon: <FolderTree size="0.75rem" />,
                onSelect: () => setPanelView(panelView === "folders" ? "cards" : "folders"),
              },
            ]}
          />
        )}
      </div>

      {needsKeyAccounts.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5"
        >
          <AlertTriangle size="0.875rem" className="shrink-0 text-[var(--warning)]" />
          <span className="min-w-0 flex-1 text-xs">
            {localizeUi("connections.accounts.needKeyBanner", { count: needsKeyAccounts.length })}
          </span>
          <button
            type="button"
            onClick={() => openModal("connection-account", { accountId: needsKeyAccounts[0]!.id })}
            className="mari-chrome-control mari-chrome-control--small shrink-0 text-[0.6875rem] max-md:min-h-11"
          >
            {localizeUi("connections.accounts.addKey")}
          </button>
        </div>
      )}

      {panelView === "folders" && (
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

          {sortedFolders.length > 0 && (
            <p className="mari-folder-helper">
              {localizeUi("ui.panels.connectionspanel.dragAndDropConnectionsToFoldersDoubleClickOr")}
            </p>
          )}
        </div>
      )}

      {upgradedFromModels && !upgradeNoteDismissed && (
        <div
          role="note"
          data-connections-upgrade-note
          className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs text-[var(--muted-foreground)]"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p>{localizeUi("connections.upgradeNote.grouped")}</p>
            <p>{localizeUi("connections.upgradeNote.picks")}</p>
          </div>
          <button
            type="button"
            onClick={dismissUpgradeNote}
            className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--sidebar)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-label={localizeUi("connections.upgradeNote.dismiss")}
            title={localizeUi("connections.upgradeNote.dismiss")}
          >
            <X size="0.875rem" />
          </button>
        </div>
      )}

      <ConnectionDefaultsCard connectionsList={connectionsList} />

      {deviceFirst && deviceSection}

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
          <p className="mari-chrome-text-muted text-xs">{localizeUi("ui.panels.connectionspanel.noConnectionsYet")}</p>
        </div>
      )}

      {!isLoading && connectionsList.length > 0 && filteredConnections.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <Search size="1.25rem" />
          </div>
          <p className="mari-chrome-text-muted text-xs">
            {localizeUi("ui.panels.connectionspanel.noConnectionsMatchYourSearch")}
          </p>
        </div>
      )}

      {/* LinkAPI recommendation banner */}
      {!isLoading && (!connections || (connections as unknown[]).length === 0) && !linkApiBannerDismissed && (
        <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.connectionspanel.lookingToTryNewModelsFromATrustedProvider")}{" "}
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-400 underline decoration-sky-400/30 hover:text-sky-300 transition-colors"
            >
              {localizeUi("ui.panels.connectionspanel.linkapi")}
            </a>
            !
          </p>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mari-chrome-control mari-chrome-control--small w-full px-2 text-xs"
            >
              <ExternalLink size="0.75rem" className="shrink-0" />
              <span>{localizeUi("ui.panels.connectionspanel.visitLinkapi")}</span>
            </a>
            <button
              onClick={dismissLinkApiBanner}
              className="mari-chrome-control mari-chrome-control--small w-full px-2 text-xs"
            >
              <X size="0.75rem" className="shrink-0" />
              <span>{localizeUi("ui.panels.connectionspanel.dismissPermanently")}</span>
            </button>
          </div>
        </div>
      )}

      {panelView === "cards" && (
        <div className="flex flex-col gap-2">
          {accountCards.media.length > 0 ? (
            <>
              <PanelSection
                title={localizeUi("connections.accounts.section.chat")}
                icon={<MessageSquareText size="0.75rem" />}
              >
                {accountCards.chat.map(renderAccountCard)}
              </PanelSection>
              <PanelSection
                title={localizeUi("connections.accounts.section.media")}
                icon={<ImageIcon size="0.75rem" />}
              >
                {accountCards.media.map(renderAccountCard)}
              </PanelSection>
            </>
          ) : (
            accountCards.chat.map(renderAccountCard)
          )}
          {accountCards.standalone.length > 0 && (
            <PanelSection title={localizeUi("connections.accounts.section.other")} icon={<Link size="0.75rem" />}>
              {accountCards.standalone.map((row) =>
                renderConnectionRow(row, {
                  subtitle: row.model || localizeUi("connections.accounts.row.noModel"),
                  badge: null,
                }),
              )}
            </PanelSection>
          )}
        </div>
      )}

      {/* Folders (drag-to-reorder) */}
      {panelView === "folders" && folderOrder.length > 0 && (
        <Reorder.Group
          axis="y"
          values={folderDrag.orderItems(folderOrder, (id) => id)}
          onReorder={handleFolderReorder}
          as="div"
          className="flex flex-col gap-0.5 mt-1"
        >
          {folderDrag
            .orderItems(folderOrder, (id) => id)
            .map((folderId) => {
              const folder = sortedFolders.find((f) => f.id === folderId);
              if (!folder) return null;
              const folderEntries = folderConnectionsMap.get(folderId) ?? [];
              if (searchActive && folderEntries.length === 0) return null;
              return (
                <ConnectionFolderRow
                  folderDragBindings={folderDrag.bind(folderId)}
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
      {panelView === "folders" && (
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
              {localizeUi("ui.panels.agentspanel.dropHereToMoveOutOfFolder")}
            </div>
          )}
          {unfiledConnections.map((conn) => renderConnectionRow(conn))}
        </div>
      )}

      {!deviceFirst && deviceSection}

      {activeChat && (
        <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
          {localizeUi("ui.panels.connectionspanel.clickToEditSetActiveConnectionInChatSettings")}
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
